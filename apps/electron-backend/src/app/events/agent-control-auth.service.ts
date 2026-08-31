import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import * as http from 'node:http';
import {
    AGENT_CONTROL_SCOPES,
    type AgentControlErrorCode,
    type AgentControlScope,
} from '@iptvnator/shared/interfaces';
import {
    AGENT_CONTROL_TOKENS,
    store,
    type AgentControlTokenRecord,
} from '../services/store.service';

const READ_LIMIT = 120;
const CONTROL_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
/**
 * Per-source ceiling on rejected credentials. Token-scoped rate limits cannot
 * see an unauthenticated caller, so without this an attacker on the socket can
 * try tokens as fast as the event loop allows.
 */
const FAILED_AUTH_LIMIT = 20;

export interface AgentAuthenticatedToken {
    id: string;
    scopes: AgentControlScope[];
}

export interface AgentAuthFailure {
    code: AgentControlErrorCode;
    message: string;
    status: number;
    retryable: boolean;
}

interface RateBucket {
    count: number;
    resetAt: number;
}

export class AgentControlAuthService {
    private readonly rateBuckets = new Map<string, RateBucket>();
    private readonly failedAuth = new Map<string, RateBucket>();

    importBootstrapToken(): void {
        const rawToken = process.env.IPTVNATOR_AGENT_TOKEN?.trim();
        if (!rawToken) return;
        if (rawToken.length < 24) {
            // Silently ignoring this left every later request answering 401
            // with nothing pointing back at the cause.
            console.warn(
                '[agent-control] IPTVNATOR_AGENT_TOKEN is shorter than 24 characters and was ignored.'
            );
            return;
        }
        const tokenHash = hash(rawToken);
        if (this.records().some((record) => equalHash(record.tokenHash, tokenHash))) {
            return;
        }
        const expiresAt = process.env.IPTVNATOR_AGENT_TOKEN_EXPIRES_AT;
        this.save([
            ...this.records(),
            {
                id: randomUUID(),
                label: 'bootstrap environment token',
                tokenHash,
                scopes: [...AGENT_CONTROL_SCOPES],
                createdAt: new Date().toISOString(),
                ...(expiresAt && !Number.isNaN(Date.parse(expiresAt))
                    ? { expiresAt }
                    : {}),
            },
        ]);
    }

