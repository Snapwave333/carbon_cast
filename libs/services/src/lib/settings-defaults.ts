import {
    DEFAULT_DASHBOARD_RAILS_SETTINGS,
    DEFAULT_PLAYER_CONTROLS_SETTINGS,
    DEFAULT_PREFERRED_QUALITY,
    DEFAULT_TMDB_SETTINGS,
    Language,
    Settings,
    StartupBehavior,
    StreamFormat,
    Theme,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';
import { resolveHomeCountryFromLocale } from '@iptvnator/shared/m3u-utils';

/**
 * Values a fresh profile starts from, and the fallback for any key missing
 * from a stored profile.
 *
 * Split out of `settings-store.service.ts` purely for size: the store file was
 * over the 400-line ceiling and this object is the one self-contained block in
 * it.
 */
export const DEFAULT_SETTINGS: Settings = {
    player: VideoPlayer.VideoJs,
    webPlayerSharedControls: false,
    playerControls: DEFAULT_PLAYER_CONTROLS_SETTINGS,
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
    defaultWorkspacePage: 'tv-guide' as const,
    playlistDefaultSection: 'guide' as const,
    resumeLastChannel: true,
    showExternalPlaybackBar: true,
    stripCountryPrefix: false,
    hideSpanishChannels: true,
    hideNonUsChannels: true,
    hideReligiousChannels: true,
    localNewsOnly: true,
    // Seeded from the browser locale so the local-news filter is useful on a
    // fresh install; an empty value leaves that filter inert rather than
    // guessing a country and hiding the user's own news channels.
    homeCountryCode:
        resolveHomeCountryFromLocale(
            typeof navigator === 'undefined' ? undefined : navigator.language
        ) ?? '',
    theme: Theme.SystemTheme,
    mirrorLayout: true,
    mpvPlayerPath: '',
    mpvPlayerArguments: '',
    mpvReuseInstance: false,
    vlcPlayerPath: '',
    vlcPlayerArguments: '',
    vlcReuseInstance: false,
    remoteControl: false,
    remoteControlPort: 8765,
    epgUrl: [],
    downloadFolder: '',
    recordingFolder: '',
    embeddedMpvFrameCopy: false,
    coverSize: 'medium',
    epgViewMode: 'timeline',
    dashboardRails: DEFAULT_DASHBOARD_RAILS_SETTINGS,
    preferUploadedEpgOverXtream: false,
    trustedPrivateNetworkEpgUrls: [],
    trustedInsecureTlsHosts: [],
    tmdb: DEFAULT_TMDB_SETTINGS,
};
