import { TestBed } from '@angular/core/testing';
import { PodcastDirectoryService } from './podcast-directory.service';

const RAW_COLLECTION = {
    collectionId: 111,
    collectionName: 'Deep Dive',
    artistName: 'Example Media',
    feedUrl: 'https://feeds.example/deep-dive.rss',
    artworkUrl600: 'https://cdn.example/600.jpg',
    artworkUrl100: 'https://cdn.example/100.jpg',
    genres: ['Technology', 'News'],
    trackCount: 210,
    collectionViewUrl: 'https://podcasts.apple.com/deep-dive',
};

function textResponse(payload: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(payload),
    } as Response;
}

describe('PodcastDirectoryService', () => {
    let service: PodcastDirectoryService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        TestBed.configureTestingModule({});
        service = TestBed.inject(PodcastDirectoryService);
    });

    it('maps a search result to a show', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse({ results: [RAW_COLLECTION] })
        );

        await expect(service.search('deep dive')).resolves.toEqual([
            {
                id: '111',
                title: 'Deep Dive',
                author: 'Example Media',
                feedUrl: 'https://feeds.example/deep-dive.rss',
                artwork: 'https://cdn.example/600.jpg',
                genres: ['Technology', 'News'],
                episodeCount: 210,
                description: '',
                websiteUrl: 'https://podcasts.apple.com/deep-dive',
            },
        ]);
    });

    it('sends the podcast search parameters', async () => {
        fetchMock.mockResolvedValueOnce(textResponse({ results: [] }));

        await service.search('space', { limit: 5, country: 'DE' });

        const url = new URL(fetchMock.mock.calls[0][0] as string);
        expect(url.searchParams.get('term')).toBe('space');
        expect(url.searchParams.get('media')).toBe('podcast');
        expect(url.searchParams.get('entity')).toBe('podcast');
        expect(url.searchParams.get('limit')).toBe('5');
        expect(url.searchParams.get('country')).toBe('DE');
    });

    it('does not call the API for a blank term', async () => {
        await expect(service.search('   ')).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('drops results without a feed URL', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse({
                results: [
                    RAW_COLLECTION,
                    { collectionId: 222, collectionName: 'No feed' },
                ],
            })
        );

        const shows = await service.search('x');

        expect(shows.map((show) => show.id)).toEqual(['111']);
    });

    it('falls back to the primary genre when genres are missing', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse({
                results: [
                    {
                        ...RAW_COLLECTION,
                        genres: undefined,
                        primaryGenreName: 'Comedy',
                    },
                ],
            })
        );

        const [show] = await service.search('x');

        expect(show.genres).toEqual(['Comedy']);
    });

    it('resolves top-chart ids through lookup and keeps the chart order', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse({
                feed: {
                    entry: [
                        { id: { attributes: { 'im:id': '222' } } },
                        { id: { attributes: { 'im:id': '111' } } },
                    ],
                },
            })
        );
        fetchMock.mockResolvedValueOnce(
            textResponse({
                results: [
                    RAW_COLLECTION,
                    {
                        ...RAW_COLLECTION,
                        collectionId: 222,
                        collectionName: 'Second',
                    },
                ],
            })
        );

        const shows = await service.topShows(2, 'de');

        expect(fetchMock.mock.calls[0][0]).toBe(
            'https://itunes.apple.com/de/rss/toppodcasts/limit=2/json'
        );
        expect(shows.map((show) => show.id)).toEqual(['222', '111']);
    });

    it('handles a single-entry chart returned as an object', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse({
                feed: { entry: { id: { attributes: { 'im:id': '111' } } } },
            })
        );
        fetchMock.mockResolvedValueOnce(
            textResponse({ results: [RAW_COLLECTION] })
        );

        await expect(service.topShows(1)).resolves.toHaveLength(1);
    });

    it('rejects a non-2xx response', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () => '',
        } as Response);

        await expect(service.search('x')).rejects.toThrow(
            'iTunes request failed: 403 Forbidden'
        );
    });

    it('rejects an empty body', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => '   ',
        } as Response);

        await expect(service.lookup('111')).rejects.toThrow(
            'iTunes request returned an empty response'
        );
    });

    it('does not call the API when there are no ids to look up', async () => {
        await expect(service.lookupMany([' ', ''])).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