    authorize(
        req: http.IncomingMessage,
        scope: AgentControlScope
    ): AgentAuthenticatedToken | AgentAuthFailure {
        const source = req.socket?.remoteAddress ?? 'unknown';
        if (this.isLockedOut(source)) {
            return failure(
                'rate-limited',
                'Too many rejected credentials from this source; retry in a minute.',
                429
            );
        }
        const header = req.headers.authorization;
        const rawToken = header?.startsWith('Bearer ')
            ? header.slice(7).trim()
            : '';
        if (!rawToken) return this.reject(source, 'authentication-required', 'A bearer token is required.');
        // Hash once: hashing inside the scan cost one SHA-256 per stored token.
        const presented = hash(rawToken);
        const record = this.records().find((item) =>
            equalHash(item.tokenHash, presented)
        );
        if (!record) return this.reject(source, 'authentication-required', 'The bearer token is invalid.');
        if (record.revokedAt) return this.reject(source, 'token-revoked', 'The bearer token has been revoked.');
        if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
            return this.reject(source, 'token-expired', 'The bearer token has expired.');
        }
        const scopes = normalizeScopes(record.scopes);
        if (!scopes.includes(scope)) {
            return failure('authorization-denied', `The token lacks the ${scope} scope.`, 403);
        }
        return { id: record.id, scopes };
    }

    consumeRateLimit(
        token: AgentAuthenticatedToken,
        control: boolean
    ): number | null {
        const now = Date.now();
        const key = `${token.id}:${control ? 'control' : 'read'}`;
        const limit = control ? CONTROL_LIMIT : READ_LIMIT;
        const bucket = takeBucket(this.rateBuckets, key, now);
        return bucket.count <= limit
            ? null
            : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    }

    private isLockedOut(source: string): boolean {
        const bucket = this.failedAuth.get(source);
        return Boolean(
            bucket &&
                bucket.resetAt > Date.now() &&
                bucket.count >= FAILED_AUTH_LIMIT
        );
    }

    private reject(
        source: string,
        code: AgentControlErrorCode,
        message: string
    ): AgentAuthFailure {
        takeBucket(this.failedAuth, source, Date.now());
        return failure(code, message, 401);
    }

    list(): Omit<AgentControlTokenRecord, 'tokenHash'>[] {
        return this.records().map(({ tokenHash: _tokenHash, ...record }) => record);
    }

    create(input: {
        label?: unknown;
        scopes?: unknown;
        expiresAt?: unknown;
    }): { token: string; record: Omit<AgentControlTokenRecord, 'tokenHash'> } | AgentAuthFailure {
        const scopes = normalizeScopes(input.scopes);
        if (!scopes.length) return failure('invalid-request', 'At least one valid scope is required.', 400);
        const expiresAt = typeof input.expiresAt === 'string' ? input.expiresAt : undefined;
        if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
            return failure('invalid-request', 'expiresAt must be an ISO timestamp.', 400);
        }
        const token = `iptv_${randomBytes(24).toString('base64url')}`;
        const record: AgentControlTokenRecord = {
            id: randomUUID(),
            label:
                typeof input.label === 'string' && input.label.trim()
                    ? input.label.trim().slice(0, 80)
                    : 'agent token',
            tokenHash: hash(token),
            scopes,
            createdAt: new Date().toISOString(),
            ...(expiresAt ? { expiresAt } : {}),
        };
        this.save([...this.records(), record]);
        return { token, record: omitHash(record) };
    }

    revoke(tokenId: string): Omit<AgentControlTokenRecord, 'tokenHash'> | AgentAuthFailure {
        const records = this.records();
        const index = records.findIndex((record) => record.id === tokenId);
        if (index === -1) return failure('not-found', 'Token was not found.', 404);
        records[index] = { ...records[index], revokedAt: new Date().toISOString() };
        this.save(records);
        return omitHash(records[index]);
    }

    rotate(tokenId: string): { token: string; record: Omit<AgentControlTokenRecord, 'tokenHash'> } | AgentAuthFailure {
        const records = this.records();
        const existing = records.find((record) => record.id === tokenId);
        if (!existing || existing.revokedAt) return failure('not-found', 'Active token was not found.', 404);
        existing.revokedAt = new Date().toISOString();
        const token = `iptv_${randomBytes(24).toString('base64url')}`;
        const replacement: AgentControlTokenRecord = {
            ...existing,
            id: randomUUID(),
            tokenHash: hash(token),
            createdAt: new Date().toISOString(),
            revokedAt: undefined,
        };
        this.save([...records, replacement]);
        return { token, record: omitHash(replacement) };
    }

    private records(): AgentControlTokenRecord[] {
        const records = store.get(AGENT_CONTROL_TOKENS, []);
        return Array.isArray(records) ? records : [];
    }

    private save(records: AgentControlTokenRecord[]): void {
        store.set(AGENT_CONTROL_TOKENS, records);
    }
}

function takeBucket(
    buckets: Map<string, RateBucket>,
    key: string,
    now: number
): RateBucket {
    const previous = buckets.get(key);
    const bucket =
        !previous || previous.resetAt <= now
            ? { count: 0, resetAt: now + RATE_WINDOW_MS }
            : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    return bucket;
}

function failure(code: AgentControlErrorCode, message: string, status: number): AgentAuthFailure {
    return { code, message, status, retryable: code === 'rate-limited' };
}

function hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function equalHash(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeScopes(value: unknown): AgentControlScope[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (scope): scope is AgentControlScope =>
            typeof scope === 'string' &&
            (AGENT_CONTROL_SCOPES as readonly string[]).includes(scope)
    );
}

function omitHash({ tokenHash: _tokenHash, ...record }: AgentControlTokenRecord): Omit<AgentControlTokenRecord, 'tokenHash'> {
    return record;
}
