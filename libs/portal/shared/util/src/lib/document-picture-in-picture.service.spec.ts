import { TestBed } from '@angular/core/testing';
import { DocumentPictureInPictureService } from './document-picture-in-picture.service';

/**
 * Document Picture-in-Picture *moves* the content element into the floating
 * window rather than cloning it, which is what keeps the `<audio>` element
 * playing. Everything awkward about this service follows from that: the content
 * has to be put back, the window has to be closed when its content goes away,
 * and the styles have to be replayed because the new document starts bare.
 */

interface FakePipWindow extends Partial<Window> {
    document: Document;
    closed: boolean;
    close: jest.Mock;
    addEventListener: jest.Mock;
    /** Fires whatever the service registered for `pagehide`. */
    fireClose: () => void;
}

function createFakeWindow(): FakePipWindow {
    const doc = document.implementation.createHTMLDocument('pip');
    const listeners: Array<() => void> = [];

    return {
        document: doc,
        closed: false,
        close: jest.fn(function (this: FakePipWindow) {
            this.closed = true;
        }),
        addEventListener: jest.fn((event: string, handler: () => void) => {
            if (event === 'pagehide') {
                listeners.push(handler);
            }
        }),
        fireClose: () => listeners.forEach((handler) => handler()),
    };
}

function installApi(
    requestWindow: jest.Mock | null
): { window: Window | null } | undefined {
    if (!requestWindow) {
        delete (window as Record<string, unknown>)['documentPictureInPicture'];
        return undefined;
    }
    const api = { requestWindow, window: null };
    (window as Record<string, unknown>)['documentPictureInPicture'] = api;
    return api;
}

describe('DocumentPictureInPictureService', () => {
    let service: DocumentPictureInPictureService;
    let content: HTMLElement;
    let placeholder: HTMLElement;

    function request(): Parameters<
        DocumentPictureInPictureService['open']
    >[0] {
        return { content, placeholder };
    }

    beforeEach(() => {
        TestBed.resetTestingModule();
        service = TestBed.inject(DocumentPictureInPictureService);

        placeholder = document.createElement('div');
        content = document.createElement('div');
        placeholder.append(content);
        document.body.append(placeholder);
    });

    afterEach(() => {
        placeholder.remove();
        installApi(null);
    });

    it('reports itself unsupported where the API is missing', () => {
        installApi(null);

        expect(service.isSupported).toBe(false);
    });

    it('reports itself supported where the API exists', () => {
        installApi(jest.fn());

        expect(service.isSupported).toBe(true);
    });

    it('does nothing when the API is missing', async () => {
        installApi(null);

        await expect(service.open(request())).resolves.toBe(false);
        expect(content.parentElement).toBe(placeholder);
    });

    // The request is gesture-gated, so the browser can simply refuse.
    it('reports a refusal without losing the content', async () => {
        installApi(jest.fn().mockRejectedValue(new Error('not allowed')));

        await expect(service.open(request())).resolves.toBe(false);
        expect(content.parentElement).toBe(placeholder);
        expect(service.isOpen).toBe(false);
    });

    it('moves the content into the window rather than copying it', async () => {
        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));

        await expect(service.open(request())).resolves.toBe(true);

        expect(content.parentElement).toBe(pip.document.body);
        expect(placeholder.childElementCount).toBe(0);
        expect(service.isOpen).toBe(true);
    });

    it('lays the window out so the content fills it', async () => {
        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));

        await service.open(request());

        // Without this the moved content sits at its minimum height against a
        // bare white page.
        expect(pip.document.body.style.margin).toBe('0px');
        expect(pip.document.body.style.height).toBe('100vh');
        expect(pip.document.body.style.display).toBe('flex');
    });

    it('puts the content back when the window closes', async () => {
        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));
        const onClose = jest.fn();

        await service.open({ ...request(), onClose });
        pip.fireClose();

        expect(content.parentElement).toBe(placeholder);
        expect(onClose).toHaveBeenCalled();
        expect(service.isOpen).toBe(false);
    });

    it('puts the content back when the caller closes the window', async () => {
        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));

        await service.open(request());
        service.close();
        // The real window fires `pagehide` in response to `close()`.
        pip.fireClose();

        expect(pip.close).toHaveBeenCalled();
        expect(content.parentElement).toBe(placeholder);
    });

    it('survives close and pagehide both running', async () => {
        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));

        await service.open(request());
        service.close();
        pip.fireClose();
        pip.fireClose();

        expect(content.parentElement).toBe(placeholder);
    });

    it('refuses to open a second window over the first', async () => {
        const pip = createFakeWindow();
        const requestWindow = jest.fn().mockResolvedValue(pip);
        installApi(requestWindow);

        await service.open(request());
        await expect(service.open(request())).resolves.toBe(false);

        expect(requestWindow).toHaveBeenCalledTimes(1);
    });

    it('is closable when nothing is open', () => {
        installApi(jest.fn());

        expect(() => service.close()).not.toThrow();
    });

    // A PiP window starts with no styles at all, so the app's stylesheets have
    // to be replayed into it or the player renders unstyled.
    it('replays the app stylesheets into the new window', async () => {
        const style = document.createElement('style');
        style.textContent = '.replayed-marker { color: rgb(1, 2, 3); }';
        document.head.append(style);

        const pip = createFakeWindow();
        installApi(jest.fn().mockResolvedValue(pip));

        await service.open(request());

        expect(pip.document.head.textContent).toContain('replayed-marker');
        style.remove();
    });

    /**
     * Adopting a stylesheet constructed in another document is rejected
     * outright. Assigning the whole array threw out of `open()` after the
     * window already existed, leaving a stray window and an unhandled rejection.
     */
    it('falls back to replaying an adopted sheet it cannot hand over', async () => {
        // jsdom has no constructable stylesheets, so the sheet is stubbed down
        // to the two members the service actually reads.
        const sheet = {
            cssRules: [{ cssText: '.adopted-marker { color: rgb(4, 5, 6); }' }],
        } as unknown as CSSStyleSheet;
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get: () => [sheet],
        });

        const pip = createFakeWindow();
        Object.defineProperty(pip.document, 'adoptedStyleSheets', {
            configurable: true,
            get: () => [],
            set: () => {
                throw new DOMException('cross-document', 'NotAllowedError');
            },
        });
        installApi(jest.fn().mockResolvedValue(pip));

        await expect(service.open(request())).resolves.toBe(true);
        expect(pip.document.head.textContent).toContain('adopted-marker');

        Reflect.deleteProperty(document, 'adoptedStyleSheets');
    });
});
