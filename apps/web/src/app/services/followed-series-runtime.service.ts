import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
    buildFollowedSeriesChannelInventory,
    FollowedSeriesChannelInventoryEntry,
    FollowedSeriesEvent,
    FollowedSeriesService,
    probeFollowedSeriesStream,
} from '@iptvnator/epg/data-access';
import {
    ChannelActions,
    PlaylistActions,
    selectActive,
    selectActivePlaylistId,
    selectChannels,
} from '@iptvnator/m3u-state';
import {
    PlaylistsService,
    RuntimeCapabilitiesService,
} from '@iptvnator/services';
import {
    Channel,
    FollowedSeriesSwitchRequest,
} from '@iptvnator/shared/interfaces';
import { filter, firstValueFrom, take, timeout } from 'rxjs';

interface PreviousPlayback {
    channel: Channel;
    playlistId: string;
}

@Injectable({ providedIn: 'root' })
export class FollowedSeriesRuntimeService {
    private readonly actions$ = inject(Actions);
    private readonly destroyRef = inject(DestroyRef);
    private readonly followed = inject(FollowedSeriesService);
    private readonly playlists = inject(PlaylistsService);
    private readonly router = inject(Router);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly store = inject(Store);
    private inventory: FollowedSeriesChannelInventoryEntry[] = [];
    private inventoryPromise: Promise<void> | null = null;
    private inventoryRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly returnTimers = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();
    private started = false;

