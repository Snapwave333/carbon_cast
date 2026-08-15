import { Language } from './language.enum';
import { StreamFormat } from './stream-format.enum';
import { Theme } from './theme.enum';
import { TmdbSettings } from './tmdb.interface';

/**
 * Contains all types of supported video players
 */
export enum VideoPlayer {
    VideoJs = 'videojs',
    Html5Player = 'html5',
    EmbeddedMpv = 'embedded-mpv',
    MPV = 'mpv',
    VLC = 'vlc',
    ArtPlayer = 'artplayer',
}

export enum StartupBehavior {
    FirstView = 'first-view',
    RestoreLastView = 'restore-last-view',
}

/** Workspace destination used when the app opens in "first view" mode. */
export type DefaultWorkspacePage =
    | 'tv-guide'
    | 'dashboard'
    | 'sources'
    | 'followed-series'
    | 'radio'
    | 'global-favorites'
    | 'global-recent'
    | 'downloads';

/** Which section an M3U playlist opens on: TV guide, channel list or groups. */
export type PlaylistDefaultSection = 'guide' | 'all' | 'groups';

export type CoverSize = 'small' | 'medium' | 'large';

/** Rendering of the live EPG panel under the player. */
export type EpgViewMode = 'timeline' | 'list';

export type PlayerControlsDensity = 'compact' | 'expanded';
export type PlayerControlsOpacity = 'solid' | 'translucent';
export type PlayerControlsSize = 'small' | 'medium' | 'large';

/** Persisted presentation preferences for the bottom shared player bar. */
export interface PlayerControlsSettings {
    visible: boolean;
    /** Zero keeps controls visible while playback continues. */
    autoHideDelayMs: number;
    density: PlayerControlsDensity;
    opacity: PlayerControlsOpacity;
    size: PlayerControlsSize;
}

export interface PlayerControlsSettingsInput {
    visible?: boolean | null;
    autoHideDelayMs?: number | null;
    density?: PlayerControlsDensity | null;
    opacity?: PlayerControlsOpacity | null;
    size?: PlayerControlsSize | null;
}

export const DEFAULT_PLAYER_CONTROLS_SETTINGS: PlayerControlsSettings = {
    visible: true,
    autoHideDelayMs: 2500,
    density: 'expanded',
    opacity: 'translucent',
    size: 'medium',
};

export function normalizePlayerControlsSettings(
    settings?: PlayerControlsSettingsInput | null
): PlayerControlsSettings {
    const source = settings ?? {};
    const delay = source.autoHideDelayMs;
    return {
        visible: source.visible !== false,
        autoHideDelayMs:
            typeof delay === 'number' && Number.isFinite(delay)
                ? Math.max(0, Math.min(30_000, Math.round(delay)))
                : DEFAULT_PLAYER_CONTROLS_SETTINGS.autoHideDelayMs,
        density:
            source.density === 'compact' || source.density === 'expanded'
                ? source.density
                : DEFAULT_PLAYER_CONTROLS_SETTINGS.density,
        opacity:
            source.opacity === 'solid' || source.opacity === 'translucent'
                ? source.opacity
                : DEFAULT_PLAYER_CONTROLS_SETTINGS.opacity,
        size:
            source.size === 'small' ||
            source.size === 'medium' ||
            source.size === 'large'
                ? source.size
                : DEFAULT_PLAYER_CONTROLS_SETTINGS.size,
    };
}

export interface DashboardRailsSettings {
    hero: boolean;
    continueWatching: boolean;
    liveFavorites: boolean;
    recentlyWatchedLive: boolean;
    favoriteMoviesAndSeries: boolean;
    recentSources: boolean;
    xtreamRecentlyAdded: boolean;
    /** TMDB "Trending this week" rail (needs the TMDB opt-in; Electron) */
    tmdbTrending: boolean;
}

export const DEFAULT_DASHBOARD_RAILS_SETTINGS: DashboardRailsSettings = {
    hero: true,
    continueWatching: true,
    liveFavorites: true,
    recentlyWatchedLive: true,
    favoriteMoviesAndSeries: true,
    recentSources: true,
    xtreamRecentlyAdded: true,
    tmdbTrending: true,
};

export type DashboardRailsSettingsInput = Partial<
    Record<keyof DashboardRailsSettings, boolean | null | undefined>
>;

export function normalizeDashboardRailsSettings(
    settings?: DashboardRailsSettingsInput | null
): DashboardRailsSettings {
    const normalized = { ...DEFAULT_DASHBOARD_RAILS_SETTINGS };

    if (!settings) {
        return normalized;
    }

    const keys = Object.keys(
        DEFAULT_DASHBOARD_RAILS_SETTINGS
    ) as (keyof DashboardRailsSettings)[];
    for (const key of keys) {
        if (typeof settings[key] === 'boolean') {
            normalized[key] = settings[key];
        }
    }

    return normalized;
}

/**
 * Describes all available settings options of the application
 */
