import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedSeriesCountdown,
    FollowedSeriesPersistedState,
    FollowedSeriesSwitchRequest,
} from '@iptvnator/shared/interfaces';
import {
    AutoSwitchPriorityQueue,
    buildAutoSwitchConflicts,
} from './followed-series-scheduler.util';
import { FollowedSeriesNotifierRuntime } from './followed-series-notifier.runtime';
import {
    appendFollowedSwitchHistory,
    buildEndedFollowedSeriesPatch,
    isFollowedSeriesConflictWinner,
    isUnresolvedPromptConflict,
    resolveFollowedSeriesSwitchRequest,
    withFollowedScheduleStatus,
} from './followed-series-state.util';

const MAX_TIMER_DELAY_MS = 60_000;

export interface FollowedSeriesTimerHost {
    snapshot(): FollowedSeriesPersistedState;
    patch(patch: Partial<FollowedSeriesPersistedState>): void;
    refresh(): Promise<void>;
}

export class FollowedSeriesTimerRuntime {
    private readonly queue = new AutoSwitchPriorityQueue();
    private readonly switchRequests =
        new Subject<FollowedSeriesSwitchRequest>();
    private readonly preflightReady = new Set<string>();
    private readonly inFlight = new Set<string>();
    private readonly attemptedBroadcasts = new Map<string, Set<string>>();
    private readonly notifier = new FollowedSeriesNotifierRuntime({
        snapshot: () => this.host.snapshot(),
        resolveRequest: (scheduleId) => this.resolveRequest(scheduleId),
    });
    private timerId: ReturnType<typeof setTimeout> | null = null;
    private started = false;

    readonly countdown = signal<FollowedSeriesCountdown | null>(null);
    readonly switchRequests$ = this.switchRequests.asObservable();
    readonly events$ = this.notifier.events$;

    constructor(private readonly host: FollowedSeriesTimerHost) {}

