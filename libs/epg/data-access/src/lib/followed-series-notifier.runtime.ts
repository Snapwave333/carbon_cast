import { Subject } from 'rxjs';
import {
    FollowedSeriesPersistedState,
    FollowedSeriesSwitchRequest,
} from '@iptvnator/shared/interfaces';
import {
    FollowedSeriesEvent,
    FollowedSeriesEventKind,
} from './followed-series-event.model';

export interface FollowedSeriesNotifierHost {
    snapshot(): FollowedSeriesPersistedState;
    resolveRequest(scheduleId: string): FollowedSeriesSwitchRequest | null;
}

export class FollowedSeriesNotifierRuntime {
    private readonly eventSubject = new Subject<FollowedSeriesEvent>();
    private readonly remindersSent = new Set<string>();
    readonly events$ = this.eventSubject.asObservable();

    constructor(private readonly host: FollowedSeriesNotifierHost) {}

    emitRefreshEvents(
        newEpisodeIds: string[],
        changedScheduleIds: string[],
        canceledScheduleIds: string[]
    ): void {
        const state = this.host.snapshot();
        if (!state.preferences.notifications.enabled) return;
        if (state.preferences.notifications.newEpisode) {
            this.emitIds(
                'new-episode',
                newEpisodeIds,
                'A new upcoming episode was found.'
            );
        }
        if (state.preferences.notifications.scheduleChanges) {
            this.emitIds(
                'schedule-changed',
                changedScheduleIds,
                'The broadcast schedule changed.'
            );
            this.emitIds(
                'broadcast-canceled',
                canceledScheduleIds,
                'The scheduled broadcast is no longer available.'
            );
        }
    }

    emitStartingSoonReminders(now: number): void {
        const state = this.host.snapshot();
        if (!state.preferences.notifications.enabled) return;
        const thresholds = {
            'five-minutes': 300_000,
            'one-minute': 60_000,
            'ten-seconds': 10_000,
            'countdown-only': state.preferences.switchCountdownSeconds * 1_000,
        } as const;
        const threshold = thresholds[state.preferences.notifications.timing];
        for (const broadcast of state.broadcasts) {
            const remaining = Date.parse(broadcast.startAt) - now;
            const key = `${broadcast.id}:${threshold}`;
            if (
                remaining <= 0 ||
                remaining > threshold ||
                this.remindersSent.has(key)
            ) {
                continue;
            }
            this.remindersSent.add(key);
            const schedule = state.schedules.find(
                (item) => item.broadcastId === broadcast.id
            );
            const request = schedule
                ? this.host.resolveRequest(schedule.id)
                : null;
            if (request) {
                this.emitSwitchEvent(
                    'starting-soon',
                    request,
                    `Starts on ${broadcast.channelName}`
                );
            }
        }
    }

    emitSwitchEvent(
        kind: FollowedSeriesEventKind,
        request: FollowedSeriesSwitchRequest,
        body: string
    ): void {
        this.eventSubject.next({
            kind,
            title: `${request.series.title} - ${request.episode.title}`,
            body,
            seriesId: request.series.id,
            episodeId: request.episode.id,
            broadcastId: request.broadcast.id,
        });
    }

    private emitIds(
        kind: FollowedSeriesEventKind,
        ids: string[],
        body: string
    ): void {
        const state = this.host.snapshot();
        for (const id of ids) {
            const schedule = state.schedules.find((item) => item.id === id);
            const request = schedule
                ? this.host.resolveRequest(schedule.id)
                : null;
            if (request) {
                this.emitSwitchEvent(kind, request, body);
                continue;
            }
            const episode = state.episodes.find((item) => item.id === id);
            const series = episode
                ? state.followedSeries.find(
                      (item) => item.id === episode.seriesId
                  )
                : undefined;
            if (episode && series) {
                this.eventSubject.next({
                    kind,
                    title: series.title,
                    body,
                    seriesId: series.id,
                    episodeId: episode.id,
                });
            }
        }
    }
}