export interface Settings {
    player: VideoPlayer;
    /**
     * Use CarbonCast IPTV's shared controls in HTML5, Video.js, and ArtPlayer.
     * Missing values remain off for compatibility with older saved settings.
     */
    webPlayerSharedControls?: boolean;
    /** Layout and visibility settings for the bottom shared player controls. */
    playerControls?: PlayerControlsSettingsInput;
    /**
     * Fill the empty space around the inline VOD/series player with a blurred,
     * dimmed copy of the poster (YouTube "Ambient mode" style) instead of plain
     * black bars. Off by default; only affects the built-in web players.
     */
    playerAmbientMode?: boolean;
    /**
     * Dock the inline series player to the left and show an "Up Next"
     * episode rail in the leftover stage column on wide windows. On by
     * default (the rail only appears when there is genuinely unused space);
     * missing values mean enabled. Only affects the built-in web players.
     */
    playerUpNextRail?: boolean;
    /**
     * Programme/channel artwork in the TV-guide grid. On by default;
     * turning it off gives a denser, text-only guide and also stops the
     * guide's TMDB artwork lookups. Missing values mean enabled.
     */
    guideArtwork?: boolean;
    epgUrl: string[];
    streamFormat: StreamFormat;
    openStreamOnDoubleClick: boolean;
    language: Language;
    showCaptions: boolean;
    showDashboard: boolean;
    startupBehavior: StartupBehavior;
    /** Fresh profiles open the most recently used M3U playlist's TV guide. */
    defaultWorkspacePage?: DefaultWorkspacePage;
    /**
     * Section an M3U playlist opens on. Defaults to the TV guide where EPG is
     * available; runtimes without EPG fall back to the channel list.
     */
    playlistDefaultSection?: PlaylistDefaultSection;
    /**
     * Automatically start playback when the playlist opens with nothing
     * playing: its most recently watched channel, or the first channel when
     * there is no history to resume. On by default.
     */
    resumeLastChannel?: boolean;
    /** Show the desktop footer bar for external playback status */
    showExternalPlaybackBar?: boolean;
    /** Strip country/group prefixes like "US | " or "UK - " from channel names */
    stripCountryPrefix?: boolean;
    /** Hide Spanish-language channels from playlist channel lists */
    hideSpanishChannels?: boolean;
    theme: Theme;
    /**
     * Mirror the live layout so the player sits on the left and the
     * channel/category rail on the right. Fresh profiles default on; explicit
     * saved preferences remain authoritative for existing users.
     */
    mirrorLayout?: boolean;
    mpvPlayerPath: string;
    /**
     * Extra MPV CLI arguments entered one argument per line. Applied only when
     * starting a new external MPV process.
     */
    mpvPlayerArguments: string;
    mpvReuseInstance: boolean;
    vlcPlayerPath: string;
    /**
     * Extra VLC CLI arguments entered one argument per line. Applied only when
     * starting a new external VLC process.
     */
    vlcPlayerArguments: string;
    vlcReuseInstance: boolean;
    remoteControl: boolean;
    remoteControlPort: number;
    /** Custom download folder path (uses system Downloads folder if not set) */
    downloadFolder?: string;
    /** Custom live recording folder path (uses system Downloads folder if not set) */
    recordingFolder?: string;
    /**
     * Embedded MPV frame-copy engine (experimental, macOS Apple Silicon and Linux).
     * Applied on the next app start — the engine relaxes the window sandbox
     * for its preload frame pump, which is fixed at window creation.
     */
    embeddedMpvFrameCopy?: boolean;
    /** Cover/poster sizing preset applied across grids and rails */
    coverSize?: CoverSize;
    /** Live EPG panel layout: horizontal timeline (default) or vertical list */
    epgViewMode?: EpgViewMode;
    /** Per-rail dashboard visibility preferences. Missing keys default on. */
    dashboardRails?: DashboardRailsSettings;
    /**
     * When true, the locally-parsed XMLTV programs (loaded from `epgUrl`)
     * take precedence over the Xtream provider's EPG for live TV channels.
     * When false (default), the Xtream provider's EPG is preferred and
     * XMLTV is consulted only when the provider returns no programs.
     * Only meaningful for Xtream playlists in Electron.
     */
    preferUploadedEpgOverXtream?: boolean;
    /**
     * Exact EPG source URLs the user has allowed to resolve to private/LAN
     * network addresses. Kept source-scoped instead of disabling SSRF
     * protection globally.
     */
    trustedPrivateNetworkEpgUrls?: string[];
    /**
     * Lowercase hostnames whose invalid TLS certificates the user has chosen
     * to trust. This is host-scoped and does not disable TLS validation for
     * unrelated playlist or EPG hosts.
     */
    trustedInsecureTlsHosts?: string[];
    /**
     * Opt-in TMDB metadata enrichment for VOD/series detail views.
     * Disabled by default because enrichment sends content titles to TMDB.
     */
    tmdb?: TmdbSettings;
}
