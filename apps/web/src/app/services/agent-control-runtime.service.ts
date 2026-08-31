import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import {
    ChannelActions,
    FavoritesActions,
    selectActive,
    selectActivePlaylistId,
    selectChannels,
    selectCurrentEpgProgram,
    selectFavorites,
} from '@iptvnator/m3u-state';
import { SettingsStore } from '@iptvnator/services';
import {
    type AgentControlRequest,
    type AgentControlResult,
    type Channel,
    type Settings,
} from '@iptvnator/shared/interfaces';
import { Store } from '@ngrx/store';
import {
    agentError,
    finiteOrNull,
    isFollowSource,
    normalizeError,
    numeric,
    safeChannel,
    safeProgram,
    stringOrUndefined,
    type SafeState,
} from './agent-control-runtime.helpers';
import { firstValueFrom, take } from 'rxjs';

type AgentRequest = AgentControlRequest & { correlationId: string };

/**
 * Executes agent requests against the same stores and media element used by
 * the GUI. It emits only redacted state, never source URLs or credentials.
 */
@Injectable({ providedIn: 'root' })
export class AgentControlRuntimeService {
    private readonly destroyRef = inject(DestroyRef);
    private readonly followed = inject(FollowedSeriesService);
    private readonly router = inject(Router);
    private readonly settings = inject(SettingsStore);
    private readonly store = inject(Store);
    private started = false;
    private updateTimer: ReturnType<typeof setInterval> | null = null;

    start(): void {
        if (this.started || !window.electron?.onAgentControlCommand) return;
        this.started = true;
        const unsubscribe = window.electron.onAgentControlCommand((request) => {
            void this.handle(request);
        });
        this.publishState();
        this.updateTimer = setInterval(() => this.publishState(), 1000);
        this.destroyRef.onDestroy(() => {
            unsubscribe();
            if (this.updateTimer) clearInterval(this.updateTimer);
            this.updateTimer = null;
            this.started = false;
        });
    }

    private async handle(request: AgentRequest): Promise<void> {
        const previousState = await this.snapshot();
        let result: AgentControlResult;
        try {
            const data = await this.execute(request);
            const state = await this.snapshot();
            result = {
                success: true,
                operation: request.operation,
                requested: request.params ?? {},
                previousState,
                state: { ...state, ...(data ? { data } : {}) },
                timestamp: new Date().toISOString(),
                correlationId: request.correlationId,
            };
        } catch (error) {
            const failure = normalizeError(error);
            result = {
                success: false,
                operation: request.operation,
                requested: request.params ?? {},
                previousState,
                state: await this.snapshot(),
                timestamp: new Date().toISOString(),
                correlationId: request.correlationId,
                error: failure,
            };
        }
        window.electron?.completeAgentControlCommand?.(result);
        this.publishState();
    }

    private async execute(request: AgentRequest): Promise<SafeState | void> {
        const params = request.params ?? {};
        switch (request.operation) {
            case 'player.getState':
                return this.playerState();
            case 'player.play':
                return this.play();
            case 'player.pause':
                return this.pause();
            case 'player.stop':
                return this.stop();
            case 'player.setVolume':
                return this.setVolume(params);
            case 'player.setMuted':
                return this.setMuted(params);
            case 'player.seek':
                return this.seek(params);
            case 'player.setFullscreen':
                return this.setFullscreen(params);
            case 'player.togglePictureInPicture':
                return this.togglePictureInPicture();
            case 'player.setSubtitle':
            case 'player.setAudioTrack':
            case 'recording.start':
            case 'recording.stop':
                throw agentError('operation-unsupported', 'This player engine does not expose that operation through the safe agent bridge.');
            case 'channel.list':
                return this.listChannels(params);
            case 'channel.switch':
                return this.switchChannel(params);
            case 'channel.next':
                return this.shiftChannel(1);
            case 'channel.previous':
                return this.shiftChannel(-1);
            case 'epg.getNowNext':
                return this.getNowNext();
            case 'epg.refresh':
                return this.refreshEpg();
            case 'favorite.list':
                return this.listFavorites();
            case 'favorite.set':
                return this.setFavorite(params);
            case 'follow.list':
                return this.listFollows();
            case 'follow.set':
                return this.setFollow(params);
            case 'follow.setAutoSwitch':
                return this.setAutoSwitch(params);
            case 'settings.get':
                return this.safeSettings();
            case 'settings.update':
                return this.updateSettings(params);
            case 'diagnostics.get':
                return this.diagnostics();
            case 'app.navigate':
                return this.navigate(params);
            default:
                throw agentError('invalid-request', `Unsupported operation: ${request.operation as string}`);
        }
    }