    start(): void {
        if (this.started) return;
        this.started = true;
        this.followed.switchRequests$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((request) => void this.handleSwitch(request));
        this.followed.events$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((event) => this.showNotification(event));
        this.actions$
            .pipe(
                ofType(
                    PlaylistActions.loadPlaylistsSuccess,
                    PlaylistActions.updatePlaylist,
                    PlaylistActions.addPlaylist,
                    PlaylistActions.removePlaylist
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => this.scheduleInventoryRefresh());
        void this.refreshInventory();
        this.followed.start();
        this.destroyRef.onDestroy(() => {
            if (this.inventoryRefreshTimer) {
                clearTimeout(this.inventoryRefreshTimer);
            }
            this.returnTimers.forEach((timer) => clearTimeout(timer));
            this.returnTimers.clear();
        });
    }

    requestNotificationPermission(): Promise<NotificationPermission> {
        if (typeof Notification === 'undefined') {
            return Promise.resolve('denied');
        }
        return Notification.requestPermission();
    }

    private async refreshInventory(): Promise<void> {
        if (this.inventoryPromise) return this.inventoryPromise;
        this.inventoryPromise = firstValueFrom(this.playlists.getAllData())
            .then((playlists) => {
                this.inventory = buildFollowedSeriesChannelInventory(playlists);
                this.followed.setChannelMappings(
                    this.inventory.map((entry) => entry.mapping)
                );
            })
            .catch(() => {
                this.inventory = [];
                this.followed.setChannelMappings([]);
            })
            .finally(() => {
                this.inventoryPromise = null;
            });
        return this.inventoryPromise;
    }

    private scheduleInventoryRefresh(): void {
        if (this.inventoryRefreshTimer)
            clearTimeout(this.inventoryRefreshTimer);
        this.inventoryRefreshTimer = setTimeout(() => {
            this.inventoryRefreshTimer = null;
            void this.refreshInventory();
        }, 500);
    }

    private async handleSwitch(
        request: FollowedSeriesSwitchRequest,
        backgroundConfirmed = false
    ): Promise<void> {
        if (
            !backgroundConfirmed &&
            !this.runtime.isElectron &&
            document.visibilityState !== 'visible'
        ) {
            this.showBackgroundAction(request);
            this.followed.reportPermissionRequired(request.schedule.id);
            return;
        }
        if (this.isPlaybackBlocked()) {
            this.followed.reportSwitchFailure(
                request.schedule.id,
                'Automatic switching is disabled while recording or casting.'
            );
            return;
        }
        await this.refreshInventory();
        const candidates = this.resolveCandidates(request);
        if (candidates.length === 0) {
            this.followed.reportSwitchFailure(
                request.schedule.id,
                'No mapped stream is available for this broadcast.'
            );
            return;
        }
        const previous = await this.capturePreviousPlayback();
        for (const candidate of candidates) {
            if (
                !(await probeFollowedSeriesStream(
                    candidate.channel.url,
                    window.electron?.xtreamProbeUrl
                ))
            ) {
                continue;
            }
            const switched = await this.activateChannel(candidate);
            if (!switched) continue;
            this.followed.reportSwitchSuccess(request.schedule.id);
            this.scheduleReturn(request, previous, candidate);
            return;
        }
        await this.restorePreviousPlayback(previous);
        this.followed.reportSwitchFailure(
            request.schedule.id,
            'The target and backup streams could not be opened.'
        );
    }

    private resolveCandidates(
        request: FollowedSeriesSwitchRequest
    ): FollowedSeriesChannelInventoryEntry[] {
        const preferredIds = new Set(
            this.followed.preferences().preferredChannelIds
        );
        return this.inventory
            .filter(
                (entry) =>
                    entry.mapping.id === request.broadcast.channelMappingId ||
                    entry.mapping.epgChannelIds.some(
                        (id) =>
                            id.toLowerCase() ===
                            request.broadcast.epgChannelId.toLowerCase()
                    )
            )
            .sort(
                (left, right) =>
                    Number(
                        right.mapping.id === request.broadcast.channelMappingId
                    ) -
                        Number(
                            left.mapping.id ===
                                request.broadcast.channelMappingId
                        ) ||
                    Number(preferredIds.has(right.mapping.channelId)) -
                        Number(preferredIds.has(left.mapping.channelId))
            );
    }

    private async activateChannel(
        entry: FollowedSeriesChannelInventoryEntry
    ): Promise<boolean> {
        if (
            !(await this.router.navigate([
                '/workspace/playlists',
                entry.mapping.playlistId,
                'all',
            ]))
        ) {
            return false;
        }
        try {
            await firstValueFrom(
                this.store.select(selectChannels).pipe(
                    filter((channels) =>
                        channels.some(
                            (channel) =>
                                channel.id === entry.channel.id ||
                                channel.url === entry.channel.url
                        )
                    ),
                    take(1),
                    timeout(10_000)
                )
            );
        } catch {
            return false;
        }
        const success = firstValueFrom(
            this.actions$.pipe(
                ofType(ChannelActions.setActiveChannelSuccess),
                filter(
                    (action) =>
                        action.channel.id === entry.channel.id ||
                        action.channel.url === entry.channel.url
                ),
                take(1),
                timeout(8_000)
            )
        ).then(
            () => true,
            () => false
        );
        this.store.dispatch(
            ChannelActions.setActiveChannel({
                channel: entry.channel,
                startPlayback: true,
            })
        );
        return success;
    }

    private async capturePreviousPlayback(): Promise<PreviousPlayback | null> {
        const [channel, playlistId] = await Promise.all([
            firstValueFrom(this.store.select(selectActive).pipe(take(1))),
            firstValueFrom(
                this.store.select(selectActivePlaylistId).pipe(take(1))
            ),
        ]);
        return channel && playlistId ? { channel, playlistId } : null;
    }

    private async restorePreviousPlayback(
        previous: PreviousPlayback | null
    ): Promise<void> {
        if (!previous) return;
        if (
            !(await this.router.navigate([
                '/workspace/playlists',
                previous.playlistId,
                'all',
            ]))
        ) {
            return;
        }
        this.store.dispatch(
            ChannelActions.setActiveChannel({
                channel: previous.channel,
                startPlayback: true,
            })
        );
    }

    private scheduleReturn(
        request: FollowedSeriesSwitchRequest,
        previous: PreviousPlayback | null,
        target: FollowedSeriesChannelInventoryEntry
    ): void {
        if (!previous || !this.followed.preferences().returnToPreviousChannel) {
            return;
        }
        if (
            this.followed.preferences().playNextScheduledEpisode &&
            this.followed
                .schedules()
                .some(
                    (schedule) =>
                        schedule.id !== request.schedule.id &&
                        !['off', 'ended', 'broadcast-unavailable'].includes(
                            schedule.status
                        ) &&
                        Date.parse(schedule.scheduledSwitchAt) > Date.now() &&
                        Date.parse(schedule.scheduledSwitchAt) <=
                            Date.parse(request.broadcast.endAt)
                )
        ) {
            return;
        }
        const delay = Date.parse(request.broadcast.endAt) - Date.now();
        if (delay <= 0) return;
        const existingTimer = this.returnTimers.get(request.schedule.id);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(
            async () => {
                this.returnTimers.delete(request.schedule.id);
                const active = await firstValueFrom(
                    this.store.select(selectActive).pipe(take(1))
                );
                if (active?.id !== target.channel.id) return;
                await this.router.navigate([
                    '/workspace/playlists',
                    previous.playlistId,
                    'all',
                ]);
                this.store.dispatch(
                    ChannelActions.setActiveChannel({
                        channel: previous.channel,
                        startPlayback: true,
                    })
                );
            },
            Math.min(delay, 2_147_000_000)
        );
        this.returnTimers.set(request.schedule.id, timer);
    }

    private isPlaybackBlocked(): boolean {
        const preferences = this.followed.preferences();
        const recording = Boolean(
            document.querySelector('[data-recording-active="true"]')
        );
        const video = document.querySelector('video') as
            (HTMLVideoElement & { remote?: { state?: string } }) | null;
        const casting = video?.remote?.state === 'connected';
        return (
            (preferences.disableWhileRecording && recording) ||
            (preferences.disableWhileCasting && casting)
        );
    }

    private showNotification(event: FollowedSeriesEvent): void {
        if (!this.followed.preferences().notifications.enabled) return;
        if (
            event.kind === 'switch-failed' &&
            !this.followed.preferences().notifications.failures
        ) {
            return;
        }
        this.snackBar.open(`${event.title}: ${event.body}`, 'Close', {
            duration: 6_000,
        });
        if (
            this.followed.preferences().notifications.enabled &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
        ) {
            new Notification(event.title, { body: event.body });
        }
    }

    private showBackgroundAction(request: FollowedSeriesSwitchRequest): void {
        if (
            !this.followed.preferences().notifications.enabled ||
            typeof Notification === 'undefined' ||
            Notification.permission !== 'granted'
        ) {
            return;
        }
        const notification = new Notification(request.series.title, {
            body: `${request.episode.title} is starting on ${request.broadcast.channelName}.`,
        });
        notification.onclick = () => {
            window.focus();
            void this.handleSwitch(request, true);
            notification.close();
        };
    }
}
