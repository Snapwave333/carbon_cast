import * as http from 'node:http';

export const BODY_LIMIT_BYTES = 64 * 1024;
/**
 * A request that opens a body and then stalls holds a socket and a handler
 * closure open forever, so the read is bounded in time as well as in size.
 */
export const BODY_TIMEOUT_MS = 10_000;

export interface BodyRejection {
    code: 'invalid-request';
    message: string;
    status: number;
}

/**
 * Read a bounded JSON request body. Shared by the command and token routes so
 * the size cap, the read timeout, and — importantly — the `error` listener
 * exist in exactly one place. Without that listener an aborted request emits
 * `error` on the `IncomingMessage` with nothing attached, which takes the whole
 * Electron main process down.
 */
export function readJsonBody(
    req: http.IncomingMessage,
    onBody: (body: unknown) => void | Promise<void>,
    onReject: (rejection: BodyRejection) => void
): void {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const settle = (run: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        run();
    };
    const reject = (message: string, status: number): void =>
        settle(() => onReject({ code: 'invalid-request', message, status }));

    const timer = setTimeout(() => {
        reject('Request body was not received in time.', 408);
        req.destroy();
    }, BODY_TIMEOUT_MS);

    req.on('data', (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;
        if (size > BODY_LIMIT_BYTES) {
            reject('Request body is too large.', 413);
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('error', () => settle(() => undefined));
    req.on('aborted', () => settle(() => undefined));
    req.on('end', () => {
        settle(() => {
            let parsed: unknown;
            try {
                parsed = JSON.parse(
                    Buffer.concat(chunks).toString('utf8') || '{}'
                );
            } catch {
                onReject({
                    code: 'invalid-request',
                    message: 'Request body must be valid JSON.',
                    status: 400,
                });
                return;
            }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                onReject({
                    code: 'invalid-request',
                    message: 'Request body must be a JSON object.',
                    status: 400,
                });
                return;
            }
            void onBody(parsed);
        });
    });
}
