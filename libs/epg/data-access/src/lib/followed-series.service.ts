import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';
import {
    FollowedSeriesChannelMapping,
    FollowedSeriesPersistedState,
    FollowedSeriesPreferencesPatch,
    FollowSeriesRequest,
} from '@iptvnator/shared/interfaces';
import { EpgRuntimeBridgeService } from './epg-runtime-bridge.service';
import { matchFollowedSeriesPrograms } from './followed-series-matcher.util';
import { createFollowedSeries } from './followed-series-identity.util';
import {
    buildFollowedSeriesQueryHints,
    normalizeFollowedSeriesTitle,
} from './followed-series-normalization.util';
import { reconcileFollowedSeriesSchedule } from './followed-series-reconciliation.util';
import { scheduledSwitchTime } from './followed-series-scheduler.util';
import {
    FollowedSeriesStorageService,
    mergeFollowedSeriesPreferences,
} from './followed-series-storage.service';
import { FollowedSeriesTimerRuntime } from './followed-series-timer.runtime';
import { queryFollowedSeriesProgramBatches } from './followed-series-query.util';
import { buildFollowedSeriesRefreshStatus } from './followed-series-state.util';

const REFRESH_INTERVAL_MS = 15 * 60 * 1_000;
const LOOKAHEAD_MS = 14 * 24 * 60 * 60 * 1_000;