    start(): void {
        if (this.started) return;
        this.started = true;
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            document.addEventListener(
                'visibilitychange',
                this.handleVisibility
            );
        }
        this.arm();
    }

    stop(): void {
        if (this.timerId) clearTimeout(this.timerId);
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            document.removeEventListener(
                'visibilitychange',
                this.handleVisibility
            );
        }
        this.timerId = null;
        this.started = false;
    }

    arm(): void {
        if (this.timerId) clearTimeout(this.timerId);
        const state = this.host.snapshot();
        this.queue.rebuild(state.schedules);
        if (!this.started || state.followedSeries.length === 0) return;
        const next = this.queue.peek();
        const countdownMs = state.preferences.switchCountdownSeconds * 1_000;
        const wakeAt = next
            ? next.switchAtMs - countdownMs
            : Date.now() + MAX_TIMER_DELAY_MS;
        const delay = Math.max(
            0,
            Math.min(MAX_TIMER_DELAY_MS, wakeAt - Date.now())
        );
        this.timerId = setTimeout(() => this.process(), delay);
    }

    rebuildConflicts(): void {
        const state = this.host.snapshot();
        const previous = new Map(
            state.conflicts.map((conflict) => [conflict.id, conflict])
        );
        const conflicts = buildAutoSwitchConflicts(state.schedules).map(
            (conflict) => ({
                ...conflict,
                selectedScheduleId:
                    previous.get(conflict.id)?.selectedScheduleId ?? null,
                resolvedAt: previous.get(conflict.id)?.resolvedAt ?? null,
            })
        );
        const groupBySchedule = new Map<string, string>();
        conflicts.forEach((conflict) =>
            conflict.scheduleIds.forEach((id) =>
                groupBySchedule.set(id, conflict.id)
            )
        );
        this.host.patch({
            conflicts,
            schedules: state.schedules.map((schedule) => ({
                ...schedule,
                conflictGroupId: groupBySchedule.get(schedule.id) ?? null,
            })),
        });
    }

    async switchNow(scheduleId: string, refresh = true): Promise<void> {
        if (refresh) {
            await this.host.refresh();
            if (this.host.snapshot().refreshStatus.state !== 'success') {
                this.setStatus(scheduleId, 'broadcast-unavailable');
                return;
            }
        }
        const schedule = this.host
            .snapshot()
            .schedules.find((item) => item.id === scheduleId);
        if (schedule) this.dispatchSwitch(schedule);
    }

    cancel(scheduleId: string): void {
        const request = this.resolveRequest(scheduleId);
        if (!request) return;
        this.inFlight.delete(scheduleId);
        this.setStatus(scheduleId, 'off');
        this.countdown.set(null);
        this.addHistory(
            scheduleId,
            request.broadcast.id,
            'canceled',
            'Canceled during countdown.'
        );
        this.arm();
    }

    reportSwitchSuccess(scheduleId: string): void {
        const request = this.resolveRequest(scheduleId);
        if (!request) return;
        this.inFlight.delete(scheduleId);
        this.setStatus(scheduleId, 'currently-playing');
        this.countdown.set(null);
        this.addHistory(scheduleId, request.broadcast.id, 'switched');
        this.notifier.emitSwitchEvent(
            'switched',
            request,
            `Now playing on ${request.broadcast.channelName}`
        );
        this.arm();
    }

    reportSwitchFailure(scheduleId: string, reason: string): void {
        const request = this.resolveRequest(scheduleId);
        if (!request) return;
        this.inFlight.delete(scheduleId);
        const attempted =
            this.attemptedBroadcasts.get(scheduleId) ?? new Set<string>();
        attempted.add(request.broadcast.id);
        this.attemptedBroadcasts.set(scheduleId, attempted);
        const state = this.host.snapshot();
        const alternative = request.broadcast.alternativeBroadcastIds
            .map((id) => state.broadcasts.find((item) => item.id === id))
            .find(
                (item): item is BroadcastInstance =>
                    item !== undefined &&
                    Boolean(item.channelMappingId) &&
                    !attempted.has(item.id)
            );
        if (alternative) {
            this.host.patch({
                schedules: state.schedules.map((schedule) =>
                    schedule.id === scheduleId
                        ? { ...schedule, broadcastId: alternative.id }
                        : schedule
                ),
            });
            const retry = this.host
                .snapshot()
                .schedules.find((schedule) => schedule.id === scheduleId);
            if (retry) this.dispatchSwitch(retry);
            return;
        }
        this.host.patch({
            schedules: state.schedules.map((schedule) =>
                schedule.id === scheduleId
                    ? {
                          ...schedule,
                          status: 'broadcast-unavailable',
                          lastError: reason,
                      }
                    : schedule
            ),
        });
        this.addHistory(scheduleId, request.broadcast.id, 'failed', reason);
        this.notifier.emitSwitchEvent('switch-failed', request, reason);
        this.countdown.set(null);
        this.arm();
    }

    reportPermissionRequired(scheduleId: string): void {
        this.inFlight.delete(scheduleId);
        this.setStatus(scheduleId, 'permission-required');
        this.countdown.set(null);
        this.arm();
    }

    emitRefreshEvents(
        newEpisodeIds: string[],
        changedScheduleIds: string[],
        canceledScheduleIds: string[]
    ): void {
        this.notifier.emitRefreshEvents(
            newEpisodeIds,
            changedScheduleIds,
            canceledScheduleIds
        );
    }

    private process(): void {
        const now = Date.now();
        this.markEnded(now);
        this.notifier.emitStartingSoonReminders(now);
        const state = this.host.snapshot();
        this.queue.rebuild(state.schedules);
        const next = this.queue.peek();
        if (next) {
            const countdownStart =
                next.switchAtMs -
                state.preferences.switchCountdownSeconds * 1_000;
            if (now >= next.switchAtMs) {
                if (this.waitingForConflictChoice(next.schedule)) {
                    this.timerId = setTimeout(() => this.process(), 1_000);
                    return;
                }
                if (this.preflightReady.has(next.schedule.id)) {
                    this.dispatchSwitch(next.schedule);
                } else {
                    void this.runPreflight(next.schedule.id);
                }
            } else if (now >= countdownStart) {
                if (this.waitingForConflictChoice(next.schedule)) {
                    this.timerId = setTimeout(() => this.process(), 1_000);
                    return;
                }
                this.beginCountdown(next.schedule);
            }
        }
        this.arm();
    }

    private beginCountdown(schedule: AutoSwitchSchedule): void {
        const request = this.resolveRequest(schedule.id);
        if (!request) return;
        if (!this.isConflictWinner(schedule)) {
            this.setStatus(schedule.id, 'off');
            return;
        }
        this.setStatus(schedule.id, 'switching-soon');
        this.countdown.set({
            scheduleId: schedule.id,
            broadcastId: request.broadcast.id,
            seriesTitle: request.series.title,
            episodeTitle: request.episode.title,
            channelName: request.broadcast.channelName,
            switchAt: schedule.scheduledSwitchAt,
        });
        void this.runPreflight(schedule.id);
    }

    private async runPreflight(scheduleId: string): Promise<void> {
        const flightKey = `preflight:${scheduleId}`;
        if (
            this.preflightReady.has(scheduleId) ||
            this.inFlight.has(flightKey)
        ) {
            return;
        }
        this.inFlight.add(flightKey);
        await this.host.refresh();
        this.inFlight.delete(flightKey);
        if (this.host.snapshot().refreshStatus.state !== 'success') {
            this.setStatus(scheduleId, 'broadcast-unavailable');
            this.countdown.set(null);
            this.arm();
            return;
        }
        const request = this.resolveRequest(scheduleId);
        if (
            request &&
            request.broadcast.availability !== 'canceled' &&
            request.broadcast.availability !== 'unavailable'
        ) {
            this.preflightReady.add(scheduleId);
        } else if (request) {
            this.setStatus(scheduleId, 'broadcast-unavailable');
        }
        this.process();
    }

    private dispatchSwitch(schedule: AutoSwitchSchedule): void {
        if (this.inFlight.has(schedule.id)) return;
        const request = this.resolveRequest(schedule.id);
        if (!request?.broadcast.channelMappingId) {
            this.setStatus(schedule.id, 'broadcast-unavailable');
            return;
        }
        if (!this.switchRequests.observed) {
            this.setStatus(schedule.id, 'permission-required');
            return;
        }
        this.inFlight.add(schedule.id);
        this.attemptedBroadcasts.set(
            schedule.id,
            new Set([request.broadcast.id])
        );
        this.switchRequests.next(request);
    }

    private resolveRequest(
        scheduleId: string
    ): FollowedSeriesSwitchRequest | null {
        return resolveFollowedSeriesSwitchRequest(
            this.host.snapshot(),
            scheduleId
        );
    }

    private isConflictWinner(schedule: AutoSwitchSchedule): boolean {
        return isFollowedSeriesConflictWinner(this.host.snapshot(), schedule);
    }

    private waitingForConflictChoice(schedule: AutoSwitchSchedule): boolean {
        return isUnresolvedPromptConflict(this.host.snapshot(), schedule);
    }

    private markEnded(now: number): void {
        const state = this.host.snapshot();
        const patch = buildEndedFollowedSeriesPatch(state, now);
        if (patch) this.host.patch(patch);
    }

    private setStatus(
        scheduleId: string,
        status: AutoSwitchSchedule['status']
    ): void {
        const state = this.host.snapshot();
        this.host.patch({
            schedules: withFollowedScheduleStatus(
                state.schedules,
                scheduleId,
                status
            ),
        });
    }

    private addHistory(
        scheduleId: string,
        broadcastId: string,
        outcome: 'canceled' | 'failed' | 'switched',
        reason?: string
    ): void {
        const state = this.host.snapshot();
        this.host.patch({
            history: appendFollowedSwitchHistory(
                state.history,
                scheduleId,
                broadcastId,
                outcome,
                reason
            ),
        });
    }

    private readonly handleOnline = () => void this.host.refresh();
    private readonly handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            void this.host.refresh();
            this.process();
        }
    };
}