    private video(): HTMLVideoElement {
        const video = document.querySelector('video');
        if (!video) throw agentError('operation-unsupported', 'No built-in video surface is active.');
        return video;
    }

    private async play(): Promise<SafeState> {
        const video = this.video();
        await video.play();
        return this.playerState();
    }

    private pause(): SafeState {
        this.video().pause();
        return this.playerState();
    }

    private stop(): SafeState {
        const video = this.video();
        video.pause();
        if (Number.isFinite(video.duration)) video.currentTime = 0;
        return this.playerState();
    }

    private setVolume(params: Record<string, unknown>): SafeState {
        const volume = numeric(params.volume, 0, 1, 'volume');
        this.video().volume = volume;
        localStorage.setItem('volume', String(volume));
        return this.playerState();
    }

    private setMuted(params: Record<string, unknown>): SafeState {
        if (typeof params.muted !== 'boolean') throw agentError('invalid-request', 'muted must be boolean.');
        this.video().muted = params.muted;
        return this.playerState();
    }

    private seek(params: Record<string, unknown>): SafeState {
        const video = this.video();
        const seconds = numeric(params.seconds, 0, Number.isFinite(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER, 'seconds');
        video.currentTime = seconds;
        return this.playerState();
    }

    private async setFullscreen(params: Record<string, unknown>): Promise<SafeState> {
        if (typeof params.fullscreen !== 'boolean') throw agentError('invalid-request', 'fullscreen must be boolean.');
        if (params.fullscreen && !document.fullscreenElement) await this.video().requestFullscreen();
        if (!params.fullscreen && document.fullscreenElement) await document.exitFullscreen();
        return this.playerState();
    }

    private async togglePictureInPicture(): Promise<SafeState> {
        const video = this.video();
        if (!document.pictureInPictureEnabled) throw agentError('operation-unsupported', 'Picture-in-picture is not available.');
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await video.requestPictureInPicture();
        return this.playerState();
    }

    private async listChannels(params: Record<string, unknown>): Promise<SafeState> {
        const channels = await this.channels();
        const query = typeof params.query === 'string' ? params.query.trim().toLocaleLowerCase() : '';
        const limit = Math.trunc(typeof params.limit === 'number' ? params.limit : 50);
        if (!Number.isFinite(limit) || limit < 1 || limit > 200) throw agentError('invalid-request', 'limit must be between 1 and 200.');
        const matches = query ? channels.filter((channel) => channel.name?.toLocaleLowerCase().includes(query)) : channels;
        return {
            count: matches.length,
            // Without this an agent cannot tell "the playlist is empty" from
            // "this route never loaded the channels", and the TV guide is one
            // of the routes that does not.
            loaded: channels.length > 0 || !(await this.activePlaylistId()),
            channels: matches.slice(0, limit).map(safeChannel),
        };
    }

    /**
     * A playlist is open but its channels are not in the store, which happens
     * on routes that do not render the channel list (the guide, for one).
     * Reporting "not found" there sends the caller looking for a channel that
     * does exist.
     */
    private async assertChannelsLoaded(channels: Channel[]): Promise<void> {
        if (channels.length || !(await this.activePlaylistId())) {
            return;
        }

        throw agentError(
            'operation-unsupported',
            'The open playlist has not loaded its channels on this route. Navigate to a channel view first, for example app.navigate with the playlist\'s /all route.'
        );
    }

    private async switchChannel(params: Record<string, unknown>): Promise<SafeState> {
        const channels = await this.channels();
        await this.assertChannelsLoaded(channels);
        const number = typeof params.number === 'number' ? Math.trunc(params.number) : null;
        const id = typeof params.channelId === 'string' ? params.channelId : '';
        const channel = id ? channels.find((item) => item.id === id) : number ? channels[number - 1] : null;
        if (!channel) throw agentError('not-found', 'Channel was not found in the active playlist.');
        this.store.dispatch(ChannelActions.setActiveChannel({ channel, startPlayback: true }));
        return { channel: safeChannel(channel) };
    }

    private async shiftChannel(delta: number): Promise<SafeState> {
        const [channels, active] = await Promise.all([this.channels(), this.activeChannel()]);
        await this.assertChannelsLoaded(channels);
        const index = channels.findIndex((channel) => channel.id === active?.id);
        if (index < 0 || !channels.length) throw agentError('not-found', 'No active channel is available.');
        const channel = channels[(index + delta + channels.length) % channels.length];
        this.store.dispatch(ChannelActions.setActiveChannel({ channel, startPlayback: true }));
        return { channel: safeChannel(channel) };
    }

    private async getNowNext(): Promise<SafeState> {
        const current = await firstValueFrom(this.store.select(selectCurrentEpgProgram).pipe(take(1)));
        return { now: current ? safeProgram(current) : null };
    }

    private async refreshEpg(): Promise<SafeState> {
        const configured = this.settings.getSettings().epgUrl.filter(Boolean);
        if (!configured.length || !window.electron?.fetchEpg) throw agentError('operation-unsupported', 'No EPG source can be refreshed in this runtime.');
        const result = await window.electron.fetchEpg(configured);
        return { refreshed: result.success, skipped: result.skipped?.length ?? 0 };
    }

    private async listFavorites(): Promise<SafeState> {
        const [favorites, channels] = await Promise.all([
            firstValueFrom(this.store.select(selectFavorites).pipe(take(1))),
            this.channels(),
        ]);
        return { channels: channels.filter((channel) => favorites.includes(channel.id)).map(safeChannel) };
    }

    private async setFavorite(params: Record<string, unknown>): Promise<SafeState> {
        if (typeof params.channelId !== 'string' || typeof params.favorite !== 'boolean') throw agentError('invalid-request', 'channelId and favorite are required.');
        const [channels, favorites] = await Promise.all([this.channels(), firstValueFrom(this.store.select(selectFavorites).pipe(take(1)))]);
        const channel = channels.find((item) => item.id === params.channelId);
        if (!channel) throw agentError('not-found', 'Channel was not found in the active playlist.');
        if (favorites.includes(channel.id) !== params.favorite) this.store.dispatch(FavoritesActions.updateFavorites({ channel }));
        return { channel: safeChannel(channel), favorite: params.favorite };
    }

    private listFollows(): SafeState {
        return { series: this.followed.followedSeries().map((series) => ({ id: series.id, title: series.title, source: series.source, priority: series.priority, autoSwitchDefault: series.autoSwitchDefault })) };
    }

    private setFollow(params: Record<string, unknown>): SafeState {
        if (typeof params.seriesId === 'string' && params.followed === false) {
            this.followed.unfollow(params.seriesId);
            return { seriesId: params.seriesId, followed: false };
        }
        if (typeof params.title !== 'string' || !isFollowSource(params.source)) throw agentError('invalid-request', 'title and source are required to follow a series.');
        const id = this.followed.follow({ title: params.title.trim(), source: params.source, sourceSeriesId: stringOrUndefined(params.sourceSeriesId), sourcePlaylistId: stringOrUndefined(params.sourcePlaylistId) });
        return { seriesId: id, followed: true };
    }

    private setAutoSwitch(params: Record<string, unknown>): SafeState {
        if (typeof params.broadcastId !== 'string' || typeof params.enabled !== 'boolean') throw agentError('invalid-request', 'broadcastId and enabled are required.');
        if (params.enabled) this.followed.enableAutoSwitch(params.broadcastId);
        else this.followed.disableAutoSwitch(params.broadcastId);
        return { broadcastId: params.broadcastId, enabled: params.enabled };
    }

    private safeSettings(): SafeState {
        const settings = this.settings.getSettings();
        return { player: settings.player, webPlayerSharedControls: settings.webPlayerSharedControls === true, mirrorLayout: settings.mirrorLayout !== false, showCaptions: settings.showCaptions, playerControls: settings.playerControls };
    }

    private async updateSettings(params: Record<string, unknown>): Promise<SafeState> {
        const allowed: Partial<Settings> = {};
        for (const key of ['mirrorLayout', 'showCaptions', 'webPlayerSharedControls', 'playerControls'] as const) {
            if (key in params) Object.assign(allowed, { [key]: params[key] });
        }
        if (!Object.keys(allowed).length) throw agentError('invalid-request', 'No supported setting was supplied.');
        await this.settings.updateSettings(allowed);
        await window.electron?.updateSettings(allowed);
        return this.safeSettings();
    }

    private diagnostics(): SafeState {
        return { route: this.router.url, electron: Boolean(window.electron), video: this.playerState(), followedSeries: this.followed.followedSeries().length, scheduledAutoSwitches: this.followed.schedules().filter((schedule) => schedule.status === 'enabled').length };
    }

    private async navigate(params: Record<string, unknown>): Promise<SafeState> {
        // `//host` and `/\host` are protocol-relative forms that some URL
        // parsers read as an external authority, so a plain `startsWith('/')`
        // check is not enough on its own.
        const route = typeof params.route === 'string' ? params.route : '';
        const isInternal =
            route.startsWith('/') &&
            !route.startsWith('//') &&
            !/^\/[\\]/.test(route) &&
            !route.includes('://') &&
            !route.includes('\0');
        if (!isInternal) throw agentError('invalid-request', 'route must be an internal absolute route such as /workspace/dashboard.');
        const navigated = await this.router.navigateByUrl(route);
        return { route: this.router.url, navigated };
    }

    private async snapshot(): Promise<SafeState> {
        const active = await this.activeChannel();
        return { ready: true, route: this.router.url, player: this.playerState(), channel: active ? safeChannel(active) : null, settings: this.safeSettings(), updatedAt: new Date().toISOString() };
    }

    private publishState(): void {
        void this.snapshot().then((state) =>
            window.electron?.updateAgentControlState?.({
                ready: true,
                route: this.router.url,
                player: state.player as Record<string, unknown>,
                ...(state.channel
                    ? { channel: state.channel as Record<string, unknown> }
                    : {}),
                settings: state.settings as Record<string, unknown>,
                updatedAt: new Date().toISOString(),
            })
        );
    }

    private playerState(): SafeState {
        const video = document.querySelector('video');
        if (!video) return { active: false };
        return { active: true, paused: video.paused, muted: video.muted, volume: Math.round(video.volume * 100) / 100, currentTime: finiteOrNull(video.currentTime), duration: finiteOrNull(video.duration), fullscreen: Boolean(document.fullscreenElement), pictureInPicture: Boolean(document.pictureInPictureElement) };
    }

    private channels(): Promise<Channel[]> {
        return firstValueFrom(this.store.select(selectChannels).pipe(take(1)));
    }

    private activePlaylistId(): Promise<string | null> {
        return firstValueFrom(
            this.store.select(selectActivePlaylistId).pipe(take(1))
        ).then((id) => id ?? null);
    }

    private activeChannel(): Promise<Channel | null> {
        return firstValueFrom(this.store.select(selectActive).pipe(take(1))).then(
            (channel) => channel ?? null
        );
    }
}
