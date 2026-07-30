import path from 'node:path';
import { Worker } from 'node:worker_threads';

const WORKER_TIMEOUT_MS = 60_000;

interface EpgParserWorkerResult {
    readonly type: 'EPG_COMPLETE' | 'EPG_ERROR';
    readonly result?: unknown;
    readonly error?: string;
}

/**
 * Parses an XMLTV EPG payload in a dedicated worker thread so the large
 * gunzip + parse never blocks the Express event loop. The `buffer` is
 * transferred (zero-copy) into the worker and is therefore detached in the
 * caller once this returns.
 */
export function parseEpgInWorker(
    buffer: ArrayBuffer,
    gzipped: boolean
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        // Resolve the worker next to this module using the same extension as
        // the current file: `.ts` under the tsx dev serve, `.cjs` once bundled
        // (the client is inlined into main.cjs, so __filename ends in `.cjs`).
        const workerPath = path.join(
            __dirname,
            'epg-parser.worker' + path.extname(__filename)
        );
        const worker = new Worker(workerPath, {
            workerData: { buffer, gzipped },
            transferList: [buffer],
            // A `.ts` worker only loads when the child runtime registers tsx;
            // the bundled `.js` worker must not add the flag.
            ...(workerPath.endsWith('.ts')
                ? { execArgv: ['--import', 'tsx'] }
                : {}),
        });

        let settled = false;
        const settle = (fn: () => void): void => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeoutId);
            void worker.terminate().finally(fn);
        };

        const timeoutId = setTimeout(() => {
            settle(() =>
                reject(new Error('EPG parsing timed out after 60s'))
            );
        }, WORKER_TIMEOUT_MS);

        worker.once('message', (message: EpgParserWorkerResult) => {
            if (message.type === 'EPG_COMPLETE') {
                settle(() => resolve(message.result));
                return;
            }
            settle(() =>
                reject(new Error(message.error ?? 'EPG parsing failed'))
            );
        });

        worker.once('error', (error) => {
            settle(() => reject(error));
        });

        worker.once('exit', (code) => {
            if (settled) {
                return;
            }
            settle(() =>
                reject(
                    new Error(`EPG worker stopped unexpectedly (exit code ${code})`)
                )
            );
        });
    });
}
