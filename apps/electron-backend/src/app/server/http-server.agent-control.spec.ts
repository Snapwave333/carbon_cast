import { once } from 'node:events';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

import {
    HttpServer,
    isAllowedAgentControlHost,
    requestPathname,
} from './http-server';

jest.setTimeout(15_000);

describe('requestPathname', () => {
    it.each([
        ['/api/agent-control/v1/health', '/api/agent-control/v1/health'],
        ['/api/agent-control/v1/health?pretty=1', '/api/agent-control/v1/health'],
        ['/api/agent-control/v1/health#frag', '/api/agent-control/v1/health'],
        ['/api/agent-control/v1/health/', '/api/agent-control/v1/health'],
        ['/', '/'],
    ])('reduces %s to %s', (target, expected) => {
        expect(requestPathname(target)).toBe(expected);
    });
});

describe('isAllowedAgentControlHost', () => {
    it.each(['127.0.0.1:8765', 'localhost', 'LOCALHOST:8765', '[::1]:8765'])(
        'allows the loopback host %s',
        (host) => {
            expect(isAllowedAgentControlHost(host, '')).toBe(true);
        }
    );

    it.each(['rebound.example', 'rebound.example:8765', '192.168.1.4:8765', undefined])(
        'rejects the non-loopback host %s',
        (host) => {
            expect(isAllowedAgentControlHost(host, '')).toBe(false);
        }
    );

    it('honours an explicit allow list for deliberate remote automation', () => {
        expect(
            isAllowedAgentControlHost('studio.lan:8765', 'studio.lan, other.lan')
        ).toBe(true);
    });
});

describe('HttpServer agent-control routing', () => {
    let server: HttpServer;
    let node: http.Server | undefined;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        server = new HttpServer({
            createServer: (listener) => {
                node = http.createServer(listener);
                return node;
            },
            distPath: __dirname,
        });
    });

    afterEach(async () => {
        if (node?.listening) {
            node.close();
            await once(node, 'close');
        }
        node = undefined;
        jest.restoreAllMocks();
    });

    async function start(): Promise<number> {
        server.start(0);
        await once(node as http.Server, 'listening');
        return ((node as http.Server).address() as AddressInfo).port;
    }

    it('serves an agent-control request from a loopback Host', async () => {
        server.registerAgentControlHandler(
            '/api/agent-control/v1/health',
            (_req, res) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"ready":true}');
            }
        );
        const port = await start();

        const response = await get(port, '/api/agent-control/v1/health');

        expect(response.statusCode).toBe(200);
        expect(response.body).toBe('{"ready":true}');
    });

    it('routes an agent-control request that carries a query string', async () => {
        let handled = false;
        server.registerAgentControlHandler(
            '/api/agent-control/v1/state',
            (_req, res) => {
                handled = true;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{}');
            }
        );
        const port = await start();

        const response = await get(port, '/api/agent-control/v1/state?pretty=1');

        expect(handled).toBe(true);
        expect(response.statusCode).toBe(200);
    });

    it('rejects a rebound Host before the handler runs', async () => {
        let handled = false;
        server.registerAgentControlHandler(
            '/api/agent-control/v1/health',
            (_req, res) => {
                handled = true;
                res.end('{}');
            }
        );
        const port = await start();

        const response = await get(port, '/api/agent-control/v1/health', {
            Host: 'rebound.example',
        });

        expect(handled).toBe(false);
        expect(response.statusCode).toBe(403);
    });
});

function get(
    port: number,
    path: string,
    headers?: http.OutgoingHttpHeaders
): Promise<{ body: string; statusCode: number | undefined }> {
    return new Promise((resolve, reject) => {
        const clientRequest = http.request(
            { host: '127.0.0.1', method: 'GET', path, port, ...(headers ? { headers } : {}) },
            (response) => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => {
                    body += chunk;
                });
                response.on('end', () =>
                    resolve({ body, statusCode: response.statusCode })
                );
                response.on('error', reject);
            }
        );
        clientRequest.on('error', reject);
        clientRequest.end();
    });
}
