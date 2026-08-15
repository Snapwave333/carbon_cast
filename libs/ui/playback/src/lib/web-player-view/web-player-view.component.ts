import {
    Component,
    Signal,
    ViewEncapsulation,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StorageMap } from '@ngx-pwa/local-storage';
import { TranslatePipe } from '@ngx-translate/core';
import {
    Channel,
    normalizePlayerControlsSettings,
    ResolvedPortalPlayback,
    Settings,
    STORE_KEY,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';
import type { ExternalPlayerName } from '@iptvnator/shared/interfaces';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import { ArtPlayerComponent } from '../art-player/art-player.component';
import { EmbeddedMpvPlayerComponent } from '../embedded-mpv-player/embedded-mpv-player.component';
import { HtmlVideoPlayerComponent } from '../html-video-player/html-video-player.component';
import {
    type PlayerMediaTitle,
    PLAYER_CONTROLS_SETTINGS,
    WEB_PLAYER_SHARED_CONTROLS,
    WEB_PLAYER_SHARED_CONTROLS_ENABLED,
} from '../player-controls';
import {
    type PlaybackDiagnostic,
    PlaybackDiagnosticCode,
    type PlaybackFallbackRequest,
    classifyMissingStreamUrl,
    createPlaybackSourceMetadata,
    getPlaybackMediaExtensionFromUrl,
} from '../playback-diagnostics/playback-diagnostics.util';
import type { SeriesPlaybackNavigation } from '../portal-inline-player/series-playback-navigation';
import { VjsPlayerComponent } from '../vjs-player/vjs-player.component';
import { probeEmbeddedMpvFallback } from './embedded-mpv-fallback-probe';
import {
    getDiagnosticCodecHint,
    getDiagnosticDescriptionKey,
    getDiagnosticDetails,
    getDiagnosticMeta,
    getDiagnosticTitleKey,
} from './web-player-view-diagnostics.utils';

function resolveWebPlayerSharedControls(): boolean {
    const storedValue = inject(SettingsStore).webPlayerSharedControls?.();
    return typeof storedValue === 'boolean'
        ? storedValue
        : WEB_PLAYER_SHARED_CONTROLS_ENABLED;
}

function resolvePlayerControlsSettings() {
    return normalizePlayerControlsSettings(
        inject(SettingsStore).playerControls?.()
    );
}

@Component({
    selector: 'app-web-player-view',
    templateUrl: './web-player-view.component.html',
    styleUrls: ['./web-player-view.component.scss'],
    host: {
        class: 'web-player-view',
        '[class.has-diagnostic]': 'visiblePlaybackDiagnostic() !== null',
    },
    imports: [
        ArtPlayerComponent,
        ClipboardModule,
        EmbeddedMpvPlayerComponent,
        HtmlVideoPlayerComponent,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        TranslatePipe,
        VjsPlayerComponent,
    ],
    providers: [
        {
            provide: WEB_PLAYER_SHARED_CONTROLS,
            useFactory: resolveWebPlayerSharedControls,
        },
        {
            provide: PLAYER_CONTROLS_SETTINGS,
            useFactory: resolvePlayerControlsSettings,
        },
    ],
    encapsulation: ViewEncapsulation.None,
})
export class WebPlayerViewComponent {
    storage = inject(StorageMap);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly settingsStore = inject(SettingsStore);

    streamUrl = input.required<string>();
    title = input('');
    playback = input<ResolvedPortalPlayback | null>(null);
    startTime = input<number>(0);
    volume = input<number>(1);
    playerOverride = input<VideoPlayer | null>(null);
    seriesNavigation = input<SeriesPlaybackNavigation | null>(null);
    /** Display-ready title lines for the fullscreen overlay; hosts with richer
     * context (e.g. series name + episode label) pass it explicitly. */
    mediaTitle = input<PlayerMediaTitle | null>(null);
    readonly timeUpdate = output<{
        currentTime: number;
        duration: number;
    }>();
    readonly externalFallbackRequested = output<PlaybackFallbackRequest>();
    readonly playbackEnded = output<void>();
    readonly previousEpisodeRequested = output<void>();
    readonly nextEpisodeRequested = output<void>();

    settings = toSignal(this.storage.get(STORE_KEY.Settings)) as Signal<
        Settings | undefined
    >;

    /**
     * Subtitle preference for the built-in web players. Read from the settings
     * store instead of an input so every host (M3U, Xtream, Stalker, portal
     * detail pages) gets it without having to wire it through — the missing
     * bindings were why the setting looked like a no-op (#1155).
     */
    readonly showCaptions = computed(
        () => this.settingsStore.showCaptions?.() ?? false
    );

    channel!: Channel;
    vjsOptions!: {
        isLive: boolean;
        reloadToken: number;
        sources: { src: string; type: string }[];
    };
    readonly reloadToken = signal(0);
    readonly playbackDiagnostic = signal<PlaybackDiagnostic | null>(null);
    readonly visiblePlaybackDiagnostic = computed(() =>
        this.selectedPlayer() === VideoPlayer.EmbeddedMpv
            ? null
            : this.playbackDiagnostic()
    );
    readonly playbackInteractionEnabled = computed(
        () => this.visiblePlaybackDiagnostic() === null
    );
    readonly canShowExternalFallbackActions = computed(
        () =>
            this.runtime.supportsManagedExternalPlayers &&
            !!this.visiblePlaybackDiagnostic()?.externalFallbackRecommended
    );
    readonly diagnosticHeadlineKey = computed(() =>
        this.canShowExternalFallbackActions()
            ? 'PLAYBACK_DIAGNOSTICS.NATIVE_FALLBACK_TITLE'
            : 'PLAYBACK_DIAGNOSTICS.INLINE_FAILURE_TITLE'
    );

    readonly resolvedPlayback = computed<ResolvedPortalPlayback>(() => {
        const playback = this.playback();
        if (playback) {
            return playback;
        }

        return {
            streamUrl: this.streamUrl(),
            title: this.title() || this.streamUrl(),
            startTime: this.startTime(),
        };
    });
    readonly resolvedIsLive = computed(() => {
        const playback = this.resolvedPlayback();
        return typeof playback.isLive === 'boolean'
            ? playback.isLive
            : !playback.contentInfo;
    });
    /** In-app engine substitution for streams the web players can't decode:
     * Embedded MPV renders inside the window and decodes everything, so a
     * browser-undecodable stream switches to it instead of punting the user
     * to an external player window. Reset per stream. */
    private readonly inAppFallbackPlayer = signal<VideoPlayer | null>(null);
    private lastFallbackStreamUrl: string | null = null;

    readonly selectedPlayer = computed(
        () =>
            this.inAppFallbackPlayer() ??
            this.playerOverride() ??
            this.settings()?.player ??
            VideoPlayer.VideoJs
    );
    readonly resolvedMediaTitle = computed<PlayerMediaTitle | null>(() => {
        const explicit = this.mediaTitle();
        if (explicit?.primary?.trim()) {
            return explicit;
        }
        const playback = this.resolvedPlayback();
        const title = playback.title?.trim();
        // resolvedPlayback() falls back to the stream URL as title; a raw URL
        // is not a watchable overlay title.
        if (!title || title === playback.streamUrl) {
            return null;
        }
        return { primary: title, secondary: null };
    });
    readonly recordingFolder = computed(
        () => this.settings()?.recordingFolder ?? ''
    );

    constructor() {
        effect(() => {
            // Track player changes so stale browser diagnostics are cleared on switch.
            this.selectedPlayer();

            const playback = this.resolvedPlayback();
            // A new stream starts over on the preferred player; the MPV
            // substitution only ever applies to the stream that failed.
            if (this.lastFallbackStreamUrl !== playback.streamUrl) {
                this.lastFallbackStreamUrl = playback.streamUrl;
                this.inAppFallbackPlayer.set(null);
            }
            this.playbackDiagnostic.set(null);
            this.setChannel(playback);
            this.setVjsOptions(playback.streamUrl, this.resolvedIsLive());
            if (!playback.streamUrl?.trim()) {
                // Every engine renders a silent black surface for this, so the
                // host names it instead of leaving the user with no feedback.
                this.playbackDiagnostic.set(
                    classifyMissingStreamUrl(
                        createPlaybackSourceMetadata({
                            url: playback.streamUrl ?? '',
                        })
                    )
                );
            }
        });
    }

    setVjsOptions(streamUrl: string, isLive = true) {
        const extension = getPlaybackMediaExtensionFromUrl(streamUrl);
        const mimeType =
            extension === 'm3u' || extension === 'm3u8'
                ? 'application/x-mpegURL'
                : extension === 'ts' || !extension
                  ? 'video/mp2t'
                  : extension === 'mkv'
                    ? 'video/matroska'
                    : 'video/mp4';

        this.vjsOptions = {
            isLive,
            reloadToken: untracked(() => this.reloadToken()),
            sources: [{ src: streamUrl, type: mimeType }],
        };
    }

    setChannel(playbackOrUrl: ResolvedPortalPlayback | string) {
        const playback =
            typeof playbackOrUrl === 'string'
                ? {
                      streamUrl: playbackOrUrl,
                      title: playbackOrUrl,
                  }
                : playbackOrUrl;

        this.channel = {
            id: playback.streamUrl,
            url: playback.streamUrl,
            name: playback.title || playback.streamUrl,
            group: { title: '' },
            tvg: {
                id: '',
                name: playback.title || playback.streamUrl,
                url: '',
                logo: playback.thumbnail ?? '',
                rec: '',
            },
            http: {
                referrer:
                    playback.referer ??
                    this.getHeaderValue(playback.headers, 'Referer') ??
                    '',
                'user-agent':
                    playback.userAgent ??
                    this.getHeaderValue(playback.headers, 'User-Agent') ??
                    '',
                origin:
                    playback.origin ??
                    this.getHeaderValue(playback.headers, 'Origin') ??
                    '',
            },
            radio: 'false',
            drm: playback.drm,
        };
    }

    handlePlaybackIssue(issue: PlaybackDiagnostic | null): void {
        if (this.selectedPlayer() === VideoPlayer.EmbeddedMpv) {
            this.playbackDiagnostic.set(null);
            return;
        }

        this.playbackDiagnostic.set(issue);
        if (issue && this.shouldAttemptInAppFallback(issue)) {
            void this.engageInAppFallback(issue);
        }
    }

    /** Undecodable/unreachable-in-browser streams qualify; DRM does not —
     * MPV cannot license Widevine/PlayReady either, so switching would
     * trade a clear diagnostic for a silent black screen. */
    private shouldAttemptInAppFallback(issue: PlaybackDiagnostic): boolean {
        return (
            issue.externalFallbackRecommended &&
            issue.code !== PlaybackDiagnosticCode.DrmOrEncryption &&
            this.runtime.supportsEmbeddedMpv
        );
    }

    private async engageInAppFallback(
        issue: PlaybackDiagnostic
    ): Promise<void> {
        const supported = await probeEmbeddedMpvFallback();
        // The diagnostic (with its external-player actions) stays up when the
        // engine is unavailable, or when the situation changed while probing.
        if (!supported || this.playbackDiagnostic() !== issue) {
            return;
        }
        this.inAppFallbackPlayer.set(VideoPlayer.EmbeddedMpv);
        this.playbackDiagnostic.set(null);
    }

    requestExternalFallback(player: ExternalPlayerName): void {
        const diagnostic = this.visiblePlaybackDiagnostic();
        if (!diagnostic) {
            return;
        }

        this.externalFallbackRequested.emit({
            player,
            playback: this.resolvedPlayback(),
            diagnostic,
        });
    }

    retryPlayback(): void {
        const playback = this.resolvedPlayback();

        this.playbackDiagnostic.set(null);
        this.reloadToken.update((value) => value + 1);
        this.setChannel(playback);
        this.setVjsOptions(playback.streamUrl, this.resolvedIsLive());
    }

    readonly getDiagnosticTitleKey = getDiagnosticTitleKey;
    readonly getDiagnosticMeta = getDiagnosticMeta;
    readonly getDiagnosticCodecHint = getDiagnosticCodecHint;
    readonly getDiagnosticDetails = getDiagnosticDetails;

    getDiagnosticDescriptionKey(issue: PlaybackDiagnostic): string {
        return getDiagnosticDescriptionKey(
            issue,
            this.runtime.supportsManagedExternalPlayers
        );
    }

    private getHeaderValue(
        headers: ResolvedPortalPlayback['headers'] | undefined,
        name: string
    ): string | undefined {
        if (!headers) {
            return undefined;
        }

        const matchingKey = Object.keys(headers).find(
            (key) => key.toLowerCase() === name.toLowerCase()
        );
        return matchingKey ? headers[matchingKey] : undefined;
    }
}
