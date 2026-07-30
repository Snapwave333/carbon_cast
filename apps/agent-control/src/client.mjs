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
    const request = async (path, init = {}) => {
        if (!token) return unavailable('IPTVNATOR_AGENT_TOKEN is required for live control.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${baseUrl}${path}`, {
                ...init,
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                    ...init.headers,
                },
                signal: controller.signal,
            });
            const payload = await response.json().catch(() => null);
            if (payload && typeof payload === 'object') return payload;
            return unavailable(`The control bridge returned HTTP ${response.status}.`);
        } catch (error) {
            return unavailable(error instanceof Error ? error.message : 'The control bridge is unavailable.');
        } finally {
            clearTimeout(timer);
        }
    };
    return {
        health: () => request('/health'),
        getState: () => request('/state'),
        command: (operation, params = {}, correlationId = crypto.randomUUID()) => request('/command', {
            method: 'POST',
            body: JSON.stringify({ operation, params, correlationId }),
        }),
        listTokens: () => request('/tokens'),
        createToken: (input) => request('/tokens', { method: 'POST', body: JSON.stringify(input) }),
        revokeToken: (tokenId) => request('/tokens/revoke', { method: 'POST', body: JSON.stringify({ tokenId }) }),
        rotateToken: (tokenId) => request('/tokens/rotate', { method: 'POST', body: JSON.stringify({ tokenId }) }),
        async subscribeEvents(onEvent) {
            if (!token) return unavailable('IPTVNATOR_AGENT_TOKEN is required for live control.');
            try {
                const response = await fetch(`${baseUrl}/events`, {
                    headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
                });
                if (!response.ok || !response.body) return unavailable(`The event stream returned HTTP ${response.status}.`);
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                for (;;) {
                    const next = await reader.read();
                    if (next.done) break;
                    buffer += decoder.decode(next.value, { stream: true });
                    const frames = buffer.split('\n\n');
                    buffer = frames.pop() || '';
                    for (const frame of frames) {
                        const data = frame.split('\n').find((line) => line.startsWith('data: '));
                        if (data) onEvent(JSON.parse(data.slice(6)));
                    }
                }
                return { success: true };
            } catch (error) {
                return unavailable(error instanceof Error ? error.message : 'The event stream is unavailable.');
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
        case 'rate-limited':
            return EXIT_CODES.RATE_LIMITED;
        default:
            return EXIT_CODES.REMOTE_FAILURE;
    }
}

function unavailable(message) {
    return {
        success: false,
        operation: 'request',
        requested: {},
        timestamp: new Date().toISOString(),
        correlationId: crypto.randomUUID(),
        error: { code: 'agent-control-unavailable', message, retryable: true },
    };
}
