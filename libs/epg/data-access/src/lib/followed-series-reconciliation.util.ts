import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
    FollowedSeriesPreferences,
} from '@iptvnator/shared/interfaces';
import { stableHash } from './followed-series-normalization.util';
import { scheduledSwitchTime } from './followed-series-scheduler.util';

export interface FollowedSeriesReconciliationResult {
    episodes: FollowedEpisode[];
    broadcasts: BroadcastInstance[];
    schedules: AutoSwitchSchedule[];
    changedScheduleIds: string[];
    canceledScheduleIds: string[];
    newEpisodeIds: string[];
}

export function reconcileFollowedSeriesSchedule(input: {
    previousEpisodes: readonly FollowedEpisode[];
    previousBroadcasts: readonly BroadcastInstance[];
    previousSchedules: readonly AutoSwitchSchedule[];
    nextEpisodes: readonly FollowedEpisode[];
    nextBroadcasts: readonly BroadcastInstance[];
    series: readonly FollowedSeries[];
    preferences: FollowedSeriesPreferences;
    now?: Date;
}): FollowedSeriesReconciliationResult {
    const now = input.now ?? new Date();
    const previousEpisodeIds = new Set(
        input.previousEpisodes.map((episode) => episode.id)
    );
    const nextBroadcastById = new Map(
        input.nextBroadcasts.map((broadcast) => [broadcast.id, broadcast])
    );
    const previousBroadcastById = new Map(
        input.previousBroadcasts.map((broadcast) => [broadcast.id, broadcast])
    );
    const nextBroadcasts = [...input.nextBroadcasts];
    const schedules: AutoSwitchSchedule[] = [];
    const claimedBroadcastIds = new Set<string>();
    const changedScheduleIds: string[] = [];
    const canceledScheduleIds: string[] = [];

    for (const previous of input.previousSchedules) {
        const unchanged = nextBroadcastById.get(previous.broadcastId);
        if (unchanged) {
            schedules.push(
                updateScheduleTime(previous, unchanged, input.preferences)
            );
            claimedBroadcastIds.add(unchanged.id);
            continue;
        }

        const oldBroadcast = previousBroadcastById.get(previous.broadcastId);
        const replacement = findReplacementBroadcast(
            previous,
            oldBroadcast,
            input.nextBroadcasts,
            claimedBroadcastIds,
            now
        );
        if (replacement) {
            schedules.push({
                ...previous,
                broadcastId: replacement.id,
                scheduledSwitchAt: scheduledSwitchTime(
                    replacement.startAt,
                    input.preferences.switchLeadSeconds
                ),
                status: previous.status === 'off' ? 'off' : 'schedule-changed',
            });
            claimedBroadcastIds.add(replacement.id);
            if (previous.status !== 'off') changedScheduleIds.push(previous.id);
            continue;
        }

        if (oldBroadcast && Date.parse(oldBroadcast.endAt) > now.getTime()) {
            const canceled = {
                ...oldBroadcast,
                availability: 'canceled' as const,
            };
            nextBroadcasts.push(canceled);
            schedules.push({
                ...previous,
                status:
                    previous.status === 'off' ? 'off' : 'broadcast-unavailable',
            });
            claimedBroadcastIds.add(canceled.id);
            if (previous.status !== 'off')
                canceledScheduleIds.push(previous.id);
        }
    }

    const seriesById = new Map(input.series.map((item) => [item.id, item]));
    const enabledSeriesIds = new Set(
        input.series
            .filter(
                (item) =>
                    item.autoSwitchDefault ||
                    input.preferences.defaultAutoSwitch
            )
            .map((item) => item.id)
    );
    const autoEnabledEpisodes = new Set<string>();
    for (const broadcast of input.nextBroadcasts) {
        if (claimedBroadcastIds.has(broadcast.id)) continue;
        const shouldEnable =
            enabledSeriesIds.has(broadcast.seriesId) &&
            !autoEnabledEpisodes.has(broadcast.episodeId) &&
            broadcast.availability !== 'unavailable';
        if (shouldEnable) autoEnabledEpisodes.add(broadcast.episodeId);
        schedules.push(
            createSchedule(
                broadcast,
                input.preferences,
                now,
                shouldEnable && Boolean(seriesById.get(broadcast.seriesId))
            )
        );
    }

    return {
        episodes: [...input.nextEpisodes],
        broadcasts: deduplicateBroadcasts(nextBroadcasts),
        schedules,
        changedScheduleIds,
        canceledScheduleIds,
        newEpisodeIds: input.nextEpisodes
            .filter((episode) => !previousEpisodeIds.has(episode.id))
            .map((episode) => episode.id),
    };
}

function updateScheduleTime(
    schedule: AutoSwitchSchedule,
    broadcast: BroadcastInstance,
    preferences: FollowedSeriesPreferences
): AutoSwitchSchedule {
    return {
        ...schedule,
        scheduledSwitchAt: scheduledSwitchTime(
            broadcast.startAt,
            preferences.switchLeadSeconds
        ),
        status:
            schedule.status === 'ended' &&
            Date.parse(broadcast.endAt) > Date.now()
                ? 'enabled'
                : schedule.status,
    };
}

function findReplacementBroadcast(
    schedule: AutoSwitchSchedule,
    previous: BroadcastInstance | undefined,
    candidates: readonly BroadcastInstance[],
    claimed: ReadonlySet<string>,
    now: Date
): BroadcastInstance | undefined {
    const priorStart = Date.parse(
        previous?.startAt ?? schedule.scheduledSwitchAt
    );
    return candidates
        .filter(
            (candidate) =>
                candidate.episodeId === schedule.episodeId &&
                !claimed.has(candidate.id) &&
                Date.parse(candidate.endAt) > now.getTime()
        )
        .sort((left, right) => {
            const channelPenalty = (candidate: BroadcastInstance) =>
                previous && candidate.epgChannelId !== previous.epgChannelId
                    ? 3_600_000
                    : 0;
            return (
                Math.abs(Date.parse(left.startAt) - priorStart) +
                channelPenalty(left) -
                (Math.abs(Date.parse(right.startAt) - priorStart) +
                    channelPenalty(right))
            );
        })[0];
}

function createSchedule(
    broadcast: BroadcastInstance,
    preferences: FollowedSeriesPreferences,
    now: Date,
    enabled: boolean
): AutoSwitchSchedule {
    return {
        id: `switch-${stableHash(broadcast.id)}`,
        broadcastId: broadcast.id,
        episodeId: broadcast.episodeId,
        seriesId: broadcast.seriesId,
        enabledAt: now.toISOString(),
        scheduledSwitchAt: scheduledSwitchTime(
            broadcast.startAt,
            preferences.switchLeadSeconds
        ),
        status: enabled ? 'enabled' : 'off',
        conflictGroupId: null,
    };
}

function deduplicateBroadcasts(
    broadcasts: readonly BroadcastInstance[]
): BroadcastInstance[] {
    return Array.from(
        new Map(
            broadcasts.map((broadcast) => [broadcast.id, broadcast])
        ).values()
    ).sort(
        (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt)
    );
}
