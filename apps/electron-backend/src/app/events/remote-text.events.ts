import { ipcMain } from 'electron';
import { FETCH_REMOTE_TEXT } from '@iptvnator/shared/interfaces';
import { requestWithValidatedRedirects } from '../util/validated-axios';

/**
 * Fetches a text document on behalf of the renderer.
 *
 * Podcast RSS feeds are hosted wherever the publisher chose and almost never
 * send CORS headers, so the renderer cannot read them. This handler is the
 * escape hatch — deliberately narrow: public hosts only (the SSRF guard in
 * `validateRemoteUrl` rejects loopback, private and reserved targets, and
 * re-checks every redirect), GET only, no request headers from the renderer,
 * and a size cap so a hostile host cannot exhaust memory.
 */

const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

export async function fetchRemoteText(url: string): Promise<string> {
    if (typeof url !== 'string' || !url.trim()) {
        throw new Error('A URL is required');
    }

    const response = await requestWithValidatedRedirects<string>(
        url.trim(),
        {
            method: 'GET',
            responseType: 'text',
            timeout: REQUEST_TIMEOUT_MS,
            maxContentLength: MAX_DOCUMENT_BYTES,
            maxBodyLength: MAX_DOCUMENT_BYTES,
            headers: {
                Accept: 'application/rss+xml, application/xml, text/xml, */*',
            },
            transitional: { forcedJSONParsing: false },
        },
        { allowPrivateNetworks: false }
    );

    return typeof response.data === 'string'
        ? response.data
        : String(response.data ?? '');
}

export default class RemoteTextEvents {
    static bootstrapRemoteTextEvents(): Electron.IpcMain {
        return ipcMain;
    }
}

ipcMain.handle(FETCH_REMOTE_TEXT, (_event, url: string) =>
    fetchRemoteText(url)
);
