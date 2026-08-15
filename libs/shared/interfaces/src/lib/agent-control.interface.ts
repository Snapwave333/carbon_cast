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
    | 'app.navigate';

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
    updatedAt: string;
}

export interface AgentControlEvent {
    type: 'state.changed' | 'command.completed';
    timestamp: string;
    correlationId?: string;
    state?: AgentControlState;
    result?: AgentControlResult;
}
