import {
    CoverSize,
    DefaultWorkspacePage,
    EpgViewMode,
    PlaylistDefaultSection,
    StartupBehavior,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';
import {
    CoverSizeOption,
    DefaultWorkspacePageOption,
    EpgViewModeOption,
    PlaylistDefaultSectionOption,
    SettingsPlayerOption,
    SettingsSection,
    StartupBehaviorOption,
} from './settings.models';

export const SETTINGS_COVER_SIZE_OPTIONS: CoverSizeOption[] = [
    {
        value: 'small' satisfies CoverSize,
        icon: 'view_module',
        labelKey: 'SETTINGS.COVER_SIZE_SMALL',
    },
    {
        value: 'medium' satisfies CoverSize,
        icon: 'view_comfy',
        labelKey: 'SETTINGS.COVER_SIZE_MEDIUM',
    },
    {
        value: 'large' satisfies CoverSize,
        icon: 'view_quilt',
        labelKey: 'SETTINGS.COVER_SIZE_LARGE',
    },
];

export const SETTINGS_EPG_VIEW_MODE_OPTIONS: EpgViewModeOption[] = [
    {
        value: 'timeline' satisfies EpgViewMode,
        icon: 'view_timeline',
        labelKey: 'SETTINGS.EPG_VIEW_MODE_TIMELINE',
    },
    {
        value: 'list' satisfies EpgViewMode,
        icon: 'view_list',
        labelKey: 'SETTINGS.EPG_VIEW_MODE_LIST',
    },
];

export const SETTINGS_STARTUP_BEHAVIOR_OPTIONS: StartupBehaviorOption[] = [
    {
        value: StartupBehavior.FirstView,
        labelKey: 'SETTINGS.STARTUP_BEHAVIOR_FIRST_VIEW',
    },
    {
        value: StartupBehavior.RestoreLastView,
        labelKey: 'SETTINGS.STARTUP_BEHAVIOR_RESTORE_LAST_VIEW',
    },
];

export const SETTINGS_DEFAULT_WORKSPACE_PAGE_OPTIONS: DefaultWorkspacePageOption[] =
    [
        {
            value: 'tv-guide' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_TV_GUIDE',
        },
        {
            value: 'followed-series' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_FOLLOWED_SERIES',
        },
        {
            value: 'dashboard' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_DASHBOARD',
        },
        {
            value: 'sources' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_SOURCES',
        },
        {
            value: 'radio' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_RADIO',
        },
        {
            value: 'global-favorites' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_FAVORITES',
        },
        {
            value: 'global-recent' satisfies DefaultWorkspacePage,
            labelKey: 'SETTINGS.DEFAULT_WORKSPACE_RECENT',
        },
    ];

export const SETTINGS_PLAYLIST_DEFAULT_SECTION_OPTIONS: PlaylistDefaultSectionOption[] =
    [
        {
            value: 'guide' satisfies PlaylistDefaultSection,
            labelKey: 'SETTINGS.PLAYLIST_SECTION_GUIDE',
        },
        {
            value: 'all' satisfies PlaylistDefaultSection,
            labelKey: 'SETTINGS.PLAYLIST_SECTION_ALL',
        },
        {
            value: 'groups' satisfies PlaylistDefaultSection,
            labelKey: 'SETTINGS.PLAYLIST_SECTION_GROUPS',
        },
    ];

export const SETTINGS_OS_PLAYER_OPTIONS: SettingsPlayerOption[] = [
    {
        id: VideoPlayer.MPV,
        labelKey: 'SETTINGS.PLAYER_MPV',
    },
    {
        id: VideoPlayer.VLC,
        labelKey: 'SETTINGS.PLAYER_VLC',
    },
];

export const SETTINGS_EMBEDDED_PLAYER_OPTIONS: SettingsPlayerOption[] = [
    {
        id: VideoPlayer.Html5Player,
        labelKey: 'SETTINGS.PLAYER_HTML5',
    },
    {
        id: VideoPlayer.VideoJs,
        labelKey: 'SETTINGS.PLAYER_VIDEOJS',
    },
    {
        id: VideoPlayer.ArtPlayer,
        labelKey: 'SETTINGS.PLAYER_ARTPLAYER',
    },
];

export interface SettingsPlayerAvailability {
    supportsEmbeddedMpv: boolean;
    supportsManagedExternalPlayers: boolean;
}

/**
 * Built-in web players are always offered; the OS-backed ones only show up
 * when the current runtime can actually launch them.
 */
export function buildSettingsPlayerOptions({
    supportsEmbeddedMpv,
    supportsManagedExternalPlayers,
}: SettingsPlayerAvailability): SettingsPlayerOption[] {
    return [
        ...SETTINGS_EMBEDDED_PLAYER_OPTIONS,
        ...(supportsEmbeddedMpv
            ? [
                  {
                      id: VideoPlayer.EmbeddedMpv,
                      labelKey: 'SETTINGS.PLAYER_EMBEDDED_MPV',
                  },
              ]
            : []),
        ...(supportsManagedExternalPlayers ? SETTINGS_OS_PLAYER_OPTIONS : []),
    ];
}

export interface SettingsSectionVisibility {
    supportsEpg: boolean;
    supportsRemoteControl: boolean;
    /** Proxying needs Chromium's session API, so desktop only. */
    supportsProxy: boolean;
}

export function buildSettingsSectionNavItems({
    supportsEpg,
    supportsRemoteControl,
    supportsProxy,
}: SettingsSectionVisibility): SettingsSection[] {
    return [
        {
            id: 'general',
            label: 'SETTINGS.NAV_GENERAL',
            icon: 'tune',
            visible: true,
            advanced: false,
        },
        {
            id: 'playback',
            label: 'SETTINGS.NAV_PLAYBACK',
            icon: 'play_circle',
            visible: true,
            advanced: false,
        },
        {
            id: 'epg',
            label: 'SETTINGS.NAV_EPG',
            icon: 'calendar_month',
            visible: supportsEpg,
            advanced: false,
        },
        {
            // Not advanced: it is the fix for a geo-blocked stream, and burying
            // it behind the advanced toggle makes that undiscoverable.
            id: 'network',
            label: 'SETTINGS.NAV_NETWORK',
            icon: 'vpn_lock',
            visible: supportsProxy,
            advanced: false,
        },
        {
            id: 'dashboard',
            label: 'SETTINGS.NAV_DASHBOARD',
            icon: 'dashboard',
            visible: true,
            advanced: true,
        },
        {
            // Must match the section's HTML id (`remote-control`) so the
            // settings-section-scroll directive can resolve the anchor.
            // Was previously '@iptvnator/ui/remote-control' (the NX lib
            // name), which meant clicking the nav item silently no-op'd
            // because document.getElementById of that string returned null.
            id: 'remote-control',
            label: 'SETTINGS.NAV_REMOTE',
            icon: 'smartphone',
            visible: supportsRemoteControl,
            advanced: true,
        },
        {
            id: 'tmdb',
            label: 'SETTINGS.NAV_TMDB',
            icon: 'movie',
            visible: true,
            advanced: true,
        },
        {
            id: 'backup',
            label: 'SETTINGS.NAV_BACKUP',
            icon: 'backup',
            visible: true,
            advanced: true,
        },
        {
            id: 'reset',
            label: 'SETTINGS.NAV_RESET',
            icon: 'delete_sweep',
            visible: true,
            advanced: true,
        },
        {
            id: 'about',
            label: 'SETTINGS.NAV_ABOUT',
            icon: 'info',
            visible: true,
            advanced: true,
        },
    ];
}