@Injectable({ providedIn: 'root' })
export class FollowedSeriesService {
    private readonly bridge = inject(EpgRuntimeBridgeService);
    private readonly storage = inject(FollowedSeriesStorageService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly stateSignal = signal(this.storage.load());
    private readonly channelMappingsSignal = signal<
        FollowedSeriesChannelMapping[]
    >([]);
    private readonly timer = new FollowedSeriesTimerRuntime({
        snapshot: () => this.stateSignal(),
        patch: (patch) => this.patchState(patch),
        refresh: () => this.refresh(),
    });
    private refreshPromise: Promise<void> | null = null;
    private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
    private started = false;
    private persistQueued = false;

    readonly state = this.stateSignal.asReadonly();
    readonly followedSeries = computed(() => this.stateSignal().followedSeries);
    readonly episodes = computed(() => this.stateSignal().episodes);
    readonly broadcasts = computed(() => this.stateSignal().broadcasts);
    readonly schedules = computed(() => this.stateSignal().schedules);
    readonly conflicts = computed(() => this.stateSignal().conflicts);
    readonly preferences = computed(() => this.stateSignal().preferences);
    readonly refreshStatus = computed(() => this.stateSignal().refreshStatus);
    readonly channelMappings = this.channelMappingsSignal.asReadonly();
    readonly countdown = this.timer.countdown;
    readonly switchRequests$ = this.timer.switchRequests$;
    readonly events$ = this.timer.events$;
    readonly pendingConflict = computed(() =>
        this.preferences().conflictBehavior === 'prompt'
            ? (this.conflicts().find(
                  (conflict) =>
                      !conflict.selectedScheduleId &&
                      Date.parse(conflict.scheduledSwitchAt) > Date.now()
              ) ?? null)
            : null
    );

    start(): void {
        if (this.started) return;
        this.started = true;
        void this.refresh();
        this.refreshIntervalId = setInterval(
            () => void this.refresh(),
            REFRESH_INTERVAL_MS
        );
        this.bridge.onProgress((progress) => {
            if (progress.status === 'complete') void this.refresh();
        });
        this.timer.start();
        this.destroyRef.onDestroy(() => this.stop());
    }

    stop(): void {
        if (this.refreshIntervalId) clearInterval(this.refreshIntervalId);
        this.refreshIntervalId = null;
        this.started = false;
        this.timer.stop();
    }

    setChannelMappings(mappings: FollowedSeriesChannelMapping[]): void {
        this.channelMappingsSignal.set(mappings);
        if (this.started && this.followedSeries().length > 0)
            void this.refresh();
    }

    findFollowed(request: FollowSeriesRequest) {
        const sourceId =
            request.sourceSeriesId == null
                ? ''
                : String(request.sourceSeriesId).trim();
        const normalizedTitle = normalizeFollowedSeriesTitle(request.title);
        return this.followedSeries().find(
            (series) =>
                (sourceId &&
                    series.source === request.source &&
                    series.sourceSeriesId === sourceId &&
                    series.sourcePlaylistId ===
                        (request.sourcePlaylistId?.trim() || undefined)) ||
                series.normalizedTitle === normalizedTitle
        );
    }

    follow(request: FollowSeriesRequest): string {
        const existing = this.findFollowed(request);
        if (existing) return existing.id;
        const series = createFollowedSeries(request);
        series.autoSwitchDefault = this.preferences().defaultAutoSwitch;
        if (request.epgProgram?.seriesId && request.source === 'epg') {
            series.sourceSeriesId = request.epgProgram.seriesId;
        }
        this.patchState({ followedSeries: [...this.followedSeries(), series] });
        void this.refresh();
        return series.id;
    }

    unfollow(seriesId: string): void {
        const survivingScheduleIds = new Set(
            this.schedules()
                .filter((schedule) => schedule.seriesId !== seriesId)
                .map((schedule) => schedule.id)
        );
        this.patchState({
            followedSeries: this.followedSeries().filter(
                (item) => item.id !== seriesId
            ),
            episodes: this.episodes().filter(
                (episode) => episode.seriesId !== seriesId
            ),
            broadcasts: this.broadcasts().filter(
                (broadcast) => broadcast.seriesId !== seriesId
            ),
            schedules: this.schedules().filter(
                (schedule) => schedule.seriesId !== seriesId
            ),
            conflicts: this.conflicts().filter((conflict) =>
                conflict.scheduleIds.some((id) => survivingScheduleIds.has(id))
            ),
        });
        this.timer.arm();
    }

    setSeriesPriority(seriesId: string, priority: number): void {
        const normalizedPriority = Number.isFinite(priority)
            ? Math.min(999, Math.max(0, Math.trunc(priority)))
            : 0;
        this.patchState({
            followedSeries: this.followedSeries().map((series) =>
                series.id === seriesId
                    ? { ...series, priority: normalizedPriority }
                    : series
            ),
        });
    }

    updatePreferences(patch: FollowedSeriesPreferencesPatch): void {
        const preferences = mergeFollowedSeriesPreferences(
            this.preferences(),
            patch
        );
        const schedules = this.schedules().map((schedule) => {
            const broadcast = this.broadcasts().find(
                (item) => item.id === schedule.broadcastId
            );
            return broadcast
                ? {
                      ...schedule,
                      scheduledSwitchAt: scheduledSwitchTime(
                          broadcast.startAt,
                          preferences.switchLeadSeconds
                      ),
                  }
                : schedule;
        });
        this.patchState({ preferences, schedules });
        this.timer.rebuildConflicts();
        this.timer.arm();
    }

    async refresh(): Promise<void> {
        if (this.refreshPromise) return this.refreshPromise;
        this.refreshPromise = this.performRefresh()
            .catch(() => {
                this.setRefreshStatus(
                    'error',
                    new Date().toISOString(),
                    'The followed-series schedule could not be refreshed.',
                    0
                );
            })
            .finally(() => {
                this.refreshPromise = null;
            });
        return this.refreshPromise;
    }

    enableAutoSwitch(broadcastId: string): void {
        this.updateSchedule(broadcastId, 'enabled');
    }

    disableAutoSwitch(broadcastId: string): void {
        this.updateSchedule(broadcastId, 'off');
        if (this.countdown()?.broadcastId === broadcastId) {
            this.countdown.set(null);
        }
    }

    cancelCountdown(scheduleId: string): void {
        this.timer.cancel(scheduleId);
    }

    switchNow(scheduleId: string, refresh = true): Promise<void> {
        return this.timer.switchNow(scheduleId, refresh);
    }

    chooseConflict(conflictId: string, scheduleId: string): void {
        this.patchState({
            conflicts: this.conflicts().map((conflict) =>
                conflict.id === conflictId &&
                conflict.scheduleIds.includes(scheduleId)
                    ? {
                          ...conflict,
                          selectedScheduleId: scheduleId,
                          resolvedAt: new Date().toISOString(),
                      }
                    : conflict
            ),
        });
    }

    reportSwitchSuccess(scheduleId: string): void {
        this.timer.reportSwitchSuccess(scheduleId);
    }

    reportSwitchFailure(scheduleId: string, reason: string): void {
        this.timer.reportSwitchFailure(scheduleId, reason);
    }

    reportPermissionRequired(scheduleId: string): void {
        this.timer.reportPermissionRequired(scheduleId);
    }

    removeExpiredEpisodes(): void {
        const cutoff = Date.now() - 24 * 60 * 60 * 1_000;
        const broadcasts = this.broadcasts().filter(
            (broadcast) => Date.parse(broadcast.endAt) >= cutoff
        );
        const broadcastIds = new Set(
            broadcasts.map((broadcast) => broadcast.id)
        );
        const episodes = this.episodes()
            .map((episode) => ({
                ...episode,
                broadcastIds: episode.broadcastIds.filter((id) =>
                    broadcastIds.has(id)
                ),
            }))
            .filter((episode) => episode.broadcastIds.length > 0);
        this.patchState({
            broadcasts,
            episodes,
            schedules: this.schedules().filter((schedule) =>
                broadcastIds.has(schedule.broadcastId)
            ),
        });
    }

    private async performRefresh(): Promise<void> {
        const series = this.followedSeries();
        const attemptedAt = new Date().toISOString();
        this.setRefreshStatus('refreshing', attemptedAt, null, 0);
        if (series.length === 0) {
            this.patchState({
                episodes: [],
                broadcasts: [],
                schedules: [],
                conflicts: [],
            });
            this.setRefreshStatus('success', attemptedAt, null, 0);
            return;
        }
        const now = new Date();
        const candidates = await queryFollowedSeriesProgramBatches(
            this.bridge,
            {
                from: new Date(
                    now.getTime() - 6 * 60 * 60 * 1_000
                ).toISOString(),
                to: new Date(now.getTime() + LOOKAHEAD_MS).toISOString(),
                titleHints: buildFollowedSeriesQueryHints(series),
                limit: 5_000,
            }
        );
        if (!candidates) {
            this.setRefreshStatus(
                'offline',
                attemptedAt,
                'EPG data is unavailable.',
                0
            );
            return;
        }
        const matched = matchFollowedSeriesPrograms(
            series,
            candidates,
            this.channelMappingsSignal(),
            this.preferences(),
            now
        );
        const result = reconcileFollowedSeriesSchedule({
            previousEpisodes: this.episodes(),
            previousBroadcasts: this.broadcasts(),
            previousSchedules: this.schedules(),
            nextEpisodes: matched.episodes,
            nextBroadcasts: matched.broadcasts,
            series,
            preferences: this.preferences(),
            now,
        });
        this.patchState({
            episodes: result.episodes,
            broadcasts: result.broadcasts,
            schedules: result.schedules,
        });
        this.timer.rebuildConflicts();
        this.setRefreshStatus('success', attemptedAt, null, candidates.length);
        this.timer.emitRefreshEvents(
            result.newEpisodeIds,
            result.changedScheduleIds,
            result.canceledScheduleIds
        );
        this.timer.arm();
    }

    private updateSchedule(
        broadcastId: string,
        status: 'enabled' | 'off'
    ): void {
        const now = new Date().toISOString();
        this.patchState({
            schedules: this.schedules().map((schedule) =>
                schedule.broadcastId === broadcastId
                    ? {
                          ...schedule,
                          status,
                          enabledAt:
                              status === 'enabled' ? now : schedule.enabledAt,
                          lastError: undefined,
                      }
                    : schedule
            ),
        });
        this.timer.rebuildConflicts();
        this.timer.arm();
    }

    private setRefreshStatus(
        state: FollowedSeriesPersistedState['refreshStatus']['state'],
        attemptedAt: string,
        error: string | null,
        candidateCount: number
    ): void {
        this.patchState({
            refreshStatus: buildFollowedSeriesRefreshStatus(
                this.refreshStatus(),
                state,
                attemptedAt,
                error,
                candidateCount
            ),
        });
    }

    private patchState(patch: Partial<FollowedSeriesPersistedState>): void {
        this.stateSignal.update((state) => ({ ...state, ...patch }));
        if (this.persistQueued) return;
        this.persistQueued = true;
        queueMicrotask(() => {
            this.persistQueued = false;
            this.storage.save(this.stateSignal());
        });
    }
}
