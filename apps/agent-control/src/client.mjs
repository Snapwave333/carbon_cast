const DEFAULT_PORT = 8765;

export const EXIT_CODES = {
    OK: 0,
    USAGE: 2,
    AUTH: 3,
    UNAVAILABLE: 4,
    NOT_FOUND: 5,
    CONFLICT: 6,
    RATE_LIMITED: 7,
    REMOTE_FAILURE: 8,
    INTERNAL: 10,
};

export function createAgentControlClient(options = {}) {
    const baseUrl = (options.baseUrl || process.env.IPTVNATOR_AGENT_CONTROL_URL || `http://127.0.0.1:${process.env.IPTVNATOR_REMOTE_CONTROL_PORT || DEFAULT_PORT}/api/agent-control/v1`).replace(/\/$/, '');
    const token = options.token || process.env.IPTVNATOR_AGENT_TOKEN || '';
    const timeoutMs = options.timeoutMs || 12_000;
    const request = async (path, init = {}, requiresAuth = true) => {
        if (requiresAuth && !token) return unavailable('IPTVNATOR_AGENT_TOKEN is required for live control.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                ...init,
                headers: {
                    Accept: 'application/json',
                    ...(requiresAuth ? { Authorization: `Bearer ${token}` } : {}),
                    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                    ...init.headers,
                },
                signal: controller.signal,
            });
            const payload = await response.json().catch(() => null);
            if (payload && typeof payload === 'object') {
                // An HTTP error whose body is not already a failure result —
                // a wrong base URL hitting an unrelated JSON endpoint, or the
                // loopback-host rejection — must not be reported as success.
                if (!response.ok && payload.success !== false) {
                    return failed(
                        codeForStatus(response.status),
                        `The control bridge returned HTTP ${response.status}: ${describe(payload)}`,
                        response.status >= 500 || response.status === 429
                    );
                }
                return payload;
            }
            return unavailable(`The control bridge returned HTTP ${response.status} with a non-JSON body.`);
        } catch (error) {
            if (error?.name === 'AbortError') {
                return failed(
                    'renderer-timeout',
                    `The control bridge did not answer within ${timeoutMs}ms. Retry the same request with the same --correlation-id.`,
                    true
                );
            }
            return unavailable(error instanceof Error ? error.message : 'The control bridge is unavailable.');
        } finally {
            clearTimeout(timer);
        }
    };
    return {
        // Health is intentionally public so operators can distinguish a down
        // bridge from a missing or expired control token.
        health: () => request('/health', {}, false),
        getState: () => request('/state'),
        command: (operation, params = {}, correlationId = crypto.randomUUID()) => request('/command', {
            method: 'POST',
            body: JSON.stringify({ operation, params, correlationId }),
        }),
        listTokens: () => request('/tokens'),
        createToken: (input) => request('/tokens', { method: 'POST', body: JSON.stringify(input) }),
        revokeToken: (tokenId) => request('/tokens/revoke', { method: 'POST', body: JSON.stringify({ tokenId }) }),
        rotateToken: (tokenId) => request('/tokens/rotate', { method: 'POST', body: JSON.stringify({ tokenId }) }),
        async subscribeEvents(onEvent, { signal } = {}) {
            if (!token) return unavailable('IPTVNATOR_AGENT_TOKEN is required for live control.');
            // Only the handshake is bounded. Once the stream is open it is
            // meant to stay open, so the connect timeout must not abort it.
            const connect = new AbortController();
            const connectTimer = setTimeout(() => connect.abort(), timeoutMs);
            signal?.addEventListener('abort', () => connect.abort(), { once: true });
            try {
                const response = await fetch(`${baseUrl}/events`, {
                    headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
                    signal: connect.signal,
                });
                clearTimeout(connectTimer);
                if (!response.ok || !response.body) {
                    return failed(codeForStatus(response.status), `The event stream returned HTTP ${response.status}.`, true);
                }
                const reader = response.body.getReader();
                signal?.addEventListener('abort', () => void reader.cancel(), { once: true });
                const decoder = new TextDecoder();
                let buffer = '';
                for (;;) {
                    const next = await reader.read();
                    if (next.done) break;
                    buffer += decoder.decode(next.value, { stream: true });
                    const frames = buffer.split('\n\n');
                    buffer = frames.pop() || '';
                    for (const frame of frames) {
                        const event = parseEventFrame(frame);
                        // One malformed frame used to throw out of the read
                        // loop and end the whole subscription.
                        if (event !== undefined) onEvent(event);
                    }
                }
                return { success: true };
            } catch (error) {
                if (signal?.aborted) return { success: true };
                return unavailable(error instanceof Error ? error.message : 'The event stream is unavailable.');
            } finally {
                clearTimeout(connectTimer);
            }
        },
    };
}

export function resultExitCode(result) {
    if (result?.success !== false) return EXIT_CODES.OK;
    switch (result?.error?.code) {
        case 'authentication-required':
        case 'token-expired':
        case 'token-revoked':
        case 'authorization-denied':
            return EXIT_CODES.AUTH;
        case 'agent-control-unavailable':
        case 'renderer-unavailable':
        case 'renderer-timeout':
            return EXIT_CODES.UNAVAILABLE;
        case 'not-found':
            return EXIT_CODES.NOT_FOUND;
        case 'conflict':
            return EXIT_CODES.CONFLICT;
        case 'rate-limited':
            return EXIT_CODES.RATE_LIMITED;
        default:
            return EXIT_CODES.REMOTE_FAILURE;
    }
}

/**
 * Parse one SSE frame. Per the spec a frame may carry several `data:` lines
 * which are joined with newlines; taking only the first truncated any payload
 * that happened to be chunked that way.
 */
export function parseEventFrame(frame) {
    const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
    if (!data) return undefined;
    try {
        return JSON.parse(data);
    } catch {
        return undefined;
    }
}

function codeForStatus(status) {
    if (status === 401) return 'authentication-required';
    if (status === 403) return 'authorization-denied';
    if (status === 404) return 'not-found';
    if (status === 429) return 'rate-limited';
    if (status === 503) return 'renderer-unavailable';
    return 'agent-control-unavailable';
}

function describe(payload) {
    const message = payload?.error?.message ?? payload?.error ?? payload?.message;
    return typeof message === 'string' && message ? message : 'no error detail was returned.';
}

function failed(code, message, retryable) {
    return {
        success: false,
        operation: 'request',
        requested: {},
        timestamp: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        error: { code, message, retryable },
    };
}

function unavailable(message) {
    return failed('agent-control-unavailable', message, true);
}
