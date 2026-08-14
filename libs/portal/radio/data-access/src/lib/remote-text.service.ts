import { Injectable } from '@angular/core';

/**
 * Fetches a text document from an arbitrary host.
 *
 * Podcast RSS feeds live on whatever host the publisher chose, and most of
 * them send no CORS headers, so the renderer cannot read them directly. Under
 * Electron the request is handed to the main process, which is not bound by
 * the same-origin policy and applies the app's SSRF guard. In the browser
 * build there is no such escape hatch: the direct request is still attempted,
 * because a good share of podcast hosts (Simplecast, Art19, Libsyn, Buzzsprout
 * among them) do send `Access-Control-Allow-Origin: *`, and the failure is
 * reported as such when they do not.
 */

const REQUEST_TIMEOUT_MS = 20_000;

type RemoteTextBridge = {
    fetchRemoteText?: (url: string) => Promise<string>;
};

export class RemoteTextUnavailableError extends Error {
    constructor(readonly url: string) {
        super(`The host of ${url} does not allow direct browser requests`);
        this.name = 'RemoteTextUnavailableError';
    }
}

@Injectable({ providedIn: 'root' })
export class RemoteTextService {
    async fetchText(url: string): Promise<string> {
        const bridge = (window as { electron?: RemoteTextBridge }).electron;

        if (typeof bridge?.fetchRemoteText === 'function') {
            return bridge.fetchRemoteText(url);
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
        );

        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/rss+xml, application/xml' },
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(
                    `Request failed: ${response.status} ${response.statusText}`.trim()
                );
            }

            return await response.text();
        } catch (error) {
            // A cross-origin rejection surfaces as an opaque TypeError with no
            // status, which is worth naming rather than passing through.
            if (error instanceof TypeError) {
                throw new RemoteTextUnavailableError(url);
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }
}
