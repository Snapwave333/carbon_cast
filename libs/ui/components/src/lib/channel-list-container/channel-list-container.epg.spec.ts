import { of, Subject, throwError } from 'rxjs';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { createChannel } from './channel-list-container.test-channels';
import {
    ChannelListContainerHarness,
    createChannelListContainerHarness,
} from './channel-list-container.spec-helpers';

describe('ChannelListContainerComponent EPG lookups', () => {
    let harness: ChannelListContainerHarness;

    beforeEach(async () => {
        harness = await createChannelListContainerHarness();
    });

    it('does not enable EPG rows when runtime EPG support is unavailable', () => {
        harness.runtimeCapabilities.supportsEpg = false;
        harness.storageGet.mockReturnValue(
            of({ epgUrl: ['https://example.com/epg.xml'] })
        );

        harness.fixture.detectChanges();

        expect(harness.fixture.componentInstance.shouldShowEpg()).toBe(false);
        expect(harness.storageGet).not.toHaveBeenCalled();
    });

    it('skips the EPG lookup entirely when the runtime has no EPG bridge', () => {
        harness.runtimeCapabilities.supportsEpg = false;
        harness.storageGet.mockReturnValue(of({ epgUrl: [] }));

        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-news', 'https://example.com/news.m3u8'),
        ];

        expect(
            harness.epgService.getCurrentProgramsForChannels
        ).not.toHaveBeenCalled();
        expect(
            harness.epgService.getChannelMetadataForChannels
        ).not.toHaveBeenCalled();
    });

    it('publishes only the newest EPG lookup when an earlier one resolves late', () => {
        harness.runtimeCapabilities.supportsEpg = true;
        harness.storageGet.mockReturnValue(of({ epgUrl: [] }));

        const stalePrograms = new Subject<Map<string, null>>();
        const freshPrograms = new Subject<Map<string, null>>();
        harness.epgService.getCurrentProgramsForChannels
            .mockReturnValueOnce(stalePrograms)
            .mockReturnValueOnce(freshPrograms);

        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-news', 'https://example.com/news.m3u8'),
        ];
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-sports', 'https://example.com/sports.m3u8'),
        ];

        freshPrograms.next(new Map([['guide-sports', null]]));
        freshPrograms.complete();
        stalePrograms.next(new Map([['guide-news', null]]));
        stalePrograms.complete();

        expect([
            ...harness.fixture.componentInstance.channelEpgMap().keys(),
        ]).toEqual(['guide-sports']);
    });

    it('keeps refreshing EPG after a failed lookup', () => {
        harness.runtimeCapabilities.supportsEpg = true;
        harness.storageGet.mockReturnValue(of({ epgUrl: [] }));
        harness.epgService.getCurrentProgramsForChannels.mockReturnValueOnce(
            throwError(() => new Error('epg bridge unavailable'))
        );

        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-news', 'https://example.com/news.m3u8'),
        ];

        harness.epgService.getCurrentProgramsForChannels.mockReturnValue(
            of(new Map([['guide-sports', null]]))
        );
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-sports', 'https://example.com/sports.m3u8'),
        ];

        expect([
            ...harness.fixture.componentInstance.channelEpgMap().keys(),
        ]).toEqual(['guide-sports']);
    });

    it('enables EPG rows when runtime EPG support and an EPG URL are available', () => {
        harness.runtimeCapabilities.supportsEpg = true;
        harness.storageGet.mockReturnValue(
            of({ epgUrl: ['https://example.com/epg.xml'] })
        );

        harness.fixture.detectChanges();

        expect(harness.storageGet).toHaveBeenCalled();
        expect(harness.fixture.componentInstance.shouldShowEpg()).toBe(true);
    });

    it('enables EPG rows and scopes lookups when the active M3U playlist has detected EPG URLs', () => {
        harness.runtimeCapabilities.supportsEpg = true;
        harness.storageGet.mockReturnValue(of({ epgUrl: [] }));
        harness.activePlaylist.set({
            _id: 'playlist-1',
            title: 'Playlist One',
            count: 1,
            importDate: '2026-04-11T00:00:00.000Z',
            epgUrls: ['https://playlist.example.com/guide.xml'],
        } as PlaylistMeta);

        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-news', 'https://example.com/news.m3u8'),
        ];

        expect(harness.fixture.componentInstance.shouldShowEpg()).toBe(true);
        expect(
            harness.epgService.getCurrentProgramsForChannels
        ).toHaveBeenCalledWith(['guide-news'], {
            sourceUrls: ['https://playlist.example.com/guide.xml'],
        });
        expect(
            harness.epgService.getChannelMetadataForChannels
        ).toHaveBeenCalledWith(['guide-news'], {
            sourceUrls: ['https://playlist.example.com/guide.xml'],
        });
    });

    it('refreshes visible channel EPG when playlist EPG URLs arrive after channels', () => {
        harness.runtimeCapabilities.supportsEpg = true;
        harness.storageGet.mockReturnValue(of({ epgUrl: [] }));

        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createChannel('guide-news', 'https://example.com/news.m3u8'),
        ];
        expect(
            harness.epgService.getCurrentProgramsForChannels
        ).toHaveBeenCalledWith(['guide-news'], undefined);
        harness.epgService.getCurrentProgramsForChannels.mockClear();
        harness.epgService.getChannelMetadataForChannels.mockClear();

        harness.activePlaylist.set({
            _id: 'playlist-1',
            title: 'Playlist One',
            count: 1,
            importDate: '2026-04-11T00:00:00.000Z',
            epgUrls: ['https://playlist.example.com/guide.xml'],
        } as PlaylistMeta);
        harness.fixture.detectChanges();

        expect(
            harness.epgService.getCurrentProgramsForChannels
        ).toHaveBeenCalledWith(['guide-news'], {
            sourceUrls: ['https://playlist.example.com/guide.xml'],
        });
        expect(
            harness.epgService.getChannelMetadataForChannels
        ).toHaveBeenCalledWith(['guide-news'], {
            sourceUrls: ['https://playlist.example.com/guide.xml'],
        });
    });

    it('debounces visible channel EPG row refreshes after EPG imports complete', () => {
        jest.useFakeTimers();
        try {
            harness.runtimeCapabilities.supportsEpg = true;
            harness.activePlaylist.set({
                _id: 'playlist-1',
                title: 'Playlist One',
                count: 1,
                importDate: '2026-04-11T00:00:00.000Z',
                epgUrls: ['https://playlist.example.com/guide.xml'],
            } as PlaylistMeta);

            harness.fixture.detectChanges();
            harness.fixture.componentInstance.channelList = [
                createChannel('guide-news', 'https://example.com/news.m3u8'),
            ];
            harness.epgService.getCurrentProgramsForChannels.mockClear();

            harness.epgService.epgAvailable$.next(true);
            harness.epgService.epgAvailable$.next(true);
            jest.advanceTimersByTime(1999);

            expect(
                harness.epgService.getCurrentProgramsForChannels
            ).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);

            expect(
                harness.epgService.getCurrentProgramsForChannels
            ).toHaveBeenCalledTimes(1);
            expect(
                harness.epgService.getCurrentProgramsForChannels
            ).toHaveBeenCalledWith(['guide-news'], {
                sourceUrls: ['https://playlist.example.com/guide.xml'],
            });
        } finally {
            harness.fixture.destroy();
            jest.useRealTimers();
        }
    });
});
