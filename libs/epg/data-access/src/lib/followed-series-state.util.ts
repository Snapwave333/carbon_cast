import {
    AutoSwitchSchedule,
    FollowedSeriesPersistedState,
    FollowedSeriesSwitchHistoryEntry,
    FollowedSeriesSwitchRequest,
} from '@iptvnator/shared/interfaces';
import { selectConflictWinner } from './followed-series-scheduler.util';

export function resolveFollowedSeriesSwitchRequest(
    state: FollowedSeriesPersistedState,
    scheduleId: string
): FollowedSeriesSwitchRequest | null {
    const schedule = state.schedules.find((item) => item.id === scheduleId);
    const broadcast = schedule
        ? state.broadcasts.find((item) => item.id === schedule.broadcastId)
        : undefined;
    const episode = schedule
        ? state.episodes.find((item) => item.id === schedule.episodeId)
        : undefined;
    const series = schedule
        ? state.followedSeries.find((item) => item.id === schedule.seriesId)
        : undefined;
    return schedule && broadcast && episode && series
        ? { schedule, broadcast, episode, series }
        : null;
}

export function withFollowedScheduleStatus(
    schedules: readonly AutoSwitchSchedule[],
    scheduleId: string,
    status: AutoSwitchSchedule['status']
): AutoSwitchSchedule[] {
    return schedules.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, status } : schedule
    );
}

export function appendFollowedSwitchHistory(
    history: readonly FollowedSeriesSwitchHistoryEntry[],
    scheduleId: string,
    broadcastId: string,
    outcome: 'canceled' | 'failed' | 'switched',
    reason?: string
): FollowedSeriesSwitchHistoryEntry[] {
    return [
        ...history,
        {
            id: `history-${Date.now()}-${scheduleId}`,
            scheduleId,
            broadcastId,
            attemptedAt: new Date().toISOString(),
            outcome,
            reason,
        },
    ].slice(-200);
}

export function isUnresolvedPromptConflict(
    state: FollowedSeriesPersistedState,
    schedule: AutoSwitchSchedule
): boolean {
    if (
        !schedule.conflictGroupId ||
        state.preferences.conflictBehavior !== 'prompt'
    ) {
        return false;
    }
    const conflict = state.conflicts.find(
        (item) => item.id === schedule.conflictGroupId
    );
    return Boolean(conflict && !conflict.selectedScheduleId);
}

export function isFollowedSeriesConflictWinner(
    state: FollowedSeriesPersistedState,
    schedule: AutoSwitchSchedule
): boolean {
    if (!schedule.conflictGroupId) return true;
    const conflict = state.conflicts.find(
        (item) => item.id === schedule.conflictGroupId
    );
    if (!conflict) return true;
    return (
        selectConflictWinner(
            conflict,
            state.schedules,
            state.broadcasts,
            state.episodes,
            state.followedSeries,
            state.preferences.conflictBehavior
        )?.id === schedule.id
    );
}

export function buildFollowedSeriesRefreshStatus(
    previous: FollowedSeriesPersistedState['refreshStatus'],
    state: FollowedSeriesPersistedState['refreshStatus']['state'],
    attemptedAt: string,
    error: string | null,
    candidateCount: number
): FollowedSeriesPersistedState['refreshStatus'] {
    return {
        state,
        lastAttemptAt: attemptedAt,
        lastSuccessAt:
            state === 'success'
                ? new Date().toISOString()
                : previous.lastSuccessAt,
        lastError: error,
        candidateCount,
    };
}

export function buildEndedFollowedSeriesPatch(
    state: FollowedSeriesPersistedState,
    now: number
): Partial<FollowedSeriesPersistedState> | null {
    const endedIds = new Set(
        state.broadcasts
            .filter((broadcast) => Date.parse(broadcast.endAt) <= now)
            .map((broadcast) => broadcast.id)
    );
    if (endedIds.size === 0) return null;
    return {
        broadcasts: state.broadcasts.map((broadcast) =>
            endedIds.has(broadcast.id)
                ? { ...broadcast, availability: 'ended' }
                : broadcast
        ),
        schedules: state.schedules.map((schedule) =>
            endedIds.has(schedule.broadcastId) && schedule.status !== 'off'
                ? { ...schedule, status: 'ended' }
                : schedule
        ),
    };
}
