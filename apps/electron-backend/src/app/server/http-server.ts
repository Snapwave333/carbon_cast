import { app } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

type HttpServerFactory = (requestListener: http.RequestListener) => http.Server;

interface HttpServerOptions {
    createServer?: HttpServerFactory;
    distPath?: string;
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Strip the query string and fragment so a handler registered for
 * `/api/agent-control/v1/health` still answers `/health?pretty=1`. The router
 * matches on the exact string, so without this a perfectly valid request 404s.
 */
export function requestPathname(requestTarget: string): string {
    const separatorIndex = requestTarget.search(/[?#]/);
    const pathname =
        separatorIndex === -1
            ? requestTarget
            : requestTarget.slice(0, separatorIndex);
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
}

/**
 * The agent-control bridge is a machine-to-machine API for local automation,
 * but the HTTP server itself listens on every interface so phones can reach the
 * remote-control web app. Pinning the bridge to loopback `Host` values is the
 * standard DNS-rebinding mitigation: a rebound page reaches the socket but
 * sends `Host: attacker.example`, which is rejected before authentication.
 * `IPTVNATOR_AGENT_CONTROL_ALLOWED_HOSTS` opts specific hostnames back in for
 * deliberate remote automation.
 */
export function isAllowedAgentControlHost(
    hostHeader: string | undefined,
    allowList = process.env.IPTVNATOR_AGENT_CONTROL_ALLOWED_HOSTS
): boolean {
    if (!hostHeader) return false;
    const hostname = hostHeader
        .trim()
        .toLowerCase()
        .replace(/:\d+$/, '');
    if (LOOPBACK_HOSTNAMES.has(hostname)) return true;
    return (allowList ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .includes(hostname);
}

/**
 * Resolve an HTTP request target within the configured static root.
 * The path implementation is injectable so platform-specific semantics remain testable.
 */
export function resolveStaticFilePath(
    staticRoot: string,
    requestTarget: string,
    pathImplementation: path.PlatformPath = path
): string | null {
    const separatorIndex = requestTarget.search(/[?#]/);
    const encodedPathname =
        separatorIndex === -1
            ? requestTarget
            : requestTarget.slice(0, separatorIndex);

    let pathname: string;
    try {
        pathname = decodeURIComponent(encodedPathname);
    } catch {
        return null;
    }

    if (pathname.includes('\0')) {
        return null;
    }

    const relativeCandidate = pathname.replace(/^[/\\]+/, '') || 'index.html';
    const resolvedRoot = pathImplementation.resolve(staticRoot);
    const candidate = pathImplementation.resolve(
        resolvedRoot,
        relativeCandidate
    );

    if (
        candidate === resolvedRoot ||
        candidate.startsWith(`${resolvedRoot}${pathImplementation.sep}`)
    ) {
        return candidate;
    }

    return null;
}

/**
 * HTTP server for serving the remote control web app and providing REST API endpoints
 */
export class HttpServer {
    private readonly createServer: HttpServerFactory;
    private server: http.Server | null = null;
    private port = 8765;
    private isEnabled = false;
    private distPath: string | null = null;
    private remoteControlHandlers: Map<
        string,
        (req: http.IncomingMessage, res: http.ServerResponse) => void
    > = new Map();
    private agentControlHandlers: Map<
        string,
        (req: http.IncomingMessage, res: http.ServerResponse) => void
    > = new Map();

    constructor(options: HttpServerOptions = {}) {
        this.createServer = options.createServer ?? http.createServer;
        this.distPath = options.distPath ?? null;
    }

    /**
     * Get the path to the remote-control-web static files.
     * Lazily computed to avoid calling Electron APIs before app is ready.
     */
    private getDistPath(): string {
        if (this.distPath) {
            return this.distPath;
        }

        // Path to the built remote-control-web app
        // In development: use workspace root
        // In production: use app path
        const appPath = app.getAppPath();
        const isDev = !app.isPackaged;

        if (isDev) {
            // Development mode - use workspace root
            this.distPath = path.join(
                process.cwd(),
                'dist',
                'apps',
                'remote-control-web',
                'browser'
            );
        } else {
            // Production mode - files are bundled with the app
            // electron-builder copies remote-control-web/**/* directly to app root
            this.distPath = path.join(appPath, 'remote-control-web', 'browser');
        }

        console.log('[HTTP Server] Serving from:', this.distPath);
        return this.distPath;
    }

    /**
     * Start the HTTP server
     */
    start(port?: number): void {
        if (port !== undefined) {
            this.port = port;
        }

        if (this.server) {
            console.log('HTTP server is already running');
            return;
        }

        this.server = this.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
            console.log(`HTTP server listening on port ${this.port}`);
            console.log(
                `Remote control available at: http://localhost:${this.port}`
            );
        });

        this.isEnabled = true;
    }

    /**
     * Stop the HTTP server
     */
    stop(): void {
        if (!this.server) {
            return;
        }

        this.server.close(() => {
            console.log('HTTP server stopped');
        });

        this.server = null;
        this.isEnabled = false;
    }

    /**
     * Update server settings
     */
    updateSettings(enabled: boolean, port: number): void {
        const needsRestart = this.isEnabled && enabled && this.port !== port;

        if (!enabled && this.isEnabled) {
            this.stop();
        } else if (enabled && !this.isEnabled) {
            this.start(port);
        } else if (needsRestart) {
            this.stop();
            this.start(port);
        }
    }

    /**
     * Register a handler for remote control API endpoints
     */
    registerRemoteControlHandler(
        path: string,
        handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
    ): void {
        this.remoteControlHandlers.set(path, handler);
    }

    /** Register an authenticated agent-control endpoint. */
    registerAgentControlHandler(
        path: string,
        handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
    ): void {
        this.agentControlHandlers.set(path, handler);
    }

    /**
     * Handle incoming HTTP requests
     */
    private handleRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ): void {
        const url = req.url || '/';
        const pathname = requestPathname(url);

        // Handle API requests
        if (pathname.startsWith('/api/remote-control/')) {
            const handler = this.remoteControlHandlers.get(pathname);
            if (handler) {
                handler(req, res);
                return;
            }

            this.notFound(res);
            return;
        }

        if (pathname.startsWith('/api/agent-control/')) {
            if (!isAllowedAgentControlHost(req.headers.host)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(
                    JSON.stringify({
                        error: 'Agent control is restricted to loopback hosts.',
                    })
                );
                return;
            }

            const handler = this.agentControlHandlers.get(pathname);
            if (handler) {
                handler(req, res);
                return;
            }

            this.notFound(res);
            return;
        }

        // Serve static files from the remote-control-web app
        this.serveStaticFile(url, res);
    }

    private notFound(res: http.ServerResponse): void {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                success: false,
                error: { code: 'not-found', message: 'Endpoint not found.' },
            })
        );
    }

    /**
     * Serve static files
     */
    private serveStaticFile(url: string, res: http.ServerResponse): void {
        const distPath = this.getDistPath();
        const fullPath = resolveStaticFilePath(distPath, url);
        if (!fullPath) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        fs.readFile(fullPath, (err, data) => {
            if (err) {
                // If file not found, try serving index.html (for Angular routing)
                if (
                    err.code === 'ENOENT' &&
                    fullPath !== path.resolve(distPath, 'index.html')
                ) {
                    this.serveStaticFile('/', res);
                    return;
                }

                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }

            // Determine content type
            const contentType = this.getContentType(fullPath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
        };

        return contentTypes[ext] || 'application/octet-stream';
    }
}

export const httpServer = new HttpServer();
