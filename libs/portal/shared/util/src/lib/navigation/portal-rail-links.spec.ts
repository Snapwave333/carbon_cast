import { buildPortalRailLinks } from './portal-rail-links';

describe('buildPortalRailLinks', () => {
    it('builds Xtream links with scoped tooltip labels', () => {
        const links = buildPortalRailLinks({
            provider: 'xtreams',
            playlistId: 'xtream-1',
            workspace: false,
        });

        expect(links.primary.map((link) => link.section)).toEqual([
            'vod',
            'live',
            'series',
        ]);
        expect(links.secondary.map((link) => link.section)).toEqual([
            'recently-added',
            'search',
        ]);

        expect(links.primary[0]?.tooltip).toBe('Movies (this playlist)');
    });

    it('builds workspace Xtream content links', () => {
        const links = buildPortalRailLinks({
            provider: 'xtreams',
            playlistId: 'xtream-web',
            workspace: true,
        });

        expect(links.primary.map((link) => link.section)).toEqual([
            'vod',
            'live',
            'series',
        ]);
        expect(links.secondary.map((link) => link.section)).toEqual([
            'recently-added',
            'search',
        ]);
    });

    it('builds workspace Stalker links with scoped tooltip labels on web', () => {
        const links = buildPortalRailLinks({
            provider: 'stalker',
            playlistId: 'portal-1',
            workspace: true,
        });

        expect(links.primary.map((link) => link.section)).toEqual([
            'vod',
            'itv',
            'radio',
            'series',
        ]);
        expect(links.secondary.map((link) => link.section)).toEqual(['search']);

        expect(links.primary[1]?.tooltip).toBe('Live TV (this playlist)');
        expect(links.primary[2]?.tooltip).toBe('Radio (this playlist)');
        expect(links.secondary[0]?.tooltip).toBe('Search (this playlist)');
    });

    it('builds M3U playlist links with scoped tooltip labels', () => {
        const links = buildPortalRailLinks({
            provider: 'playlists',
            playlistId: 'm3u-1',
            workspace: true,
        });

        expect(links.primary).toEqual([
            {
                icon: 'tv',
                tooltip: 'All channels (this playlist)',
                path: ['/workspace', 'playlists', 'm3u-1', 'all'],
                exact: true,
                section: 'all',
            },
            {
                icon: 'folder',
                tooltip: 'Categories (this playlist)',
                path: ['/workspace', 'playlists', 'm3u-1', 'groups'],
                exact: true,
                section: 'groups',
            },
        ]);
        expect(links.secondary).toEqual([
            {
                icon: 'favorite',
                tooltip: 'Favorites (this playlist)',
                path: ['/workspace', 'playlists', 'm3u-1', 'favorites'],
                exact: true,
                section: 'favorites',
            },
        ]);
    });

    it('leads M3U playlist links with the TV guide when EPG is supported', () => {
        const links = buildPortalRailLinks({
            provider: 'playlists',
            playlistId: 'm3u-1',
            supportsEpg: true,
            workspace: true,
        });

        expect(links.primary[0]).toEqual({
            icon: 'view_timeline',
            tooltip: 'TV guide (this playlist)',
            path: ['/workspace', 'playlists', 'm3u-1', 'guide'],
            exact: true,
            section: 'guide',
        });
        expect(links.primary.map((link) => link.section)).toEqual([
            'guide',
            'all',
            'groups',
        ]);
    });

    it('hides the TV guide tab on runtimes without the EPG stack', () => {
        const links = buildPortalRailLinks({
            provider: 'playlists',
            playlistId: 'm3u-1',
            supportsEpg: false,
            workspace: true,
        });

        expect(links.primary.some((link) => link.section === 'guide')).toBe(
            false
        );
    });
});
