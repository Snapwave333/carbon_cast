import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { PlaylistsService } from '@iptvnator/services';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { PlaylistMergeService } from './playlist-merge.service';

function item(url: string, group = 'General') {
    return {
        name: url,
        tvg: { id: '', name: '', url: '', logo: '', rec: '' },
        group: { title: group },
        http: { referrer: '', 'user-agent': '' },
        raw: `#EXTINF:-1,${url}`,
        url,
    };
}

function storedPlaylist(
    id: string,
    title: string,
    urls: string[],
    epgUrls?: string[]
) {
    return {
        _id: id,
        title,
        epgUrls,
        playlist: {
            header: { attrs: {}, raw: '#EXTM3U' },
            items: urls.map((url) => item(url)),
        },
    };
}

describe('PlaylistMergeService', () => {
    let service: PlaylistMergeService;
    let store: { dispatch: jest.Mock };
    let playlistsService: { getPlaylist: jest.Mock };

    beforeEach(() => {
        store = { dispatch: jest.fn() };
        playlistsService = { getPlaylist: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                PlaylistMergeService,
                { provide: Store, useValue: store },
                { provide: PlaylistsService, useValue: playlistsService },
            ],
        });

        service = TestBed.inject(PlaylistMergeService);
    });

    it('combines two playlists and removes the shared channel', async () => {
        playlistsService.getPlaylist.mockImplementation((id: string) =>
            of(
                id === 'a'
                    ? storedPlaylist('a', 'A', ['http://x/1', 'http://x/2'])
                    : storedPlaylist('b', 'B', ['http://x/2', 'http://x/3'])
            )
        );

        const outcome = await service.merge({
            playlistIds: ['a', 'b'],
            title: 'Merged',
        });

        expect(outcome.channelCount).toBe(3);
        expect(outcome.duplicateCount).toBe(1);
        expect(outcome.playlist.title).toBe('Merged');
        expect(store.dispatch).toHaveBeenCalledTimes(1);
    });

    it('leaves the source playlists in place', async () => {
        playlistsService.getPlaylist.mockReturnValue(
            of(storedPlaylist('a', 'A', ['http://x/1']))
        );

        await service.merge({ playlistIds: ['a', 'a'], title: 'Merged' });

        expect(store.dispatch).toHaveBeenCalledTimes(1);
        const [action] = store.dispatch.mock.calls[0];
        expect(action.type).toContain('Add Playlist');
    });

    it('carries the EPG urls of every source into the merged playlist', async () => {
        playlistsService.getPlaylist.mockImplementation((id: string) =>
            of(
                id === 'a'
                    ? storedPlaylist('a', 'A', ['http://x/1'], [
                          'http://epg/a.xml',
                      ])
                    : storedPlaylist('b', 'B', ['http://x/2'], [
                          'http://epg/b.xml',
                      ])
            )
        );

        const outcome = await service.merge({
            playlistIds: ['a', 'b'],
            title: 'Merged',
        });

        expect(outcome.playlist.epgUrls).toEqual(
            expect.arrayContaining(['http://epg/a.xml', 'http://epg/b.xml'])
        );
    });

    it('skips a playlist with no parsable items rather than failing', async () => {
        playlistsService.getPlaylist.mockImplementation((id: string) =>
            of(
                id === 'portal'
                    ? { _id: 'portal', title: 'Portal', playlist: undefined }
                    : storedPlaylist('a', 'A', ['http://x/1'])
            )
        );

        const outcome = await service.merge({
            playlistIds: ['portal', 'a'],
            title: 'Merged',
        });

        expect(outcome.skippedIds).toEqual(['portal']);
        expect(outcome.channelCount).toBe(1);
    });

    it('throws when nothing could be read', async () => {
        playlistsService.getPlaylist.mockReturnValue(
            of({ _id: 'portal', playlist: undefined })
        );

        await expect(
            service.merge({ playlistIds: ['portal'], title: 'Merged' })
        ).rejects.toThrow('None of the selected playlists could be read');
        expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('prefixes groups with the source name when asked', async () => {
        playlistsService.getPlaylist.mockReturnValue(
            of(storedPlaylist('a', 'Sports pack', ['http://x/1']))
        );

        const outcome = await service.merge({
            playlistIds: ['a'],
            title: 'Merged',
            prefixGroupsWithSource: true,
        });

        const merged = outcome.playlist.playlist as {
            items: Array<{ group: { title: string } }>;
        };
        expect(merged.items[0].group.title).toBe('Sports pack · General');
    });
});

describe('PlaylistMergeService.isMergeable', () => {
    it('accepts a plain M3U playlist', () => {
        expect(
            PlaylistMergeService.isMergeable({ _id: 'a' } as PlaylistMeta)
        ).toBe(true);
    });

    it('rejects Xtream and Stalker portals', () => {
        expect(
            PlaylistMergeService.isMergeable({
                _id: 'x',
                serverUrl: 'http://portal',
            } as PlaylistMeta)
        ).toBe(false);
        expect(
            PlaylistMergeService.isMergeable({
                _id: 's',
                macAddress: '00:1A:79',
            } as PlaylistMeta)
        ).toBe(false);
    });
});
