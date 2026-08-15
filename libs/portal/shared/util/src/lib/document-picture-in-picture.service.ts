import { Injectable } from '@angular/core';

/**
 * Pops a live piece of the UI out into a floating always-on-top window.
 *
 * This uses Document Picture-in-Picture rather than the older video-only
 * `requestPictureInPicture()` because the playback bar is more than a video
 * surface — it carries transport controls, the station identity and, for
 * radio, no video element at all. Document PiP *moves* the existing nodes into
 * the new window rather than cloning them, so the `<audio>`/`<video>` element
 * keeps playing without rebuffering, and moving them back on close restores
 * the bar exactly as it was.
 */

interface DocumentPictureInPictureApi {
    requestWindow(options?: {
        width?: number;
        height?: number;
    }): Promise<Window>;
    window: Window | null;
}

type PipCapableWindow = Window & {
    documentPictureInPicture?: DocumentPictureInPictureApi;
};

export interface PopOutRequest {
    /** The element to move. It is returned to `placeholder` on close. */
    content: HTMLElement;
    /** Where the content came from, so it can be put back. */
    placeholder: HTMLElement;
    width?: number;
    height?: number;
    onClose?: () => void;
}

@Injectable({ providedIn: 'root' })
export class DocumentPictureInPictureService {
    private activeWindow: Window | null = null;

    get isSupported(): boolean {
        return Boolean(
            (window as PipCapableWindow).documentPictureInPicture
                ?.requestWindow
        );
    }

    get isOpen(): boolean {
        return this.activeWindow !== null && !this.activeWindow.closed;
    }

    async open(request: PopOutRequest): Promise<boolean> {
        const api = (window as PipCapableWindow).documentPictureInPicture;
        if (!api?.requestWindow || this.isOpen) {
            return false;
        }

        let pipWindow: Window;
        try {
            pipWindow = await api.requestWindow({
                width: request.width ?? 420,
                height: request.height ?? 260,
            });
        } catch {
            // The request is gesture-gated and can be refused outright.
            return false;
        }

        copyStyles(pipWindow);
        // The window opens with a bare, unstyled body; without this the moved
        // content sits at its minimum height against a white page instead of
        // filling the window.
        Object.assign(pipWindow.document.body.style, {
            margin: '0',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--app-content-bg, #111418)',
        });
        pipWindow.document.body.append(request.content);
        this.activeWindow = pipWindow;

        const restore = () => {
            // Guard against both pagehide and an explicit close running.
            if (request.content.parentElement !== pipWindow.document.body) {
                return;
            }
            request.placeholder.append(request.content);
            this.activeWindow = null;
            request.onClose?.();
        };
        pipWindow.addEventListener('pagehide', restore, { once: true });

        return true;
    }

    close(): void {
        this.activeWindow?.close();
        this.activeWindow = null;
    }
}

/**
 * A PiP window starts with no styles at all, so every stylesheet the app uses
 * has to be replayed into it. Same-origin sheets are copied rule by rule;
 * cross-origin ones can only be re-linked.
 */
function copyStyles(pipWindow: Window): void {
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            const cssText = Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join('');
            const style = pipWindow.document.createElement('style');
            style.textContent = cssText;
            pipWindow.document.head.append(style);
        } catch {
            if (!sheet.href) {
                continue;
            }
            const link = pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWindow.document.head.append(link);
        }
    }

    // Angular emits component styles into adopted sheets in some builds.
    // Adopting a sheet constructed in another document is rejected outright, so
    // fall back to replaying its rules the same way as a linked sheet.
    for (const sheet of document.adoptedStyleSheets ?? []) {
        try {
            pipWindow.document.adoptedStyleSheets = [
                ...pipWindow.document.adoptedStyleSheets,
                sheet,
            ];
        } catch {
            const style = pipWindow.document.createElement('style');
            style.textContent = Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join('');
            pipWindow.document.head.append(style);
        }
    }
}
