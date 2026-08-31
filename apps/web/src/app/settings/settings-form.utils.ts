import {
    FormArray,
    FormBuilder,
    FormControl,
    Validators,
} from '@angular/forms';
import {
    CoverSize,
    DefaultWorkspacePage,
    DEFAULT_DASHBOARD_RAILS_SETTINGS,
    DEFAULT_PLAYER_CONTROLS_SETTINGS,
    DEFAULT_PREFERRED_QUALITY,
    DEFAULT_PROXY_SETTINGS,
    DEFAULT_TMDB_SETTINGS,
    EpgViewMode,
    Language,
    normalizeDashboardRailsSettings,
    normalizePlayerControlsSettings,
    normalizePreferredQuality,
    normalizeProxySettings,
    normalizeExternalPlayerArguments,
    Settings,
    StartupBehavior,
    StreamFormat,
    Theme,
    VideoPlayer,
    PlaylistDefaultSection,
} from '@iptvnator/shared/interfaces';

export const EPG_URL_PATTERN = /^(http|https|file):\/\/[^ "]+$/;

export function createEpgUrlControl(value = ''): FormControl<string | null> {
    return new FormControl(value, [Validators.pattern(EPG_URL_PATTERN)]);
}

export function createSettingsForm(
    formBuilder: FormBuilder,
    supportsEpg: boolean
) {
    return formBuilder.group({
        player: [VideoPlayer.VideoJs],
        webPlayerSharedControls: false,
        playerControls: formBuilder.group({
            visible: DEFAULT_PLAYER_CONTROLS_SETTINGS.visible,
            autoHideDelayMs: DEFAULT_PLAYER_CONTROLS_SETTINGS.autoHideDelayMs,
            density: DEFAULT_PLAYER_CONTROLS_SETTINGS.density,
            opacity: DEFAULT_PLAYER_CONTROLS_SETTINGS.opacity,
            size: DEFAULT_PLAYER_CONTROLS_SETTINGS.size,
        }),
        playerAmbientMode: false,
        playerUpNextRail: true,
        preferredQuality: DEFAULT_PREFERRED_QUALITY,
        guideArtwork: true,
        ...(supportsEpg
            ? { epgUrl: new FormArray<FormControl<string | null>>([]) }
            : {}),
        streamFormat: StreamFormat.AutoStreamFormat,
        openStreamOnDoubleClick: false,
        language: Language.ENGLISH,
        showCaptions: false,
        showDashboard: true,
        dashboardRails: formBuilder.group({
            hero: DEFAULT_DASHBOARD_RAILS_SETTINGS.hero,
            continueWatching: DEFAULT_DASHBOARD_RAILS_SETTINGS.continueWatching,
            liveFavorites: DEFAULT_DASHBOARD_RAILS_SETTINGS.liveFavorites,
            recentlyWatchedLive:
                DEFAULT_DASHBOARD_RAILS_SETTINGS.recentlyWatchedLive,
            favoriteMoviesAndSeries:
                DEFAULT_DASHBOARD_RAILS_SETTINGS.favoriteMoviesAndSeries,
            recentSources: DEFAULT_DASHBOARD_RAILS_SETTINGS.recentSources,
            xtreamRecentlyAdded:
                DEFAULT_DASHBOARD_RAILS_SETTINGS.xtreamRecentlyAdded,
            tmdbTrending: DEFAULT_DASHBOARD_RAILS_SETTINGS.tmdbTrending,
        }),
        startupBehavior: StartupBehavior.FirstView,
        defaultWorkspacePage: 'tv-guide' as DefaultWorkspacePage,
        playlistDefaultSection: 'guide',
        resumeLastChannel: true,
        showExternalPlaybackBar: true,
        stripCountryPrefix: false,
        hideSpanishChannels: true,
        hideNonUsChannels: true,
        hideReligiousChannels: true,
        localNewsOnly: true,
        homeCountryCode: '',
        theme: Theme.SystemTheme,
        mirrorLayout: true,
        mpvPlayerPath: '',
        mpvPlayerArguments: '',
        mpvReuseInstance: false,
        vlcPlayerPath: '',
        vlcPlayerArguments: '',
        vlcReuseInstance: false,
        remoteControl: false,
        remoteControlPort: [
            8765,
            [
                Validators.required,
                Validators.min(1),
                Validators.max(65535),
                Validators.pattern(/^\d+$/),
            ],
        ],
        recordingFolder: '',
        embeddedMpvFrameCopy: false,
        coverSize: 'medium' as CoverSize,
        ...(supportsEpg
            ? {
                  preferUploadedEpgOverXtream: false,
                  epgViewMode: 'timeline' as EpgViewMode,
              }
            : {}),
        tmdb: formBuilder.group({
            enabled: DEFAULT_TMDB_SETTINGS.enabled,
            apiKey: DEFAULT_TMDB_SETTINGS.apiKey ?? '',
        }),
        proxy: formBuilder.group({
            enabled: DEFAULT_PROXY_SETTINGS.enabled,
            protocol: DEFAULT_PROXY_SETTINGS.protocol,
            host: DEFAULT_PROXY_SETTINGS.host,
            port: [
                DEFAULT_PROXY_SETTINGS.port,
                [Validators.min(1), Validators.max(65535)],
            ],
            username: DEFAULT_PROXY_SETTINGS.username,
            password: DEFAULT_PROXY_SETTINGS.password,
            bypassList: DEFAULT_PROXY_SETTINGS.bypassList,
        }),
    });
}

export type SettingsForm = ReturnType<typeof createSettingsForm>;

export function applyEpgUrlsToFormArray(
    epgUrl: FormArray,
    epgUrls: string[] | string
): void {
    const urls = Array.isArray(epgUrls) ? epgUrls : [epgUrls];
    const filteredUrls = urls
        .map((url) => url.trim())
        .filter((url) => url !== '');

    filteredUrls.forEach((url) => {
        epgUrl.push(createEpgUrlControl(url));
    });
}

export function createSettingsFromFormValue(
    settingsForm: SettingsForm,
    currentSettings: Settings
): Settings {
    const value = settingsForm.getRawValue();
    const epgUrl = Array.isArray(value.epgUrl)
        ? value.epgUrl.filter((url): url is string => typeof url === 'string')
        : (currentSettings.epgUrl ?? []);

    return {
        player: value.player ?? VideoPlayer.VideoJs,
        webPlayerSharedControls: value.webPlayerSharedControls ?? false,
        playerControls: normalizePlayerControlsSettings(value.playerControls),
        playerAmbientMode: value.playerAmbientMode ?? false,
        playerUpNextRail: value.playerUpNextRail ?? true,
        preferredQuality: normalizePreferredQuality(value.preferredQuality),
        guideArtwork: value.guideArtwork ?? true,
        streamFormat: value.streamFormat ?? StreamFormat.AutoStreamFormat,
        openStreamOnDoubleClick: value.openStreamOnDoubleClick ?? false,
        language: value.language ?? Language.ENGLISH,
        showCaptions: value.showCaptions ?? false,
        showDashboard: value.showDashboard ?? true,
        dashboardRails: normalizeDashboardRailsSettings(value.dashboardRails),
        startupBehavior: value.startupBehavior ?? StartupBehavior.FirstView,
        defaultWorkspacePage:
            (value.defaultWorkspacePage as DefaultWorkspacePage) ?? 'tv-guide',
        playlistDefaultSection:
            (value.playlistDefaultSection as PlaylistDefaultSection) ?? 'guide',
        resumeLastChannel: value.resumeLastChannel ?? true,
        showExternalPlaybackBar: value.showExternalPlaybackBar ?? true,
        stripCountryPrefix: value.stripCountryPrefix ?? false,
        hideSpanishChannels: value.hideSpanishChannels ?? true,
        hideNonUsChannels: value.hideNonUsChannels ?? true,
        hideReligiousChannels: value.hideReligiousChannels ?? true,
        localNewsOnly: value.localNewsOnly ?? true,
        homeCountryCode: normalizeHomeCountryCode(value.homeCountryCode),
        theme: value.theme ?? Theme.SystemTheme,
        mirrorLayout: value.mirrorLayout ?? true,
        mpvPlayerPath: normalizeExternalPlayerPath(value.mpvPlayerPath),
        mpvPlayerArguments: normalizeExternalPlayerArguments(
            value.mpvPlayerArguments
        ),
        mpvReuseInstance: value.mpvReuseInstance ?? false,
        vlcPlayerPath: normalizeExternalPlayerPath(value.vlcPlayerPath),
        vlcPlayerArguments: normalizeExternalPlayerArguments(
            value.vlcPlayerArguments
        ),
        vlcReuseInstance: value.vlcReuseInstance ?? false,
        remoteControl: value.remoteControl ?? false,
        remoteControlPort: Number(value.remoteControlPort ?? 8765),
        recordingFolder: value.recordingFolder ?? '',
        embeddedMpvFrameCopy: value.embeddedMpvFrameCopy ?? false,
        coverSize: value.coverSize ?? 'medium',
        epgUrl,
        preferUploadedEpgOverXtream:
            value.preferUploadedEpgOverXtream ??
            currentSettings.preferUploadedEpgOverXtream ??
            false,
        epgViewMode:
            value.epgViewMode ?? currentSettings.epgViewMode ?? 'timeline',
        trustedPrivateNetworkEpgUrls:
            currentSettings.trustedPrivateNetworkEpgUrls ?? [],
        trustedInsecureTlsHosts: currentSettings.trustedInsecureTlsHosts ?? [],
        tmdb: {
            enabled: value.tmdb?.enabled ?? DEFAULT_TMDB_SETTINGS.enabled,
            apiKey: value.tmdb?.apiKey?.trim() ?? '',
        },
        proxy: normalizeProxySettings(value.proxy),
    };
}

function normalizeExternalPlayerPath(
    playerPath: string | null | undefined
): string {
    return playerPath?.trim() ?? '';
}

/**
 * Accepts only a two-letter country code. Anything else becomes empty, which
 * disables the local-news filter rather than matching no channel at all.
 */
function normalizeHomeCountryCode(code: string | null | undefined): string {
    const normalized = code?.trim().toLowerCase() ?? '';
    return /^[a-z]{2}$/.test(normalized) ? normalized : '';
}
