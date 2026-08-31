import type { AgentControlOperation } from '@iptvnator/shared/interfaces';

import {
    mapBoundsToDisplay,
    nextDisplayId,
    QUIT_GRACE_MS,
    scheduleQuit,
} from './agent-control-window';
import { runWindowOperation } from './agent-control-window-operations';

interface DisplayLike {
    id: number;
    scaleFactor: number;
    bounds: { x: number; y: number; width: number; height: number };
    workArea: { x: number; y: number; width: number; height: number };
}

interface WinState {
    minimized: boolean;
    fullscreen: boolean;
    maximized: boolean;
    visible: boolean;
    bounds: { x: number; y: number; width: number; height: number };
    destroyed: boolean;
}

const screenState = {
    displays: [] as DisplayLike[],
    primary: 1,
};

jest.mock('electron', () => ({
    screen: {
        getAllDisplays: () => screenState.displays,
        getPrimaryDisplay: () => ({ id: screenState.primary }),
        getDisplayMatching: (bounds: { x: number; y: number }) =>
            screenState.displays.find(
                (item) =>
                    bounds.x >= item.bounds.x &&
                    bounds.x < item.bounds.x + item.bounds.width &&
                    bounds.y >= item.bounds.y &&
                    bounds.y < item.bounds.y + item.bounds.height
            ) ?? screenState.displays[0],
    },
    BrowserWindow: {
        getAllWindows: () => windows,
    },
}));

const windows: Electron.BrowserWindow[] = [];

function display(
    id: number,
    x: number,
    y: number,
    width: number,
    height: number,
    scaleFactor = 1
): DisplayLike {
    return { id, scaleFactor, bounds: { x, y, width, height }, workArea: { x, y, width, height } };
}

function makeWindow(bounds = { x: 0, y: 0, width: 800, height: 600 }): {
    win: Electron.BrowserWindow;
    state: WinState;
} {
    const state: WinState = {
        minimized: false,
        fullscreen: false,
        maximized: false,
        visible: true,
        bounds: { ...bounds },
        destroyed: false,
    };

    const win = {
        getBounds: () => ({ ...state.bounds }),
        setBounds: (next: { x: number; y: number; width: number; height: number }) => {
            state.bounds = { ...next };
        },
        isMinimized: () => state.minimized,
        isFullScreen: () => state.fullscreen,
        isMaximized: () => state.maximized,
        isVisible: () => state.visible,
        minimize: () => {
            state.minimized = true;
            state.visible = false;
        },
        restore: () => {
            state.minimized = false;
            state.visible = true;
        },
        unmaximize: () => {
            state.maximized = false;
        },
        maximize: () => {
            state.maximized = true;
        },
        setFullScreen: (value: boolean) => {
            state.fullscreen = value;
        },
        show: () => {
            state.visible = true;
        },
        focus: jest.fn(),
        isDestroyed: () => state.destroyed,
        close: jest.fn(() => {
            state.destroyed = true;
        }),
    } as unknown as Electron.BrowserWindow;

    return { win, state };
}

describe('mapBoundsToDisplay', () => {
    it('maps a centred window to the centre of a smaller display', () => {
        const from = { x: 0, y: 0, width: 3840, height: 2160 };
        const to = { x: 1920, y: 0, width: 1920, height: 1080 };
        const moved = mapBoundsToDisplay(
            { x: 1520, y: 780, width: 800, height: 600 },
            from,
            to
        );
        // (3840-800)/2=1520 and (2160-600)/2=780 sit the window centred on 3840;
        // mapping the ratio across to 1920 must keep it centred there.
        expect(moved.x).toBe(1920 + Math.round(0.5 * (1920 - 800)));
        expect(moved.y).toBe(0 + Math.round(0.5 * (1080 - 600)));
    });

    it('clamps a window larger than the destination to the destination size', () => {
        const moved = mapBoundsToDisplay(
            { x: 0, y: 0, width: 4000, height: 3000 },
            { x: 0, y: 0, width: 4000, height: 3000 },
            { x: 100, y: 100, width: 1280, height: 720 }
        );
        expect(moved.width).toBe(1280);
        expect(moved.height).toBe(720);
        expect(moved.x).toBeGreaterThanOrEqual(100);
        expect(moved.y).toBeGreaterThanOrEqual(100);
    });

    it('keeps a top-left anchored window at the top-left of the destination', () => {
        const moved = mapBoundsToDisplay(
            { x: 0, y: 0, width: 800, height: 600 },
            { x: 0, y: 0, width: 1920, height: 1080 },
            { x: 1920, y: 0, width: 1920, height: 1080 }
        );
        expect(moved.x).toBe(1920);
        expect(moved.y).toBe(0);
    });

    it('keeps a bottom-right anchored window at the bottom-right of the destination', () => {
        const moved = mapBoundsToDisplay(
            { x: 1120, y: 480, width: 800, height: 600 },
            { x: 0, y: 0, width: 1920, height: 1080 },
            { x: 1920, y: 0, width: 1920, height: 1080 }
        );
        expect(moved.x).toBe(1920 + (1920 - 800));
        expect(moved.y).toBe(1080 - 600);
    });

    it('never produces NaN coordinates from a zero-area display', () => {
        const moved = mapBoundsToDisplay(
            { x: 0, y: 0, width: 800, height: 600 },
            { x: 0, y: 0, width: 0, height: 0 },
            { x: 0, y: 0, width: 0, height: 0 }
        );
        expect(moved.x).toBe(0);
        expect(moved.y).toBe(0);
        expect(Number.isFinite(moved.x)).toBe(true);
        expect(Number.isFinite(moved.y)).toBe(true);
    });
});

