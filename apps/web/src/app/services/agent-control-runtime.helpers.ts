import {
    type AgentControlErrorCode,
    type Channel,
    type FollowedSeriesSource,
} from '@iptvnator/shared/interfaces';

export type SafeState = Record<string, unknown>;

export interface AgentFailure {
    code: AgentControlErrorCode;
    message: string;
    retryable: boolean;
}

export function numeric(value: unknown, min: number, max: number, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw agentError('invalid-request', `${label} must be a number between ${min} and ${max}.`);
    return value;
}

export function safeChannel(channel: Channel): SafeState {
    return { id: channel.id, name: channel.name ?? channel.tvg?.name ?? 'Untitled channel', group: channel.group ?? null, radio: channel.radio === 'true', logo: channel.tvg?.logo ? true : false };
}

export function safeProgram(program: { title?: string; start?: string | Date; end?: string | Date; description?: string | null }): SafeState {
    return { title: program.title ?? 'Untitled programme', start: program.start ? String(program.start) : null, end: program.end ? String(program.end) : null, description: program.description ?? null };
}

export function finiteOrNull(value: number): number | null {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function isFollowSource(value: unknown): value is FollowedSeriesSource {
    return value === 'epg' || value === 'stalker' || value === 'xtream';
}

export function stringOrUndefined(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function agentError(code: AgentControlErrorCode, message: string): { code: AgentControlErrorCode; message: string; retryable: boolean } {
    return { code, message, retryable: code === 'agent-control-unavailable' || code === 'renderer-unavailable' || code === 'renderer-timeout' };
}

export function normalizeError(error: unknown): { code: AgentControlErrorCode; message: string; retryable: boolean } {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) return error as { code: AgentControlErrorCode; message: string; retryable: boolean };
    return { code: 'internal-error', message: error instanceof Error ? error.message : 'Unexpected agent-control failure.', retryable: false };
}
