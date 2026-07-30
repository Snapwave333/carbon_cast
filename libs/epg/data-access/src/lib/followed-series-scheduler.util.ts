import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
    FollowedSeriesConflictBehavior,
    FollowedSeriesConflictGroup,
} from '@iptvnator/shared/interfaces';
import { stableHash } from './followed-series-normalization.util';

export interface ScheduledSwitchEntry {
    schedule: AutoSwitchSchedule;
    switchAtMs: number;
}

export class AutoSwitchPriorityQueue {
    private heap: ScheduledSwitchEntry[] = [];

    get size(): number {
        return this.heap.length;
    }

    clear(): void {
        this.heap = [];
    }

    peek(): ScheduledSwitchEntry | undefined {
        return this.heap[0];
    }

    push(entry: ScheduledSwitchEntry): void {
        this.heap.push(entry);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): ScheduledSwitchEntry | undefined {
        const root = this.heap[0];
        const tail = this.heap.pop();
        if (!root || !tail || this.heap.length === 0) return root;
        this.heap[0] = tail;
        this.bubbleDown(0);
        return root;
    }

    rebuild(schedules: readonly AutoSwitchSchedule[]): void {
        this.clear();
        for (const schedule of schedules) {
            if (
                schedule.status === 'enabled' ||
                schedule.status === 'schedule-changed' ||
                schedule.status === 'switching-soon'
            ) {
                this.push({
                    schedule,
                    switchAtMs: Date.parse(schedule.scheduledSwitchAt),
                });
            }
        }
    }

    private bubbleUp(startIndex: number): void {
        let index = startIndex;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.compare(this.heap[parent], this.heap[index]) <= 0) break;
            [this.heap[parent], this.heap[index]] = [
                this.heap[index],
                this.heap[parent],
            ];
            index = parent;
        }
    }

    private bubbleDown(startIndex: number): void {
        let index = startIndex;
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;
            if (
                left < this.heap.length &&
                this.compare(this.heap[left], this.heap[smallest]) < 0
            ) {
                smallest = left;
            }
            if (
                right < this.heap.length &&
                this.compare(this.heap[right], this.heap[smallest]) < 0
            ) {
                smallest = right;
            }
            if (smallest === index) break;
            [this.heap[index], this.heap[smallest]] = [
                this.heap[smallest],
                this.heap[index],
            ];
            index = smallest;
        }
    }

    private compare(
        left: ScheduledSwitchEntry,
        right: ScheduledSwitchEntry
    ): number {
        return (
            left.switchAtMs - right.switchAtMs ||
            left.schedule.enabledAt.localeCompare(right.schedule.enabledAt)
        );
    }
}

export function buildAutoSwitchConflicts(
    schedules: readonly AutoSwitchSchedule[]
): FollowedSeriesConflictGroup[] {
    const enabled = schedules
        .filter(
            (schedule) =>
                schedule.status !== 'off' && schedule.status !== 'ended'
        )
        .sort(
            (left, right) =>
                Date.parse(left.scheduledSwitchAt) -
                Date.parse(right.scheduledSwitchAt)
        );
    const groups: FollowedSeriesConflictGroup[] = [];
    let bucket: AutoSwitchSchedule[] = [];
    const flush = () => {
        if (bucket.length > 1) {
            const scheduledSwitchAt = bucket[0].scheduledSwitchAt;
            groups.push({
                id: `conflict-${stableHash(
                    bucket
                        .map((schedule) => schedule.id)
                        .sort()
                        .join('|')
                )}`,
                scheduledSwitchAt,
                scheduleIds: bucket.map((schedule) => schedule.id),
                selectedScheduleId: null,
                resolvedAt: null,
            });
        }
        bucket = [];
    };

    for (const schedule of enabled) {
        if (
            bucket.length > 0 &&
            Math.abs(
                Date.parse(schedule.scheduledSwitchAt) -
                    Date.parse(bucket[0].scheduledSwitchAt)
            ) > 1_000
        ) {
            flush();
        }
        bucket.push(schedule);
    }
    flush();
    return groups;
}

export function selectConflictWinner(
    conflict: FollowedSeriesConflictGroup,
    schedules: readonly AutoSwitchSchedule[],
    broadcasts: readonly BroadcastInstance[],
    episodes: readonly FollowedEpisode[],
    series: readonly FollowedSeries[],
    behavior: FollowedSeriesConflictBehavior = 'priority'
): AutoSwitchSchedule | undefined {
    if (conflict.selectedScheduleId) {
        return schedules.find(
            (schedule) => schedule.id === conflict.selectedScheduleId
        );
    }
    if (behavior === 'prompt') return undefined;
    const broadcastsById = new Map(
        broadcasts.map((broadcast) => [broadcast.id, broadcast])
    );
    const episodesById = new Map(
        episodes.map((episode) => [episode.id, episode])
    );
    const seriesById = new Map(series.map((item) => [item.id, item]));
    return conflict.scheduleIds
        .map((id) => schedules.find((schedule) => schedule.id === id))
        .filter((schedule): schedule is AutoSwitchSchedule => Boolean(schedule))
        .sort((left, right) => {
            const leftSeries = seriesById.get(left.seriesId);
            const rightSeries = seriesById.get(right.seriesId);
            const leftEpisode = episodesById.get(left.episodeId);
            const rightEpisode = episodesById.get(right.episodeId);
            const leftBroadcast = broadcastsById.get(left.broadcastId);
            const rightBroadcast = broadcastsById.get(right.broadcastId);
            const availabilityOrder =
                Number(rightBroadcast?.availability === 'scheduled') -
                Number(leftBroadcast?.availability === 'scheduled');
            const firstAvailableOrder =
                availabilityOrder ||
                Date.parse(leftBroadcast?.startAt ?? left.scheduledSwitchAt) -
                    Date.parse(
                        rightBroadcast?.startAt ?? right.scheduledSwitchAt
                    ) ||
                left.enabledAt.localeCompare(right.enabledAt);
            return behavior === 'first-available'
                ? firstAvailableOrder
                : (rightSeries?.priority ?? 0) - (leftSeries?.priority ?? 0) ||
                      Number(rightEpisode?.newness === 'new') -
                          Number(leftEpisode?.newness === 'new') ||
                      left.enabledAt.localeCompare(right.enabledAt) ||
                      Date.parse(
                          leftBroadcast?.startAt ?? left.scheduledSwitchAt
                      ) -
                          Date.parse(
                              rightBroadcast?.startAt ?? right.scheduledSwitchAt
                          ) ||
                      availabilityOrder;
        })[0];
}

export function scheduledSwitchTime(
    broadcastStartAt: string,
    leadSeconds: number
): string {
    return new Date(
        Date.parse(broadcastStartAt) - Math.max(0, leadSeconds) * 1_000
    ).toISOString();
}
