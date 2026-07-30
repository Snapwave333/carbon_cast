import { app, BrowserWindow, ipcMain } from 'electron';
import { appendFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import * as path from 'node:path';
import {
    type AgentControlErrorCode,
    type AgentControlEvent,
    type AgentControlOperation,
    type AgentControlRequest,
    type AgentControlResult,
    type AgentControlScope,
    type AgentControlState,
} from '@iptvnator/shared/interfaces';
import { httpServer } from '../server/http-server';
import {
    AgentControlAuthService,
    type AgentAuthenticatedToken,
} from './agent-control-auth.service';
import { registerAgentControlTokenRoutes } from './agent-control-token.routes';

const API_PREFIX = '/api/agent-control/v1';
const BODY_LIMIT_BYTES = 64 * 1024;
const COMMAND_TIMEOUT_MS = 10_000;

interface PendingCommand {
    resolve: (result: AgentControlResult) => void;
    timer: ReturnType<typeof setTimeout>;
}

type JsonObject = Record<string, unknown>;

const operationScopes: Record<AgentControlOperation, AgentControlScope> = {
    'player.getState': 'state.read',
    'player.play': 'player.control',
    'player.pause': 'player.control',
    'player.stop': 'player.control',
    'player.setVolume': 'player.control',
    'player.setMuted': 'player.control',
    'player.seek': 'player.control',
    'player.setFullscreen': 'player.control',
    'player.togglePictureInPicture': 'player.control',
    'player.setSubtitle': 'player.control',
    'player.setAudioTrack': 'player.control',
    'channel.list': 'library.read',
    'channel.switch': 'player.control',
    'channel.next': 'player.control',
    'channel.previous': 'player.control',
    'epg.getNowNext': 'library.read',
    'epg.refresh': 'library.write',
    'favorite.list': 'library.read',
    'favorite.set': 'library.write',
    'follow.list': 'library.read',
    'follow.set': 'follow.write',
    'follow.setAutoSwitch': 'follow.write',
    'recording.start': 'recording.control',
    'recording.stop': 'recording.control',
    'settings.get': 'state.read',
    'settings.update': 'settings.write',
    'diagnostics.get': 'diagnostics.read',
    'app.navigate': 'player.control',
};

const protectedKeys = /(?:token|password|credential|secret|stream|source|url|path|authorization)/i;

/**
 * Authenticated local bridge for MCP and CLI. Commands are acknowledged by
 * the renderer, so state never diverges from the GUI's real stores.
 */
export class AgentControlEvents {
    private state: AgentControlState = {
        ready: false,
        updatedAt: new Date().toISOString(),
    };
    private readonly pending = new Map<string, PendingCommand>();
    private readonly completed = new Map<string, AgentControlResult>();
    private readonly events = new Set<http.ServerResponse>();
    private readonly auth = new AgentControlAuthService();

    bootstrapAgentControlEvents(): void {
        this.auth.importBootstrapToken();
        httpServer.registerAgentControlHandler(
            `${API_PREFIX}/health`,
            this.handleHealth.bind(this)
        );
        httpServer.registerAgentControlHandler(
            `${API_PREFIX}/state`,
            this.handleState.bind(this)
        );
        httpServer.registerAgentControlHandler(
            `${API_PREFIX}/events`,
            this.handleEvents.bind(this)
        );
        httpServer.registerAgentControlHandler(
            `${API_PREFIX}/command`,
            this.handleCommand.bind(this)
        );
        registerAgentControlTokenRoutes(API_PREFIX, this.auth, (action, tokenId, details) =>
            this.audit(action, tokenId, details)
        );

        ipcMain.on(
            'AGENT_CONTROL_STATE_UPDATE',
            (_event, state: Partial<AgentControlState>) => {
                this.state = {
                    ...this.state,
                    ...(sanitize(state) as Partial<AgentControlState>),
                    ready: true,
                    updatedAt: new Date().toISOString(),
                };
                this.publish({
                    type: 'state.changed',
                    timestamp: this.state.updatedAt,
                    state: this.state,
                });
            }
        );
        ipcMain.on(
            'AGENT_CONTROL_COMMAND_RESULT',
            (_event, result: AgentControlResult) => this.resolveCommand(result)
        );
    }

    private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.method !== 'GET') {
            return this.methodNotAllowed(res);
        }
        this.respond(res, 200, { ready: this.state.ready, version: 1 });
    }

    private handleState(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.method !== 'GET') {
            return this.methodNotAllowed(res);
        }
        const token = this.authorize(req, res, 'state.read');
        if (!token || !this.consumeRateLimit(token, false, res)) {
            return;
        }
        this.respond(res, 200, this.state);
    }

    private handleEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.method !== 'GET') {
            return this.methodNotAllowed(res);
        }
        const token = this.authorize(req, res, 'events.read');
        if (!token || !this.consumeRateLimit(token, false, res)) {
            return;
        }
        res.writeHead(200, {
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
        });
        res.write(`event: state.changed\ndata: ${JSON.stringify(this.state)}\n\n`);
        this.events.add(res);
        req.on('close', () => this.events.delete(res));
    }

    private handleCommand(req: http.IncomingMessage, res: http.ServerResponse): void {
        if (req.method !== 'POST') {
            return this.methodNotAllowed(res);
        }
        this.readBody(req, res, async (body) => {
            const request = body as AgentControlRequest;
            const operation = request?.operation;
            if (!operation || !(operation in operationScopes)) {
                return this.error(res, 'invalid-request', 'Unknown or missing operation.');
            }
            const token = this.authorize(req, res, operationScopes[operation]);
            if (!token || !this.consumeRateLimit(token, true, res)) {
                return;
            }
            const result = await this.dispatchCommand(request, token.id);
            this.respond(res, result.success ? 200 : this.statusFor(result.error?.code), result);
        });
    }

    private async dispatchCommand(request: AgentControlRequest, tokenId: string): Promise<AgentControlResult> {
        const correlationId = request.correlationId?.trim() || randomUUID();
        const existing = this.completed.get(correlationId);
        if (existing) {
            return existing;
        }
        const requested = sanitize(request.params ?? {}) as JsonObject;
        const window = BrowserWindow.getAllWindows()[0];
        if (!window || window.isDestroyed()) {
            return this.result(false, request.operation, requested, correlationId, 'renderer-unavailable', 'The IPTVnator window is unavailable.', true);
        }
        this.audit(request.operation, tokenId, { correlationId, params: requested });
        return new Promise<AgentControlResult>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(correlationId);
                const timeout = this.result(false, request.operation, requested, correlationId, 'renderer-timeout', 'The renderer did not acknowledge the command in time.', true);
                this.remember(timeout);
                resolve(timeout);
            }, COMMAND_TIMEOUT_MS);
            this.pending.set(correlationId, { resolve, timer });
            window.webContents.send('AGENT_CONTROL_COMMAND', {
                operation: request.operation,
                params: requested,
                correlationId,
            });
        });
    }

    private resolveCommand(result: AgentControlResult): void {
        const sanitized = sanitize(result) as AgentControlResult;
        const pending = this.pending.get(sanitized.correlationId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pending.delete(sanitized.correlationId);
        this.remember(sanitized);
        this.publish({ type: 'command.completed', timestamp: sanitized.timestamp, correlationId: sanitized.correlationId, result: sanitized });
        pending.resolve(sanitized);
    }

    private authorize(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        scope: AgentControlScope
    ): AgentAuthenticatedToken | null {
        const checked = this.auth.authorize(req, scope);
        if ('status' in checked) {
            this.error(
                res,
                checked.code,
                checked.message,
                checked.status,
                checked.retryable
            );
            return null;
        }
        return checked;
    }

    private consumeRateLimit(
        token: AgentAuthenticatedToken,
        control: boolean,
        res: http.ServerResponse
    ): boolean {
        const retryAfter = this.auth.consumeRateLimit(token, control);
        if (retryAfter === null) return true;
        res.setHeader('Retry-After', String(retryAfter));
        this.error(
            res,
            'rate-limited',
            'Rate limit exceeded; retry after the advertised delay.',
            429,
            true
        );
        return false;
    }

    private readBody(req: http.IncomingMessage, res: http.ServerResponse, callback: (body: unknown) => void | Promise<void>): void {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size <= BODY_LIMIT_BYTES) {
                chunks.push(chunk);
            }
        });
        req.on('end', () => {
            if (size > BODY_LIMIT_BYTES) {
                this.error(res, 'invalid-request', 'Request body is too large.', 413);
                return;
            }
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                callback(raw ? JSON.parse(raw) : {});
            } catch {
                this.error(res, 'invalid-request', 'Request body must be valid JSON.');
            }
        });
    }

    private publish(event: AgentControlEvent): void {
        const line = `event: ${event.type}\ndata: ${JSON.stringify(sanitize(event))}\n\n`;
        for (const response of this.events) {
            try {
                response.write(line);
            } catch {
                this.events.delete(response);
            }
        }
    }

    private remember(result: AgentControlResult): void {
        this.completed.set(result.correlationId, result);
        if (this.completed.size > 200) {
            const oldest = this.completed.keys().next().value;
            if (oldest) this.completed.delete(oldest);
        }
    }

    private result(success: boolean, operation: string, requested: JsonObject, correlationId: string, code?: AgentControlErrorCode, message?: string, retryable = false): AgentControlResult {
        return {
            success,
            operation,
            requested,
            timestamp: new Date().toISOString(),
            correlationId,
            ...(code && message ? { error: { code, message, retryable } } : {}),
        };
    }

    private error(res: http.ServerResponse, code: AgentControlErrorCode, message: string, status = 400, retryable = false): void {
        this.respond(res, status, this.result(false, 'request', {}, randomUUID(), code, message, retryable));
    }

    private statusFor(code?: AgentControlErrorCode): number {
        if (code === 'authentication-required' || code === 'token-expired' || code === 'token-revoked') return 401;
        if (code === 'authorization-denied') return 403;
        if (code === 'not-found') return 404;
        if (code === 'rate-limited') return 429;
        if (code === 'renderer-unavailable') return 503;
        return 400;
    }

    private methodNotAllowed(res: http.ServerResponse): void {
        this.respond(res, 405, { error: 'Method not allowed' });
    }

    private respond(res: http.ServerResponse, status: number, payload: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(sanitize(payload)));
    }

    private audit(action: string, tokenId: string, details: unknown): void {
        const entry = JSON.stringify({ timestamp: new Date().toISOString(), action, tokenId, details: sanitize(details) });
        void appendFile(path.join(app.getPath('userData'), 'agent-control-audit.ndjson'), `${entry}\n`).catch(() => undefined);
    }
}

function sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value as JsonObject).map(([key, item]) => [
            key,
            protectedKeys.test(key) ? '[redacted]' : sanitize(item),
        ])
    );
}

export default new AgentControlEvents();
