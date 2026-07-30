import zlib from 'node:zlib';
import { parentPort, workerData } from 'node:worker_threads';
import epgParser from 'epg-parser';

interface EpgParserWorkerData {
    readonly buffer: ArrayBuffer;
    readonly gzipped: boolean;
}

interface EpgParserWorkerResult {
    readonly type: 'EPG_COMPLETE' | 'EPG_ERROR';
    readonly result?: unknown;
    readonly error?: string;
}

function decodeXml({ buffer, gzipped }: EpgParserWorkerData): string {
    const bytes = Buffer.from(buffer);
    return gzipped ? zlib.gunzipSync(bytes).toString() : bytes.toString();
}

const loggerLabel = '[EPG Parse Worker]';

if (parentPort) {
    try {
        const xml = decodeXml(workerData as EpgParserWorkerData);
        const message: EpgParserWorkerResult = {
            type: 'EPG_COMPLETE',
            result: epgParser.parse(xml),
        };
        parentPort.postMessage(message);
    } catch (error) {
        const message: EpgParserWorkerResult = {
            type: 'EPG_ERROR',
            error: error instanceof Error ? error.message : String(error),
        };
        parentPort.postMessage(message);
    }
} else {
    console.error(loggerLabel, 'parentPort is not available!');
}
