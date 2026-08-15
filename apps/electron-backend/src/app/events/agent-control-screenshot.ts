import { app, BrowserWindow } from 'electron';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Screenshots are written into one app-owned directory and named here rather
 * than taken from the request. An agent-supplied path would be an arbitrary
 * file write through an authenticated HTTP endpoint.
 */
const SCREENSHOT_DIR_NAME = 'agent-screenshots';
/** Keeps a debugging session's captures from growing without bound. */
const MAX_RETAINED_SCREENSHOTS = 40;

export interface AgentScreenshotResult {
    /**
     * Named `file`, not `path`: every bridge response is passed through the
     * credential redactor, which masks any key matching /path/ — so the one
     * value the caller actually needs came back as "[redacted]".
     */
    readonly file: string;
    readonly bytes: number;
    readonly width: number;
    readonly height: number;
    readonly capturedAt: string;
}

function screenshotDirectory(): string {
    return path.join(app.getPath('userData'), SCREENSHOT_DIR_NAME);
}

/** Oldest-first prune; names are timestamped so lexical order is age order. */
async function pruneOldScreenshots(directory: string): Promise<void> {
    const entries = (await readdir(directory)).filter((name) =>
        name.endsWith('.png')
    );
    if (entries.length <= MAX_RETAINED_SCREENSHOTS) {
        return;
    }

    const stale = entries.sort().slice(0, entries.length - MAX_RETAINED_SCREENSHOTS);
    await Promise.all(
        stale.map((name) =>
            rm(path.join(directory, name), { force: true }).catch(() => undefined)
        )
    );
}

/**
 * Captures the app window from the main process.
 *
 * Deliberately does not go through the renderer command channel: the reason to
 * ask for a screenshot is usually that the renderer is not answering, and a
 * capture that needs the renderer to acknowledge it would fail in exactly that
 * case.
 */
export async function captureAgentScreenshot(): Promise<AgentScreenshotResult> {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window || window.isDestroyed()) {
        throw new Error('The CarbonCast IPTV window is unavailable.');
    }

    const image = await window.webContents.capturePage();
    if (image.isEmpty()) {
        throw new Error('The window produced an empty frame.');
    }

    const directory = screenshotDirectory();
    await mkdir(directory, { recursive: true });

    const capturedAt = new Date();
    // Two captures inside the same millisecond would otherwise share a name and
    // the second would overwrite the first.
    const fileName = `${capturedAt.toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}.png`;
    const target = path.join(directory, fileName);
    const png = image.toPNG();
    await writeFile(target, png);
    await pruneOldScreenshots(directory).catch(() => undefined);

    const { width, height } = image.getSize();
    return {
        file: target,
        bytes: png.byteLength,
        width,
        height,
        capturedAt: capturedAt.toISOString(),
    };
}
