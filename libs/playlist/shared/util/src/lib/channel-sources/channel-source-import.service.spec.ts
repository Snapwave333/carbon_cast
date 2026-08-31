import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { PlaylistActions } from '@iptvnator/m3u-state';
import { RemoteTextService } from '@iptvnator/services';
import { ChannelSourceImportService } from './channel-source-import.service';
import { ChannelSource } from './channel-source.model';

const PROVIDER = {
    id: 'test',
    name: 'Test provider',
    homepage: 'https://example.com',
};

function source(overrides: Partial<ChannelSource> = {}): ChannelSource {
    return {
        id: 'test:1',
        kind: 'featured',
        name: 'Test source',
        url: 'https://example.com/one.m3u',
        provider: PROVIDER,
        streamCount: 1,
        ...overrides,
    };
}

const PLAYLIST_A = `#EXTM3U
#EXTINF:-1 group-title="News",Channel A
https://cdn.example/a.m3u8
`;

const PLAYLIST_B = `#EXTM3U
#EXTINF:-1 group-title="Sports",Channel B
https://cdn.example/b.m3u8
#EXTINF:-1 group-title="News",Channel A again
https://cdn.example/a.m3u8
`;

describe('ChannelSourceImportService', () => {
    let service: ChannelSourceImportService;
    let store: { dispatch: jest.Mock };
    let remoteText: { fetchText: jest.Mock };

    beforeEach(() => {
        store = { dispatch: jest.fn() };
        remoteText = { fetchText: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                ChannelSourceImportService,
                { provide: Store, useValue: store },
                { provide: RemoteTextService, useValue: remoteText },
            ],
        });

        service = TestBed.inject(ChannelSourceImportService);
    });

    it('adds one playlist per source in separate mode', async () => {
        remoteText.fetchText
            .mockResolvedValueOnce(PLAYLIST_A)
            .mockResolvedValueOnce(PLAYLIST_B);

        const result = await service.import(
            [
                source({ id: 'a', name: 'A' }),
                source({ id: 'b', name: 'B', url: 'https://example.com/b.m3u' }),
            ],
            { mode: 'separate' }
        );

        expect(result.playlists).toHaveLength(2);
        expect(result.channelCount).toBe(3);
        expect(store.dispatch).toHaveBeenCalledTimes(2);
        expect(result.playlists[0].url).toBe('https://example.com/one.m3u');
    });

    it('adds a single deduplicated playlist in merged mode', async () => {
        remoteText.fetchText
            .mockResolvedValueOnce(PLAYLIST_A)
            .mockResolvedValueOnce(PLAYLIST_B);

        const result = await service.import(
            [
                source({ id: 'a', name: 'A' }),
                source({ id: 'b', name: 'B', url: 'https://example.com/b.m3u' }),
            ],
            { mode: 'merged', mergedTitle: 'Combined' }
        );

        expect(result.playlists).toHaveLength(1);
        expect(result.playlists[0].title).toBe('Combined');
        expect(result.channelCount).toBe(2);
        expect(result.duplicateCount).toBe(1);
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        expect(store.dispatch).toHaveBeenCalledWith(
            PlaylistActions.addPlaylist({ playlist: result.playlists[0] })
        );
    });

    it('imports the sources that worked and reports the ones that did not', async () => {
        remoteText.fetchText
            .mockRejectedValueOnce(new Error('502 Bad Gateway'))
            .mockResolvedValueOnce(PLAYLIST_A);

        const result = await service.import(
            [
                source({ id: 'dead', name: 'Dead mirror' }),
                source({ id: 'ok', name: 'Live', url: 'https://example.com/b.m3u' }),
            ],
            { mode: 'separate' }
        );

        expect(result.playlists).toHaveLength(1);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].source.id).toBe('dead');
        expect(result.failures[0].message).toContain('502');
    });

    it('rejects a response that is not an M3U playlist', async () => {
        remoteText.fetchText.mockResolvedValue('<html>404</html>');

        const result = await service.import([source()], { mode: 'separate' });

        expect(result.playlists).toEqual([]);
        expect(result.failures[0].message).toContain('not an M3U playlist');
        expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('dispatches nothing when every source fails', async () => {
        remoteText.fetchText.mockRejectedValue(new Error('offline'));

        const result = await service.import([source()], { mode: 'merged' });

        expect(result.channelCount).toBe(0);
        expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('attaches the catalogue EPG url to the imported playlist', async () => {
        remoteText.fetchText.mockResolvedValue(PLAYLIST_A);

        const result = await service.import(
            [source({ epgUrls: ['https://epg.example/guide.xml'] })],
            { mode: 'separate' }
        );

        expect(result.playlists[0].epgUrls).toContain(
            'https://epg.example/guide.xml'
        );
    });

    it('reports progress for each source before fetching it', async () => {
        remoteText.fetchText.mockResolvedValue(PLAYLIST_A);
        const onProgress = jest.fn();

        await service.import([source({ name: 'First' })], {
            mode: 'separate',
            onProgress,
        });

        expect(onProgress).toHaveBeenCalledWith({
            completed: 0,
            total: 1,
            current: 'First',
        });
    });

    it('stops before any network call when already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        await expect(
            service.import([source()], {
                mode: 'separate',
                signal: controller.signal,
            })
        ).rejects.toThrow('Import cancelled');
        expect(remoteText.fetchText).not.toHaveBeenCalled();
    });
});