describe('nextDisplayId', () => {
    it('returns the display after the current one', () => {
        expect(nextDisplayId([{ id: 1 }, { id: 2 }], 1)).toBe(2);
    });

    it('wraps to the first display after the last', () => {
        expect(nextDisplayId([{ id: 1 }, { id: 2 }, { id: 3 }], 3)).toBe(1);
    });

    it('falls back to the first display when the current one is unknown', () => {
        expect(nextDisplayId([{ id: 7 }, { id: 9 }], 99)).toBe(7);
    });

    it('returns null when there are no displays', () => {
        expect(nextDisplayId([], 1)).toBeNull();
    });
});

describe('runWindowOperation', () => {
    beforeEach(() => {
        screenState.displays = [display(1, 0, 0, 1920, 1080)];
        screenState.primary = 1;
        windows.splice(0, windows.length);
    });

    it('reads the window state for app.window.get', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.window.get', {}, win);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.data).toMatchObject({
                state: 'normal',
                visible: true,
                displayId: 1,
            });
        }
    });

    it('acknowledges app.launch without opening a second window', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.launch', {}, win);
        expect(outcome).toMatchObject({ ok: true });
        if (outcome.ok) {
            expect(outcome.data).toMatchObject({ alreadyRunning: true, ready: true });
        }
    });

    it('applies a requested window state for app.window.set', () => {
        const { win, state } = makeWindow();
        const outcome = runWindowOperation('app.window.set', { state: 'maximized' }, win);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.data).toMatchObject({ state: 'maximized' });
            expect(state.maximized).toBe(true);
        }
    });

    it('rejects an unknown window state', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.window.set', { state: 'bogus' }, win);
        expect(outcome).toMatchObject({ ok: false, code: 'invalid-request', retryable: false });
    });

    it('lists displays for app.display.list', () => {
        screenState.displays = [display(1, 0, 0, 1920, 1080), display(2, 1920, 0, 1280, 720)];
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.display.list', {}, win);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.data).toHaveLength(2);
        }
    });

    it('moves the window to the next display for app.display.move --next', () => {
        screenState.displays = [display(1, 0, 0, 1920, 1080), display(2, 1920, 0, 1280, 720, 1.5)];
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.display.move', { next: true }, win);
        expect(outcome.ok).toBe(true);
        const data = outcome.ok ? (outcome.data as { display: { id: number; scaleFactor: number }; displayId: number }) : undefined;
        expect(data?.display?.id).toBe(2);
        // Electron bounds use device-independent pixels. Returning the target
        // scale factor makes that coordinate system explicit to the agent.
        expect(data?.display?.scaleFactor).toBe(1.5);
        expect(data?.displayId).toBe(2);
    });

    it('reports operation-unsupported when only one display is connected', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.display.move', { next: true }, win);
        expect(outcome).toMatchObject({ ok: false, code: 'operation-unsupported' });
    });

    it('reports invalid-request when no target is specified for a move', () => {
        screenState.displays = [display(1, 0, 0, 1920, 1080), display(2, 1920, 0, 1280, 720)];
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.display.move', {}, win);
        expect(outcome).toMatchObject({ ok: false, code: 'invalid-request' });
    });

    it('answers app.quit with a quit flag', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation('app.quit', {}, win);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
            expect(outcome.quit).toBe(true);
        }
    });

    it('reports operation-unsupported for unknown operations', () => {
        const { win } = makeWindow();
        const outcome = runWindowOperation(
            'bogus.op' as unknown as AgentControlOperation,
            {},
            win
        );
        expect(outcome).toMatchObject({ ok: false, code: 'operation-unsupported' });
    });
});

describe('scheduleQuit', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        windows.splice(0, windows.length);
    });

    afterEach(() => {
        jest.useRealTimers();
        windows.splice(0, windows.length);
    });

    it('closes every live window after the grace period', () => {
        windows.push(makeWindow().win, makeWindow().win);
        scheduleQuit(QUIT_GRACE_MS);
        expect((windows[0].close as jest.Mock).mock.calls.length).toBe(0);

        jest.advanceTimersByTime(QUIT_GRACE_MS);

        expect(windows[0].close).toHaveBeenCalled();
        expect(windows[1].close).toHaveBeenCalled();
    });

    it('skips windows that were already destroyed', () => {
        windows.push(makeWindow().win);
        const { win } = makeWindow();
        win.close();
        windows.push(win);
        scheduleQuit(QUIT_GRACE_MS);
        jest.advanceTimersByTime(QUIT_GRACE_MS);
        expect(windows[0].close).toHaveBeenCalled();
    });
});
