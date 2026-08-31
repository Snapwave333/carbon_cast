import {
    DEFAULT_PREFERRED_QUALITY,
    Language,
    StartupBehavior,
    StreamFormat,
    Theme,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';

/**
 * Expected settings-form fixtures shared by the settings specs.
 *
 * Split out of `settings-test-harness.stub.ts` for size only: that harness was
 * over the 400-line ceiling and these constants are the self-contained part.
 */

export const DEFAULT_DASHBOARD_RAILS = {
    hero: true,
    continueWatching: true,
    liveFavorites: true,
    recentlyWatchedLive: true,
    favoriteMoviesAndSeries: true,
    recentSources: true,
    xtreamRecentlyAdded: true,
    tmdbTrending: true,
};

export const DEFAULT_SETTINGS = {
    player: VideoPlayer.VideoJs,
    webPlayerSharedControls: false,
    playerControls: {
        visible: true,
        autoHideDelayMs: 2500,
        density: 'expanded',
        opacity: 'translucent',
        size: 'medium',
    },
    playerAmbientMode: false,
    playerUpNextRail: true,
    preferredQuality: DEFAULT_PREFERRED_QUALITY,
    guideArtwork: true,
    streamFormat: StreamFormat.AutoStreamFormat,
    openStreamOnDoubleClick: false,
    language: Language.ENGLISH,
    showCaptions: false,
    showDashboard: true,
    startupBehavior: StartupBehavior.FirstView,
    defaultWorkspacePage: 'tv-guide',
    showExternalPlaybackBar: true,
    stripCountryPrefix: false,
    hideSpanishChannels: true,
    hideNonUsChannels: true,
    hideReligiousChannels: true,
    localNewsOnly: true,
    homeCountryCode: '',
    theme: Theme.SystemTheme,
    mirrorLayout: true,
    playlistDefaultSection: 'guide',
    resumeLastChannel: true,
    mpvPlayerPath: '',
    mpvPlayerArguments: '',
    mpvReuseInstance: false,
    vlcPlayerPath: '',
    vlcPlayerArguments: '',
    vlcReuseInstance: false,
    remoteControl: false,
    remoteControlPort: 8765,
    proxy: {
        enabled: false,
        protocol: 'socks5',
        host: '',
        port: 1080,
        username: '',
        password: '',
        bypassList: '',
    },
    epgUrl: [],
    recordingFolder: '',
    embeddedMpvFrameCopy: false,
    coverSize: 'medium',
    dashboardRails: DEFAULT_DASHBOARD_RAILS,
    preferUploadedEpgOverXtream: false,
    epgViewMode: 'timeline',
    tmdb: { enabled: false, apiKey: '' },
};
