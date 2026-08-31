/**
 * Window, display, and lifecycle operations for the agent-control bridge.
 *
 * These live in the main process because the renderer cannot act on them: a
 * web context cannot move the window that hosts it across monitors, cannot
 * minimise it, and cannot outlive `app.quit`. Keeping them here also means
 * they still answer when the renderer has stopped acknowledging commands,
 * which is precisely when an operator wants to move or restore the window.
 *
 * Electron imports are confined to this module so the geometry maths below
 * stays unit-testable against plain objects.
 */

import { BrowserWindow, screen } from 'electron';
import type {
    AgentDisplay,
    AgentWindowState,
} from '@iptvnator/shared/interfaces';

export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface WindowSnapshot {
    state: AgentWindowState;
    bounds: Rectangle;
    displayId: number | null;
    visible: boolean;
}

/**
 * Time between answering `app.quit` and actually quitting.
 *
 * The HTTP response is written from the same process we are about to end.
 * Quitting synchronously races the socket flush, so the caller sees a dropped
 * connection instead of the success it earned. One tick of slack is enough to
 * get the bytes out and still reads as instant.
 */
export const QUIT_GRACE_MS = 250;

/**
 * Map a window onto a different display, preserving where it sat *relative to*
 * that display rather than its absolute coordinates.
 *
 * Absolute coordinates are wrong across monitors of different sizes: a window
 * centred on a 3840-wide display lands off the edge of a 1920-wide one. The
 * proportional mapping keeps a centred window centred, and the clamp
 * guarantees the result is fully on-screen even when the target is smaller in
 * both axes.
 *
 * Exported for its own tests — it is pure geometry and needs no Electron.
 */
