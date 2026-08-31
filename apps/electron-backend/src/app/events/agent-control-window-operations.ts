/**
 * Operation dispatch for the main-process window, display, and lifecycle
 * commands.
 *
 * Split from `agent-control-window.ts` so each file stays inside the
 * workspace's 400-line ESLint ceiling: that module owns the Electron window
 * mechanics (geometry, display maths, state transitions), and this one owns
 * the mapping from an `AgentControlOperation` onto them.
 */

import {
    AGENT_WINDOW_STATES,
    type AgentControlOperation,
    type AgentWindowState,
} from '@iptvnator/shared/interfaces';
import {
    applyWindowState,
    listDisplays,
    moveWindowToDisplay,
    readWindowState,
    WindowOperationError,
    type DisplayMoveRequest,
} from './agent-control-window';

export type WindowOperationOutcome =
    | { ok: true; data: unknown; quit?: boolean }
    | {
          ok: false;
          code: WindowOperationError['code'];
          message: string;
          retryable: boolean;
      };

export type WindowOperationSuccess = Extract<WindowOperationOutcome, { ok: true }>;
export type WindowOperationFailure = Extract<WindowOperationOutcome, { ok: false }>;

/**
 * Split an outcome into its two shapes.
 *
 * The workspace compiles with `strict` (and so `strictNullChecks`) off, and
 * without it TypeScript will not narrow a union on a *boolean* discriminant —
 * `if (outcome.ok)` leaves both members in play and every field access fails
 * to resolve. Returning the two shapes explicitly keeps the call site honest
 * without weakening the union to all-optional fields.
 */
export function splitWindowOutcome(outcome: WindowOperationOutcome): {
    success: WindowOperationSuccess | null;
    failure: WindowOperationFailure | null;
} {
    return outcome.ok
        ? { success: outcome as WindowOperationSuccess, failure: null }
        : { success: null, failure: outcome as WindowOperationFailure };
}

type JsonObject = Record<string, unknown>;

/**
 * Entry point for the main-process window, display, and lifecycle operations.
 *
 * `agent-control.events.ts` answers every `mainProcessOperations` member here,
 * so it must never throw: a thrown rejection would surface as an internal
 * error and leave a moved window in its old place.
 */
export function runWindowOperation(
    operation: AgentControlOperation,
    params: JsonObject,
    win: Electron.BrowserWindow
): WindowOperationOutcome {
    switch (operation) {
        case 'app.launch':
            // The CLI normally handles launch before a bridge exists. If the
            // bridge is already answering, acknowledge the lifecycle request
            // without starting a second desktop instance.
            return {
                ok: true,
                data: { alreadyRunning: true, ready: true, window: readWindowState(win) },
            };
        case 'app.window.get':
            return { ok: true, data: readWindowState(win) };
        case 'app.quit':
            return { ok: true, data: readWindowState(win), quit: true };
        case 'app.display.list':
            return { ok: true, data: listDisplays(win) };
        case 'app.window.set': {
            const state = params?.state;
            if (!AGENT_WINDOW_STATES.includes(state as AgentWindowState)) {
                return {
                    ok: false,
                    code: 'invalid-request',
                    message: `state must be one of: ${AGENT_WINDOW_STATES.join(', ')}.`,
                    retryable: false,
                };
            }
            return { ok: true, data: applyWindowState(win, state as AgentWindowState) };
        }
        case 'app.display.move': {
            const request: DisplayMoveRequest = {};
            if (params?.next === true) request.next = true;
            if (typeof params?.index === 'number') request.index = params.index;
            if (typeof params?.displayId === 'number') request.displayId = params.displayId;
            try {
                return { ok: true, data: moveWindowToDisplay(win, request) };
            } catch (error) {
                const known = error instanceof WindowOperationError;
                return {
                    ok: false,
                    code: known ? error.code : 'invalid-request',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: known && error.code === 'not-found',
                };
            }
        }
        default:
            return {
                ok: false,
                code: 'operation-unsupported',
                message: `Unsupported window operation: ${String(operation)}.`,
                retryable: false,
            };
    }
}
