import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentControlClient, EXIT_CODES, parseEventFrame, resultExitCode } from './client.mjs';

test('joins multi-line SSE data and skips a malformed frame', () => {
    assert.deepEqual(
        parseEventFrame('event: state.changed\ndata: {"ready"\ndata: :true}'),
        { ready: true }
    );
    assert.equal(parseEventFrame('event: ping\ndata: not-json'), undefined);
    assert.equal(parseEventFrame(': heartbeat'), undefined);
});

test('maps an HTTP error body that is not a control result to a failure', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: 'Endpoint not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        const client = createAgentControlClient({
            baseUrl: 'http://127.0.0.1:8765/api/agent-control/v1',
            token: 'test-token',
        });
        const result = await client.getState();

        assert.equal(result.success, false);
        assert.equal(result.error.code, 'not-found');
        assert.equal(resultExitCode(result), EXIT_CODES.NOT_FOUND);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('requires a token before a live request is attempted', async () => {
    const client = createAgentControlClient({ token: '' });

    const result = await client.getState();

    assert.equal(result.success, false);
    assert.equal(result.error.code, 'agent-control-unavailable');
    assert.equal(resultExitCode(result), EXIT_CODES.UNAVAILABLE);
});

test('checks the public bridge health endpoint without a bearer token', async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, init) => {
        request = { url, init };
        return new Response(
            JSON.stringify({ ready: true, version: 1 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    };

    try {
        const client = createAgentControlClient({
            baseUrl: 'http://127.0.0.1:8765/api/agent-control/v1',
            token: '',
        });
        const result = await client.health();

        assert.deepEqual(result, { ready: true, version: 1 });
        assert.equal(request.url, 'http://127.0.0.1:8765/api/agent-control/v1/health');
        assert.equal(request.init.headers.Authorization, undefined);
    } finally {
        globalThis.fetch = originalFetch;
    }
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
