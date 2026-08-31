import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import type { AgentControlErrorCode, AgentControlResult } from '@iptvnator/shared/interfaces';
import {
    AgentControlAuthService,
    type AgentAuthFailure,
    type AgentAuthenticatedToken,
} from './agent-control-auth.service';
import { httpServer } from '../server/http-server';
import { readJsonBody } from './agent-control-http.util';

export function registerAgentControlTokenRoutes(
    prefix: string,
    auth: AgentControlAuthService,
    audit: (action: string, tokenId: string, details: unknown) => void
): void {
    httpServer.registerAgentControlHandler(`${prefix}/tokens`, (req, res) => {
        const token = guard(req, res, auth);
        if (!token) return;
        if (req.method === 'GET') return respond(res, 200, success('token.list', { tokens: auth.list() }));
        if (req.method !== 'POST') return methodNotAllowed(res);
        readBody(req, res, (body) => {
            const created = auth.create(body as Record<string, unknown>);
            if (isFailure(created)) return respondFailure(res, created);
            audit('token.created', token.id, { tokenId: created.record.id, scopes: created.record.scopes });
            respond(res, 201, success('token.create', { token: created.token, record: created.record }));
        });
    });
    httpServer.registerAgentControlHandler(`${prefix}/tokens/revoke`, (req, res) => {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const token = guard(req, res, auth);
        if (!token) return;
        readBody(req, res, (body) => {
            const tokenId = readTokenId(body);
            if (!tokenId) return respondFailure(res, missingTokenId());
            const revoked = auth.revoke(tokenId);
            if (isFailure(revoked)) return respondFailure(res, revoked);
            audit('token.revoked', token.id, { tokenId });
            respond(res, 200, success('token.revoke', { tokenId: revoked.id }));
        });
    });
    httpServer.registerAgentControlHandler(`${prefix}/tokens/rotate`, (req, res) => {
        if (req.method !== 'POST') return methodNotAllowed(res);
        const token = guard(req, res, auth);
        if (!token) return;
        readBody(req, res, (body) => {
            const tokenId = readTokenId(body);
            if (!tokenId) return respondFailure(res, missingTokenId());
            const rotated = auth.rotate(tokenId);
            if (isFailure(rotated)) return respondFailure(res, rotated);
            audit('token.rotated', token.id, { replacedTokenId: tokenId, tokenId: rotated.record.id });
            respond(res, 201, success('token.rotate', { token: rotated.token, record: rotated.record }));
        });
    });
}

function guard(req: http.IncomingMessage, res: http.ServerResponse, auth: AgentControlAuthService): AgentAuthenticatedToken | null {
    const checked = auth.authorize(req, 'tokens.manage');
    if (isFailure(checked)) {
        respondFailure(res, checked);
        return null;
    }
    const retryAfter = auth.consumeRateLimit(checked, true);
    if (retryAfter !== null) {
        res.setHeader('Retry-After', String(retryAfter));
        respondFailure(res, { code: 'rate-limited', message: 'Rate limit exceeded; retry after the advertised delay.', status: 429, retryable: true });
        return null;
    }
    return checked;
}

function readBody(req: http.IncomingMessage, res: http.ServerResponse, callback: (body: unknown) => void): void {
    readJsonBody(req, callback, (rejection) =>
        respondFailure(res, { ...rejection, retryable: false })
    );
}

function readTokenId(body: unknown): string {
    const value = (body as Record<string, unknown>)?.tokenId;
    return typeof value === 'string' ? value.trim() : '';
}

function missingTokenId(): AgentAuthFailure {
    return {
        code: 'invalid-request',
        message: 'A non-empty tokenId is required.',
        status: 400,
        retryable: false,
    };
}

function isFailure(value: unknown): value is AgentAuthFailure {
    return Boolean(value && typeof value === 'object' && 'status' in value && 'code' in value);
}

function success(operation: string, state: Record<string, unknown>): AgentControlResult {
    return { success: true, operation, requested: {}, state, timestamp: new Date().toISOString(), correlationId: randomUUID() };
}

function respondFailure(res: http.ServerResponse, failure: AgentAuthFailure): void {
    const result: AgentControlResult = {
        success: false,
        operation: 'token.request',
        requested: {},
        timestamp: new Date().toISOString(),
        correlationId: randomUUID(),
        error: { code: failure.code as AgentControlErrorCode, message: failure.message, retryable: failure.retryable },
    };
    respond(res, failure.status, result);
}

function methodNotAllowed(res: http.ServerResponse): void {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
}

function respond(res: http.ServerResponse, status: number, payload: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
}
