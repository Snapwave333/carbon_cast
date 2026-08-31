import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('./main.mjs', import.meta.url));

test('health succeeds without a token and does not send one', async () => {
    let authorization;
    await withBridge(async (request, response) => {
        authorization = request.headers.authorization;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ready: true, version: 1 }));
    }, async (url) => {
        const result = await runCli(['health', '--url', url, '--json']);

        assert.equal(result.code, 0);
        assert.deepEqual(JSON.parse(result.stdout), { ready: true, version: 1 });
    });
    assert.equal(authorization, undefined);
});

test('forwards an explicit retry id and confirm marker on a live write', async () => {
    let requestBody;
    let authorization;
    await withBridge(async (request, response) => {
        authorization = request.headers.authorization;
        requestBody = JSON.parse(await readBody(request));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, operation: 'player.setMuted' }));
    }, async (url) => {
        const result = await runCli([
            'player', 'mute', 'true', '--confirm', '--correlation-id', 'retry-123',
            '--token', 'test-token', '--url', url, '--json',
        ]);

        assert.equal(result.code, 0);
        assert.deepEqual(JSON.parse(result.stdout), { success: true, operation: 'player.setMuted' });
    });
    assert.equal(authorization, 'Bearer test-token');
    assert.deepEqual(requestBody, {
        operation: 'player.setMuted',
        params: { muted: true, confirm: true },
        correlationId: 'retry-123',
    });
});

test('rejects malformed values, missing targets, and unknown flags before a live request', async () => {
    const cases = [
        ['player', 'mute', 'banana', '--dry-run', '--json'],
        ['channels', 'switch', '--dry-run', '--json'],
        ['player', 'state', '--bogus', '--json'],
    ];

    for (const args of cases) {
        const result = await runCli(args);
        assert.equal(result.code, 2, args.join(' '));
        // Diagnostics go to stderr so `--json` stdout stays machine-parseable.
        assert.match(result.stderr, /^Usage error:/, args.join(' '));
        assert.equal(result.stdout, '', args.join(' '));
    }
});

test('names the available commands when a known group gets an unknown one', async () => {
    const result = await runCli(['player', 'teleport', '--json']);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown player command: teleport/);
    assert.match(result.stderr, /fullscreen/);
});

test('previews the app lifecycle, display, and window control writes without contacting the bridge', async () => {
    const cases = [
        {
            args: ['app', 'launch', '--app-path', 'C:\\CarbonCast IPTV.exe', '--dry-run', '--json'],
            operation: 'app.launch',
            params: { appPath: 'C:\\CarbonCast IPTV.exe' },
        },
        {
            args: ['app', 'display', 'move', '--next', '--dry-run', '--json'],
            operation: 'app.display.move',
            params: { next: true },
        },
        {
            args: ['app', 'window', 'fullscreen', 'true', '--dry-run', '--json'],
            operation: 'app.window.set',
            params: { state: 'fullscreen' },
        },
        {
            args: ['app', 'quit', '--dry-run', '--json'],
            operation: 'app.quit',
            params: {},
        },
    ];

    for (const item of cases) {
        const result = await runCli(item.args);
        assert.equal(result.code, 0, item.args.join(' '));
        assert.deepEqual(JSON.parse(result.stdout), {
            dryRun: true,
            operation: item.operation,
            params: item.params,
        });
    }
});

test('resolves app launch from CARBONCAST_HOME instead of the caller directory', async () => {
    const result = await runCli(
        ['app', 'launch', '--dry-run', '--json'],
        { CARBONCAST_HOME: 'C:\\CarbonCast' }
    );

    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
        dryRun: true,
        operation: 'app.launch',
        params: { appPath: 'C:\\CarbonCast\\dist\\executables\\win-unpacked\\CarbonCast IPTV.exe' },
    });
});

test('forwards display list as the read-only app.display.list operation', async () => {
    let requestBody;
    await withBridge(async (request, response) => {
        requestBody = JSON.parse(await readBody(request));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, operation: 'app.display.list' }));
    }, async (url) => {
        const result = await runCli(['app', 'display', 'list', '--token', 'test-token', '--url', url, '--json']);
        assert.equal(result.code, 0);
        assert.deepEqual(JSON.parse(result.stdout), { success: true, operation: 'app.display.list' });
    });
    assert.deepEqual(requestBody, {
        operation: 'app.display.list',
        params: {},
        correlationId: requestBody.correlationId,
    });
    assert.equal(typeof requestBody.correlationId, 'string');
});

test('reports an HTTP failure whose body is not a control result as a failure', async () => {
    await withBridge(async (_request, response) => {
        response.writeHead(403, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Agent control is restricted to loopback hosts.' }));
    }, async (url) => {
        const result = await runCli(['player', 'state', '--token', 'test-token', '--url', url, '--json']);

        // Previously a bodied HTTP error with no `success` field exited 0.
        assert.notEqual(result.code, 0);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.success, false);
        assert.equal(payload.error.code, 'authorization-denied');
        assert.match(payload.error.message, /loopback/);
    });
});

async function withBridge(handler, run) {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    try {
        await run(`http://127.0.0.1:${address.port}/api/agent-control/v1`);
    } finally {
        server.close();
        await once(server, 'close');
    }
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => { body += chunk; });
        request.once('end', () => resolve(body));
        request.once('error', reject);
    });
}

function runCli(args, environment = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cliPath, ...args], {
            env: { ...process.env, ...environment, IPTVNATOR_AGENT_TOKEN: '' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.once('error', reject);
        child.once('close', (code) => resolve({ code, stdout, stderr }));
    });
}
