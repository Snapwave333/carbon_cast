import { gzipSync } from 'node:zlib';
import { parseEpgInWorker } from './epg-parse-worker-client';

interface ParsedEpg {
    readonly channels: Array<{ readonly id: string }>;
    readonly programs: Array<{ readonly channel: string }>;
}

const SAMPLE_XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
    <channel id="c1"><display-name>Chan One</display-name></channel>
    <programme start="20260101000000 +0000" stop="20260101010000 +0000" channel="c1">
        <title>Show</title>
    </programme>
</tv>`;

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
}

describe('parseEpgInWorker', () => {
    it('parses plain XMLTV into channels and programs', async () => {
        const result = (await parseEpgInWorker(
            toArrayBuffer(Buffer.from(SAMPLE_XMLTV, 'utf-8')),
            false
        )) as ParsedEpg;

        expect(result.channels).toHaveLength(1);
        expect(result.channels[0].id).toBe('c1');
        expect(result.programs).toHaveLength(1);
        expect(result.programs[0].channel).toBe('c1');
    }, 30000);

    it('gunzips and parses gzipped XMLTV', async () => {
        const result = (await parseEpgInWorker(
            toArrayBuffer(gzipSync(Buffer.from(SAMPLE_XMLTV, 'utf-8'))),
            true
        )) as ParsedEpg;

        expect(result.channels).toHaveLength(1);
        expect(result.programs).toHaveLength(1);
    }, 30000);

    it('rejects when the payload is flagged gzipped but is not', async () => {
        await expect(
            parseEpgInWorker(
                toArrayBuffer(Buffer.from(SAMPLE_XMLTV, 'utf-8')),
                true
            )
        ).rejects.toThrow();
    }, 30000);
});
