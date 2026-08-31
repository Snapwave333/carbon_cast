export type PortalProvider = 'xtreams' | 'stalker' | 'playlists';
export type PortalRailSection =
    | 'all'
    | 'downloads'
    | 'favorites'
    | 'groups'
    | 'guide'
    | 'itv'
    | 'library'
    | 'live'
    | 'recent'
    | 'recently-added'
    | 'radio'
    | 'search'
    | 'series'
    | 'vod';

export interface PortalRailLink {
    icon: string;
    tooltip: string;
    path: (string | number)[];
    exact?: boolean;
    section?: PortalRailSection;
}

interface BuildPortalRailLinksOptions {
    provider: PortalProvider;
    playlistId: string;
    /** The TV guide needs the EPG runtime; without it the tab is hidden. */
    supportsEpg?: boolean;
    workspace: boolean;
}

interface PortalRailLinkGroups {
    primary: PortalRailLink[];
    secondary: PortalRailLink[];
}

export function buildPortalRailLinks(
    options: BuildPortalRailLinksOptions
): PortalRailLinkGroups {
    const { provider, playlistId, supportsEpg, workspace } = options;
    const root = workspace
        ? ['/workspace', provider, playlistId]
        : [`/${provider}`, playlistId];

    if (provider === 'xtreams') {
        const primary: PortalRailLink[] = [];
        const secondary: PortalRailLink[] = [];

        primary.push(
            {
                icon: 'movie',
                tooltip: 'Movies (this playlist)',
                path: [...root, 'vod'],
                section: 'vod',
            },
            {
                icon: 'live_tv',
                tooltip: 'Live TV (this playlist)',
                path: [...root, 'live'],
                section: 'live',
            },
            {
                icon: 'tv',
                tooltip: 'Series (this playlist)',
                path: [...root, 'series'],
                section: 'series',
            }
        );

        secondary.push(
            {
                icon: 'new_releases',
                tooltip: 'Recently added (this playlist)',
                path: [...root, 'recently-added'],
                section: 'recently-added',
            },
            {
                icon: 'search',
                tooltip: 'Search (this playlist)',
                path: [...root, 'search'],
                section: 'search',
            }
        );

        return { primary, secondary };
    }

    if (provider === 'stalker') {
        const primary: PortalRailLink[] = [
            {
                icon: 'movie',
                tooltip: 'Movies (this playlist)',
                path: [...root, 'vod'],
                section: 'vod',
            },
            {
                icon: 'live_tv',
                tooltip: 'Live TV (this playlist)',
                path: [...root, 'itv'],
                section: 'itv',
            },
            {
                icon: 'radio',
                tooltip: 'Radio (this playlist)',
                path: [...root, 'radio'],
                section: 'radio',
            },
            {
                icon: 'tv',
                tooltip: 'Series (this playlist)',
                path: [...root, 'series'],
                section: 'series',
            },
        ];

        const secondary: PortalRailLink[] = [
            {
                icon: 'search',
                tooltip: 'Search (this playlist)',
                path: [...root, 'search'],
                section: 'search',
            },
        ];

        return { primary, secondary };
    }

    if (provider === 'playlists') {
        const primary: PortalRailLink[] = [];

        // The guide leads because it is the playlist's default section.
        if (supportsEpg) {
            primary.push({
                icon: 'view_timeline',
                tooltip: 'TV guide (this playlist)',
                path: [...root, 'guide'],
                exact: true,
                section: 'guide',
            });
        }

        primary.push(
            {
                icon: 'tv',
                tooltip: 'All channels (this playlist)',
                path: [...root, 'all'],
                exact: true,
                section: 'all',
            },
            {
                icon: 'folder',
                tooltip: 'Categories (this playlist)',
                path: [...root, 'groups'],
                exact: true,
                section: 'groups',
            }
        );

        // Favourites stays directly reachable for the active M3U playlist.
        // Recently viewed is intentionally omitted to keep the bottom dock
        // focused on browsing and playback destinations.
        const secondary: PortalRailLink[] = [
            {
                icon: 'favorite',
                tooltip: 'Favorites (this playlist)',
                path: [...root, 'favorites'],
                exact: true,
                section: 'favorites',
            },
        ];

        return { primary, secondary };
    }

    return { primary: [], secondary: [] };
}
