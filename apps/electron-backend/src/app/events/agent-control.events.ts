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
import { captureAgentScreenshot } from './agent-control-screenshot';
import { readJsonBody } from './agent-control-http.util';
import {
    isControlOperation,
    mainProcessOperations,
    operationScopes,
} from './agent-control-operations';
import { AgentControlEventStream } from './agent-control-event-stream';
import { sanitize } from './agent-control-redact';
import { scheduleQuit } from './agent-control-window';
import {
    runWindowOperation,
    splitWindowOutcome,
} from './agent-control-window-operations';

const API_PREFIX = '/api/agent-control/v1';
const COMMAND_TIMEOUT_MS = 10_000;

interface PendingCommand {
    resolve: (result: AgentControlResult) => void;
    timer: ReturnType<typeof setTimeout>;
}

type JsonObject = Record<string, unknown>;




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
    private readonly stream = new AgentControlEventStream();
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
        this.stream.open(res, this.state);

        const close = () => this.stream.drop(res);
        req.on('close', close);
        res.on('error', close);
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
            if (!token || !this.consumeRateLimit(token, isControlOperation(operation), res)) {
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
            return this.result(false, request.operation, requested, correlationId, 'renderer-unavailable', 'The CarbonCast IPTV window is unavailable.', true);
        }
        this.audit(request.operation, tokenId, { correlationId, params: requested });
        this.beginAgentCommand(request.operation, correlationId);

        // Handled entirely in the main process: the usual reason to ask for a
        // screenshot — or to move, restore, or quit the window — is that the
        // renderer is not answering, so routing these through the renderer
        // acknowledgement would fail exactly when they are needed.
        if (mainProcessOperations.has(request.operation)) {
            if (request.operation === 'diagnostics.screenshot') {
                return this.captureScreenshot(request.operation, requested, correlationId);
            }
            return this.windowOperation(request.operation, requested, correlationId, window);
        }

        return new Promise<AgentControlResult>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(correlationId);
                const timeout = this.result(false, request.operation, requested, correlationId, 'renderer-timeout', 'The renderer did not acknowledge the command in time.', true);
                this.completeCommand(timeout);
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
        this.completeCommand(sanitized);
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
        readJsonBody(req, callback, (rejection) =>
            this.error(res, rejection.code, rejection.message, rejection.status)
        );
    }

    private publish(event: AgentControlEvent): void {
        this.stream.publish(event);
    }

    private async captureScreenshot(operation: string, requested: JsonObject, correlationId: string): Promise<AgentControlResult> {
        try {
            const screenshot = await captureAgentScreenshot();
            const result: AgentControlResult = {
                ...this.result(true, operation, requested, correlationId),
                state: { screenshot: { ...screenshot } },
            };
            this.completeCommand(result);
            return result;
        } catch (error) {
            const failure = this.result(false, operation, requested, correlationId, 'internal-error', error instanceof Error ? error.message : 'Screenshot failed.', true);
            this.completeCommand(failure);
            return failure;
        }
    }

    /**
     * Window, display, and lifecycle operations, answered without the renderer.
     *
     * Results are remembered like any other command so a retried correlation
     * id replays the outcome instead of moving the window a second time.
     */
    private windowOperation(
        operation: AgentControlOperation,
        requested: JsonObject,
        correlationId: string,
        window: BrowserWindow
    ): AgentControlResult {
        const { success, failure } = splitWindowOutcome(
            runWindowOperation(operation, requested, window)
        );

        const result: AgentControlResult = failure
            ? this.result(
                  false,
                  operation,
                  requested,
                  correlationId,
                  failure.code,
                  failure.message,
                  failure.retryable
              )
            : {
                  ...this.result(true, operation, requested, correlationId),
                  state: { data: success?.data },
              };

        this.completeCommand(result);

        // Answer first, quit after: this process writes the response it is
        // about to stop being able to send.
        if (success?.quit) scheduleQuit();
        return result;
    }

    private beginAgentCommand(operation: string, correlationId: string): void {
        const startedAt = new Date().toISOString();
        this.state = {
            ...this.state,
            agentCommand: { operation, correlationId, startedAt },
            updatedAt: startedAt,
        };
        this.publish({
            type: 'state.changed',
            timestamp: startedAt,
            correlationId,
            state: this.state,
        });
    }

    private completeCommand(result: AgentControlResult): void {
        this.remember(result);
        if (this.state.agentCommand?.correlationId === result.correlationId) {
            const { agentCommand: _completed, ...stateWithoutCommand } = this.state;
            this.state = {
                ...stateWithoutCommand,
                updatedAt: new Date().toISOString(),
            };
            this.publish({
                type: 'state.changed',
                timestamp: this.state.updatedAt,
                correlationId: result.correlationId,
                state: this.state,
            });
        }
        this.publish({
            type: 'command.completed',
            timestamp: result.timestamp,
            correlationId: result.correlationId,
            result,
        });
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


export default new AgentControlEvents();