export function mapBoundsToDisplay(
    bounds: Rectangle,
    from: Rectangle,
    to: Rectangle
): Rectangle {
    // Never larger than the destination work area, and never zero.
    const width = Math.max(1, Math.min(bounds.width, to.width));
    const height = Math.max(1, Math.min(bounds.height, to.height));

    // Fraction of the source work area the window's origin sat at. Guard the
    // divisor: a display reporting a zero-width work area would otherwise make
    // every coordinate NaN and move the window nowhere at all.
    const spanX = Math.max(1, from.width - bounds.width);
    const spanY = Math.max(1, from.height - bounds.height);
    const ratioX = clamp01((bounds.x - from.x) / spanX);
    const ratioY = clamp01((bounds.y - from.y) / spanY);

    return {
        x: Math.round(to.x + ratioX * Math.max(0, to.width - width)),
        y: Math.round(to.y + ratioY * Math.max(0, to.height - height)),
        width,
        height,
    };
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

/**
 * Pick the display after *currentId* in the reported order, wrapping around.
 *
 * "The opposite monitor" has an obvious meaning with two displays and no
 * canonical one with three, so `next` is defined as "the one after this",
 * which is stable, reversible by repeating, and correct for the two-monitor
 * case everyone actually asks about.
 */
export function nextDisplayId(
    displays: readonly { id: number }[],
    currentId: number | null
): number | null {
    if (!displays.length) return null;
    const index = displays.findIndex((display) => display.id === currentId);
    if (index < 0) return displays[0].id;
    return displays[(index + 1) % displays.length].id;
}

function describeDisplay(
    display: Electron.Display,
    currentId: number | null,
    primaryId: number
): AgentDisplay {
    const { x, y, width, height } = display.bounds;
    return {
        id: display.id,
        // Electron exposes no monitor name, and the OS one can carry a serial
        // number, so build a stable label from geometry instead.
        label: `${width}x${height}${display.id === primaryId ? ' (primary)' : ''}`,
        primary: display.id === primaryId,
        current: display.id === currentId,
        bounds: { x, y, width, height },
        scaleFactor: display.scaleFactor,
    };
}

function currentDisplayId(win: Electron.BrowserWindow): number | null {
    try {
        return screen.getDisplayMatching(win.getBounds()).id;
    } catch {
        // getDisplayMatching throws if the display set changed underneath us
        // (an unplugged monitor). A null id is honest and still lets
        // `--next` fall back to the first display.
        return null;
    }
}

export function readWindowState(win: Electron.BrowserWindow): WindowSnapshot {
    return {
        state: describeWindowState(win),
        bounds: win.getBounds(),
        displayId: currentDisplayId(win),
        visible: win.isVisible(),
    };
}

function describeWindowState(win: Electron.BrowserWindow): AgentWindowState {
    // Order matters: a fullscreen window also reports as maximised on some
    // platforms, and a minimised one keeps whatever it was before.
    if (win.isMinimized()) return 'minimized';
    if (win.isFullScreen()) return 'fullscreen';
    if (win.isMaximized()) return 'maximized';
    return 'normal';
}

export function listDisplays(win: Electron.BrowserWindow): AgentDisplay[] {
    const current = currentDisplayId(win);
    const primaryId = screen.getPrimaryDisplay().id;
    return screen
        .getAllDisplays()
        .map((display) => describeDisplay(display, current, primaryId));
}

export interface DisplayMoveRequest {
    /** Explicit target display id, as reported by `app.display.list`. */
    displayId?: number;
    /** One-based position in the `app.display.list` order. */
    index?: number;
    /** Move to the display after the current one, wrapping around. */
    next?: boolean;
}

export class WindowOperationError extends Error {
    constructor(
        readonly code: 'invalid-request' | 'not-found' | 'operation-unsupported',
        message: string
    ) {
        super(message);
    }
}

export function moveWindowToDisplay(
    win: Electron.BrowserWindow,
    request: DisplayMoveRequest
): WindowSnapshot & { display: AgentDisplay } {
    const displays = screen.getAllDisplays();
    if (displays.length < 2) {
        throw new WindowOperationError(
            'operation-unsupported',
            'Only one display is connected; there is nowhere to move the window.'
        );
    }

    const current = currentDisplayId(win);
    const targetId = resolveTargetDisplayId(displays, current, request);
    const target = displays.find((display) => display.id === targetId);
    if (!target) {
        throw new WindowOperationError(
            'not-found',
            `No display with id ${targetId} is connected.`
        );
    }
    if (target.id === current) {
        throw new WindowOperationError(
            'invalid-request',
            'The window is already on that display.'
        );
    }

    // A maximised or fullscreen window ignores setBounds — the window manager
    // owns its geometry — so drop out of that state, move, then restore it on
    // the new display. Without this the command reports success and the window
    // never moves.
    const restore = describeWindowState(win);
    if (restore === 'fullscreen') win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();

    const source = screen.getDisplayMatching(win.getBounds());
    win.setBounds(
        mapBoundsToDisplay(win.getBounds(), source.workArea, target.workArea)
    );

    if (restore === 'fullscreen') win.setFullScreen(true);
    if (restore === 'maximized') win.maximize();

    const primaryId = screen.getPrimaryDisplay().id;
    return {
        ...readWindowState(win),
        display: describeDisplay(target, target.id, primaryId),
    };
}

function resolveTargetDisplayId(
    displays: readonly Electron.Display[],
    current: number | null,
    request: DisplayMoveRequest
): number {
    const chosen = [
        request.displayId !== undefined,
        request.index !== undefined,
        request.next === true,
    ].filter(Boolean).length;
    if (chosen !== 1) {
        throw new WindowOperationError(
            'invalid-request',
            'Specify exactly one of displayId, index, or next.'
        );
    }

    if (request.next) {
        const id = nextDisplayId(displays, current);
        if (id === null) {
            throw new WindowOperationError('not-found', 'No displays are connected.');
        }
        return id;
    }
    if (request.index !== undefined) {
        const index = Math.trunc(request.index);
        if (!Number.isFinite(index) || index < 1 || index > displays.length) {
            throw new WindowOperationError(
                'invalid-request',
                `index must be between 1 and ${displays.length}.`
            );
        }
        return displays[index - 1].id;
    }
    return Math.trunc(request.displayId as number);
}

export function applyWindowState(
    win: Electron.BrowserWindow,
    state: AgentWindowState
): WindowSnapshot {
    // Every transition starts from a restored window. Going straight from
    // minimised to fullscreen leaves the window fullscreen *and* off-screen on
    // Windows, which looks exactly like a crash.
    if (state !== 'minimized' && win.isMinimized()) win.restore();

    switch (state) {
        case 'minimized':
            win.minimize();
            break;
        case 'maximized':
            if (win.isFullScreen()) win.setFullScreen(false);
            win.maximize();
            break;
        case 'fullscreen':
            win.setFullScreen(true);
            break;
        case 'normal':
            if (win.isFullScreen()) win.setFullScreen(false);
            if (win.isMaximized()) win.unmaximize();
            win.show();
            win.focus();
            break;
    }

    // Report the requested state rather than re-reading it: Linux window
    // managers apply these asynchronously, so an immediate read races and
    // reports the *old* state. The state.changed event stays authoritative.
    return { ...readWindowState(win), state };
}

/**
 * Quit after a short grace period so the caller receives its answer.
 *
 * Windows are closed first so each one's `close` handler still persists its
 * bounds — the same reason the titlebar's close button calls `win.close()`
 * rather than `app.quit()`.
 */
export function scheduleQuit(delayMs: number = QUIT_GRACE_MS): void {
    // `win.close()` rather than `app.quit()` so each window's `close` handler
    // still persists its bounds — the same reason the titlebar's close button
    // calls `close()`. Once every window is closed Electron quits on its own.
    setTimeout(() => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) win.close();
        }
    }, delayMs);
}
