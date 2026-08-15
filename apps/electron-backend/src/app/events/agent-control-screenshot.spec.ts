import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const userDataDir = mkdtempSync(join(tmpdir(), 'agent-screenshot-'));
const capturePage = jest.fn();
const windows: unknown[] = [];

jest.mock('electron', () => ({
    app: { getPath: () => userDataDir },
    BrowserWindow: { getAllWindows: () => windows },
}));

import { captureAgentScreenshot } from './agent-control-screenshot';

function image(width = 1280, height = 720, bytes = Buffer.from('png-bytes')) {
    return {
        isEmpty: () => false,
        getSize: () => ({ width, height }),
        toPNG: () => bytes,
    };
}

function addWindow(destroyed = false) {
    windows.splice(0, windows.length, {
        isDestroyed: () => destroyed,
        webContents: { capturePage },
    });
}

describe('captureAgentScreenshot', () => {
    beforeEach(() => {
        capturePage.mockReset();
        windows.splice(0, windows.length);
    });

    it('writes the capture into the app-owned directory and reports it', async () => {
        addWindow();
        capturePage.mockResolvedValue(image());

        const result = await captureAgentScreenshot();

        expect(result.file.startsWith(join(userDataDir, 'agent-screenshots'))).toBe(
            true
        );
        expect(result.file.endsWith('.png')).toBe(true);
        expect(result).toMatchObject({ width: 1280, height: 720, bytes: 9 });
        expect(readdirSync(join(userDataDir, 'agent-screenshots'))).toContain(
            result.file.split(/[\\/]/).pop()
        );
    });

    it('names files so no request can choose the write location', async () => {
        addWindow();
        capturePage.mockResolvedValue(image());

        const first = await captureAgentScreenshot();
        const second = await captureAgentScreenshot();

        // Timestamped, colon-free names: an agent-supplied path would be an
        // arbitrary file write through an authenticated endpoint.
        expect(first.file).not.toBe(second.file);
        for (const result of [first, second]) {
            const name = result.file.split(/[\\/]/).pop() ?? '';
            expect(name).toMatch(/^[0-9TZ-]+-[0-9a-f]{6}\.png$/);
        }
    });

    it('prunes the oldest captures so a session cannot fill the disk', async () => {
        addWindow();
        capturePage.mockResolvedValue(image());
        const directory = join(userDataDir, 'agent-screenshots');
        await captureAgentScreenshot();
        for (let index = 0; index < 45; index += 1) {
            writeFileSync(
                join(directory, `2000-01-01T00-00-${String(index).padStart(2, '0')}-000Z.png`),
                'old'
            );
        }

        await captureAgentScreenshot();

        expect(readdirSync(directory).length).toBeLessThanOrEqual(40);
    });

    it('reports an unavailable window instead of throwing a bare error', async () => {
        await expect(captureAgentScreenshot()).rejects.toThrow(
            'window is unavailable'
        );

        addWindow(true);
        await expect(captureAgentScreenshot()).rejects.toThrow(
            'window is unavailable'
        );
    });

    it('rejects an empty frame rather than writing a zero-byte png', async () => {
        addWindow();
        capturePage.mockResolvedValue({
            isEmpty: () => true,
            getSize: () => ({ width: 0, height: 0 }),
            toPNG: () => Buffer.alloc(0),
        });

        await expect(captureAgentScreenshot()).rejects.toThrow('empty frame');
    });
});
