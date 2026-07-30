#!/usr/bin/env node
// IPTVnator MCP server — stdio transport, zero external dependencies.
//
// Speaks the Model Context Protocol over newline-delimited JSON-RPC 2.0 on
// stdin/stdout (the MCP stdio transport). Exposes read-only tools over the
// IPTVnator SQLite database via node:sqlite. Spawnable by any MCP client
// (e.g. Ember) with:  node apps/mcp-server/src/main.mjs
//
// IMPORTANT: stdout carries ONLY protocol messages. All logging goes to stderr.
import { createInterface } from 'node:readline';
import { tools, callTool } from './tools.mjs';

const SERVER_INFO = { name: 'iptvnator', version: '0.1.0' };
const DEFAULT_PROTOCOL = '2025-06-18';

const log = (...a) => process.stderr.write(`[iptvnator-mcp] ${a.join(' ')}\n`);
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

async function handle(msg) {
    const { id, method, params } = msg;
    const isRequest = id !== undefined && id !== null;

    switch (method) {
        case 'initialize': {
            const protocolVersion = params?.protocolVersion || DEFAULT_PROTOCOL;
            return reply(id, {
                protocolVersion,
                capabilities: { tools: { listChanged: false } },
                serverInfo: SERVER_INFO,
            });
        }
        case 'notifications/initialized':
        case 'notifications/cancelled':
            return; // notifications: no response
        case 'ping':
            return isRequest && reply(id, {});
        case 'tools/list':
            return reply(id, { tools });
        case 'tools/call': {
            const name = params?.name;
            try {
                const result = await callTool(name, params?.arguments);
                return reply(id, {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                });
            } catch (err) {
                // Tool errors are reported in-band (isError), per MCP guidance.
                return reply(id, {
                    content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }],
                    isError: true,
                });
            }
        }
        default:
            if (isRequest) fail(id, -32601, `Method not found: ${method}`);
            return;
    }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    let msg;
    try {
        msg = JSON.parse(text);
    } catch {
        log('failed to parse line:', text.slice(0, 120));
        return;
    }
    try {
        void handle(msg).catch((err) => {
            log('handler error:', err?.message || String(err));
            if (msg?.id !== undefined && msg?.id !== null)
                fail(msg.id, -32603, 'Internal error');
        });
    } catch (err) {
        log('handler error:', err?.message || String(err));
        if (msg?.id !== undefined && msg?.id !== null) fail(msg.id, -32603, 'Internal error');
    }
});
rl.on('close', () => process.exit(0));

log(`ready — ${tools.length} tools, db=${process.env.IPTVNATOR_DB_PATH || 'default'}`);
