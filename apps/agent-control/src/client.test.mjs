import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentControlClient, EXIT_CODES, resultExitCode } from './client.mjs';

test('requires a token before a live request is attempted', async () => {
    const client = createAgentControlClient({ token: '' });

    const result = await client.getState();

    assert.equal(result.success, false);
    assert.equal(result.error.code, 'agent-control-unavailable');
    assert.equal(resultExitCode(result), EXIT_CODES.UNAVAILABLE);
});

test('forwards a correlation id and bearer token to the shared bridge', async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, init) => {
        request = { url, init };
        return new Response(
            JSON.stringify({ success: true, operation: 'player.pause' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    };

    try {
        const client = createAgentControlClient({
            baseUrl: 'http://127.0.0.1:8765/api/agent-control/v1',
            token: 'test-token',
        });
        const result = await client.command(
            'player.pause',
            {},
            'correlation-123'
        );

        assert.equal(result.success, true);
        assert.equal(request.url, 'http://127.0.0.1:8765/api/agent-control/v1/command');
        assert.equal(request.init.headers.Authorization, 'Bearer test-token');
        assert.deepEqual(JSON.parse(request.init.body), {
            operation: 'player.pause',
            params: {},
            correlationId: 'correlation-123',
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});
