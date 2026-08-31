/**
 * Privacy-safe protocol shared by the Electron main process and the renderer.
 * It deliberately contains identifiers and user-facing metadata only: stream
 * URLs, portal credentials, filesystem paths, and raw provider payloads never
 * cross this boundary.
 */
export const AGENT_CONTROL_SCOPES = [
    'state.read',
    'library.read',
    'player.control',
    'library.write',
    'settings.write',
    'follow.write',
    'recording.control',
    'diagnostics.read',
    'tokens.manage',
    'events.read',
    /**
     * Shutting the app down is categorically unlike changing what it shows, so
     * it does not ride along on `player.control`: a token minted to drive
     * playback must not be able to end the session. Window and display moves
     * stay on `player.control` — they change the picture, nothing persistent.
     */
    'app.lifecycle',
] as const;

export type AgentControlScope = (typeof AGENT_CONTROL_SCOPES)[number];

export type AgentControlOperation =
    | 'player.getState'
    | 'player.play'
    | 'player.pause'
    | 'player.stop'
    | 'player.setVolume'
    | 'player.setMuted'
    | 'player.seek'
    | 'player.setFullscreen'
    | 'player.togglePictureInPicture'
    | 'player.setSubtitle'
    | 'player.setAudioTrack'
    | 'channel.list'
    | 'channel.switch'
    | 'channel.next'
    | 'channel.previous'
    | 'epg.getNowNext'
    | 'epg.refresh'
    | 'favorite.list'
    | 'favorite.set'
    | 'follow.list'
    | 'follow.set'
    | 'follow.setAutoSwitch'
    | 'recording.start'
    | 'recording.stop'
    | 'settings.get'
    | 'settings.update'
    | 'diagnostics.get'
    | 'diagnostics.screenshot'
    | 'app.navigate'
    // Window, display, and lifecycle operations. Served by the main process
    // rather than the renderer: a renderer cannot move or minimise its own
    // window, and `app.quit` must survive the window it is closing.
    // `app.launch` is a local CLI lifecycle operation. It is also accepted by
    // the live bridge as a no-op acknowledgement when the app is already up,
    // which keeps the operation vocabulary complete for agents.
    | 'app.launch'
    | 'app.quit'
    | 'app.window.get'
    | 'app.window.set'
    | 'app.display.list'
    | 'app.display.move';

/**
 * Window states an agent can request. `fullscreen` is the *window* chrome,
 * distinct from `player.setFullscreen`, which fullscreens the video element
 * inside it — an agent asking for "fullscreen" usually means this one.
 */
export const AGENT_WINDOW_STATES = [
    'normal',
    'minimized',
    'maximized',
    'fullscreen',
] as const;

export type AgentWindowState = (typeof AGENT_WINDOW_STATES)[number];

/**
 * A monitor as reported by `app.display.list`. Bounds are included because
 * "the opposite monitor" is only meaningful relative to where the window is
 * now; `current` marks the display the window currently occupies.
 */
export interface AgentDisplay {
    id: number;
    label: string;
    primary: boolean;
    current: boolean;
    bounds: { x: number; y: number; width: number; height: number };
    scaleFactor: number;
}

export type AgentControlErrorCode =
    | 'agent-control-unavailable'
    | 'authentication-required'
    | 'authorization-denied'
    | 'confirmation-required'
    | 'invalid-request'
    | 'not-found'
    | 'operation-unsupported'
    | 'rate-limited'
    | 'renderer-unavailable'
    | 'renderer-timeout'
    | 'token-expired'
    | 'token-revoked'
    | 'internal-error';

export interface AgentControlRequest {
    operation: AgentControlOperation;
    params?: Record<string, unknown>;
    /** Client generated, stable across retries for idempotent control writes. */
    correlationId?: string;
}

export interface AgentControlResult {
    success: boolean;
    operation: string;
    requested: Record<string, unknown>;
    previousState?: Record<string, unknown>;
    state?: Record<string, unknown>;
    timestamp: string;
    correlationId: string;
    error?: {
        code: AgentControlErrorCode;
        message: string;
        retryable: boolean;
    };
}

export interface AgentControlState {
    ready: boolean;
    route?: string;
    player?: Record<string, unknown>;
    channel?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    /** Present only while an authenticated agent command is being handled. */
    agentCommand?: {
        operation: string;
        correlationId: string;
        startedAt: string;
    };
    updatedAt: string;
}

export interface AgentControlEvent {
    type: 'state.changed' | 'command.completed';
    timestamp: string;
    correlationId?: string;
    state?: AgentControlState;
    result?: AgentControlResult;
}
