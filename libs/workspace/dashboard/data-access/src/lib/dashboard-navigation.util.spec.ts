import {
    PlaybackPositionData,
    PortalAddedItem,
    PortalRecentItem,
} from '@iptvnator/shared/interfaces';

jest.mock('@iptvnator/portal/shared/util', () => ({
    buildStalkerDetailNavigationTarget: jest.fn(() => ({
        link: ['stalker-link'],
        state: { via: 'stalker' },
    })),
    buildStalkerStateItem: jest.fn(() => ({ stalkerState: true })),
    buildXtreamNavigationTarget: jest.fn(() => ({
        link: ['xtream-link'],
        state: { via: 'xtream' },
    })),
    getGlobalFavoriteNavigation: jest.fn(() => ({
        link: ['favorite-link'],
        state: { via: 'favorite' },
    })),
    getRecentItemNavigation: jest.fn(() => ({
        link: ['recent-link'],
        state: { via: 'recent' },
    })),
}));

import {
    buildStalkerDetailNavigationTarget,
    buildStalkerStateItem,
    buildXtreamNavigationTarget,
    getGlobalFavoriteNavigation,
    getRecentItemNavigation,
} from '@iptvnator/portal/shared/util';
import {
    getGlobalFavoriteLink,
    getGlobalFavoriteNavigationState,
    getPlaylistLink,
    getRecentItemLink,
    getRecentItemNavigationState,
    getRecentlyAddedLink,
    getRecentlyAddedNavigationState,
    isTypeInKind,
} from './dashboard-navigation.util';

function recentItem(
    overrides: Partial<PortalRecentItem> = {}
): PortalRecentItem {
    return {
        id: 'item-1',
        title: 'Item 1',
        type: 'series',
        playlist_id: 'pl-1',
        category_id: 'cat-1',
        xtream_id: 42,
        source: 'xtream',
        viewed_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function addedItem(overrides: Partial<PortalAddedItem> = {}): PortalAddedItem {
    return {
        id: 'added-1',
        title: 'Added 1',
        type: 'movie',
        playlist_id: 'pl-1',
        category_id: 'cat-1',
        xtream_id: 7,
        source: 'xtream',
        added_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function episodePosition(
    overrides: Partial<PlaybackPositionData> = {}
): PlaybackPositionData {
    return {
        contentXtreamId: 10,
        contentType: 'episode',
        seriesXtreamId: 5,
        seasonNumber: 2,
        episodeNumber: 3,
        positionSeconds: 120,
        ...overrides,
    };
}

describe('dashboard-navigation.util', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('isTypeInKind', () => {
        it('matches everything for the "all" kind', () => {
            expect(isTypeInKind('live', 'all')).toBe(true);
            expect(isTypeInKind('movie', 'all')).toBe(true);
            expect(isTypeInKind('series', 'all')).toBe(true);
        });

        it('maps content kinds to their activity types', () => {
            expect(isTypeInKind('live', 'channels')).toBe(true);
            expect(isTypeInKind('movie', 'channels')).toBe(false);

            expect(isTypeInKind('movie', 'vod')).toBe(true);
            expect(isTypeInKind('live', 'vod')).toBe(false);

            expect(isTypeInKind('series', 'series')).toBe(true);
            expect(isTypeInKind('movie', 'series')).toBe(false);
        });
    });

    describe('getPlaylistLink', () => {
        it('links Xtream playlists to the VOD route', () => {
            expect(
                getPlaylistLink({ _id: 'p1', serverUrl: 'http://s' } as never)
            ).toEqual(['/workspace', 'xtreams', 'p1', 'vod']);
        });

        it('links Stalker playlists to the VOD route', () => {
            expect(
                getPlaylistLink({ _id: 'p2', macAddress: '00:11' } as never)
            ).toEqual(['/workspace', 'stalker', 'p2', 'vod']);
        });

        it('links plain M3U playlists to the playlists route', () => {
            expect(getPlaylistLink({ _id: 'p3' } as never)).toEqual([
                '/workspace',
                'playlists',
                'p3',
            ]);
        });
    });

    describe('recent item navigation', () => {
        it('delegates link resolution to the shared builder', () => {
            const item = recentItem();
            expect(getRecentItemLink(item)).toEqual(['recent-link']);
            expect(getRecentItemNavigation).toHaveBeenCalledWith(item);
        });

        it('builds a resume target for xtream episode series positions', () => {
            const item = recentItem();
            getRecentItemNavigationState(item, episodePosition());

            expect(getRecentItemNavigation).toHaveBeenCalledWith(item, {
                seriesXtreamId: 5,
                contentXtreamId: 10,
                seasonNumber: 2,
                episodeNumber: 3,
            });
        });

        it('passes a null resume target when the item is not an xtream series', () => {
            const item = recentItem({ source: 'stalker' });
            getRecentItemNavigationState(item, episodePosition());
            expect(getRecentItemNavigation).toHaveBeenCalledWith(item, null);
        });

        it('passes a null resume target for non-episode positions', () => {
            const item = recentItem();
            getRecentItemNavigationState(
                item,
                episodePosition({ contentType: 'vod' })
            );
            expect(getRecentItemNavigation).toHaveBeenCalledWith(item, null);
        });

        it('rejects positions without a parent series id', () => {
            const item = recentItem();
            getRecentItemNavigationState(
                item,
                episodePosition({ seriesXtreamId: undefined })
            );
            expect(getRecentItemNavigation).toHaveBeenCalledWith(item, null);
        });

        it('rejects positions with a negative episode number', () => {
            const item = recentItem();
            getRecentItemNavigationState(
                item,
                episodePosition({ episodeNumber: -1 })
            );
            expect(getRecentItemNavigation).toHaveBeenCalledWith(item, null);
        });
    });

    describe('global favorite navigation', () => {
        it('delegates link and state to the shared builder', () => {
            const item = recentItem() as never;
            expect(getGlobalFavoriteLink(item)).toEqual(['favorite-link']);
            expect(getGlobalFavoriteNavigationState(item)).toEqual({
                via: 'favorite',
            });
            expect(getGlobalFavoriteNavigation).toHaveBeenCalledTimes(2);
        });
    });

    describe('recently-added navigation', () => {
        it('routes non-live stalker items through the stalker detail builder', () => {
            const item = addedItem({ source: 'stalker', type: 'series' });
            expect(getRecentlyAddedLink(item)).toEqual(['stalker-link']);
            expect(getRecentlyAddedNavigationState(item)).toEqual({
                via: 'stalker',
            });
            expect(buildStalkerDetailNavigationTarget).toHaveBeenCalled();
            expect(buildStalkerStateItem).toHaveBeenCalled();
            expect(buildXtreamNavigationTarget).not.toHaveBeenCalled();
        });

        it('routes live stalker items through the xtream builder', () => {
            const item = addedItem({ source: 'stalker', type: 'live' });
            expect(getRecentlyAddedLink(item)).toEqual(['xtream-link']);
            expect(buildXtreamNavigationTarget).toHaveBeenCalled();
            expect(buildStalkerDetailNavigationTarget).not.toHaveBeenCalled();
        });

        it('routes xtream items through the xtream builder', () => {
            const item = addedItem({ source: 'xtream', type: 'series' });
            expect(getRecentlyAddedLink(item)).toEqual(['xtream-link']);
            expect(buildXtreamNavigationTarget).toHaveBeenCalled();
        });
    });
});
