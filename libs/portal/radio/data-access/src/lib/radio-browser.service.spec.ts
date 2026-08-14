import { TestBed } from '@angular/core/testing';
import { RadioBrowserService } from './radio-browser.service';

const RAW_STATION = {
    stationuuid: 'uuid-1',
    name: '  Jazz FM  ',
    url: 'http://legacy.example/stream',
    url_resolved: 'https://cdn.example/stream',
    homepage: 'https://jazz.example',
    favicon: 'https://cdn.example/jazz.png',
    tags: 'jazz, blues , ',
    country: 'Germany',
    countrycode: 'DE',
    language: 'german,english',
    codec: 'MP3',
    bitrate: 128,
    votes: 42,
    clickcount: 7,
    hls: 0,
    lastcheckok: 1,
};

function jsonResponse(payload: unknown): Response {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => payload,
    } as Response;
}

function errorResponse(status: number): Response {
    return {
        ok: false,
        status,
        statusText: 'Server Error',
        json: async () => ({}),
    } as Response;
}

describe('RadioBrowserService', () => {
    let service: RadioBrowserService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        // The client shuffles mirrors to spread load over the volunteer-run
        // servers; pin it so the failover order under test is deterministic.
        jest.spyOn(Math, 'random').mockReturnValue(0);
        TestBed.configureTestingModule({});
        service = TestBed.inject(RadioBrowserService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    /** Answers the mirror-directory call, then each subsequent call in turn. */
    function respondWith(...payloads: unknown[]): void {
        fetchMock.mockResolvedValueOnce(
            jsonResponse([{ name: 'de1.api.radio-browser.info' }])
        );
        for (const payload of payloads) {
            fetchMock.mockResolvedValueOnce(jsonResponse(payload));
        }
    }

    it('normalizes a search result, preferring the resolved stream URL', async () => {
        respondWith([RAW_STATION]);

        const stations = await service.searchStations({ name: 'jazz' });

        expect(stations).toEqual([
            {
                id: 'uuid-1',
                name: 'Jazz FM',
                streamUrl: 'https://cdn.example/stream',
                homepage: 'https://jazz.example',
                favicon: 'https://cdn.example/jazz.png',
                tags: ['jazz', 'blues'],
                country: 'Germany',
                countryCode: 'DE',
                languages: ['german', 'english'],
                codec: 'MP3',
                bitrate: 128,
                votes: 42,
                clickCount: 7,
                isHls: false,
                isOnline: true,
            },
        ]);
    });

    it('sends the search filters as query parameters', async () => {
        respondWith([]);

        await service.searchStations({
            name: 'lofi',
            countryCode: 'FR',
            tag: 'chill',
            limit: 10,
            order: 'votes',
        });

        const requestedUrl = new URL(fetchMock.mock.calls[1][0] as string);
        expect(requestedUrl.pathname).toBe('/json/stations/search');
        expect(requestedUrl.searchParams.get('name')).toBe('lofi');
        expect(requestedUrl.searchParams.get('countrycode')).toBe('FR');
        expect(requestedUrl.searchParams.get('tag')).toBe('chill');
        expect(requestedUrl.searchParams.get('limit')).toBe('10');
        expect(requestedUrl.searchParams.get('order')).toBe('votes');
        expect(requestedUrl.searchParams.get('hidebroken')).toBe('true');
    });

    it('drops stations without a stream URL or id, and duplicates', async () => {
        respondWith([
            RAW_STATION,
            { ...RAW_STATION },
            { stationuuid: 'uuid-2', name: 'No stream' },
            { url: 'https://cdn.example/anon', name: 'No id' },
        ]);

        const stations = await service.searchStations({});

        expect(stations.map((station) => station.id)).toEqual(['uuid-1']);
    });

    it('falls back to the next mirror when one fails', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse([
                { name: 'first.example' },
                { name: 'second.example' },
            ])
        );
        fetchMock.mockResolvedValueOnce(errorResponse(503));
        fetchMock.mockResolvedValueOnce(jsonResponse([RAW_STATION]));

        const stations = await service.topStations(5);

        expect(stations).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('reuses the mirror that answered for later requests', async () => {
        fetchMock.mockImplementation((url: string) => {
            if (url.includes('all.api.radio-browser.info')) {
                return Promise.resolve(
                    jsonResponse([
                        { name: 'broken.example' },
                        { name: 'healthy.example' },
                    ])
                );
            }
            return Promise.resolve(
                url.startsWith('https://broken.example')
                    ? errorResponse(500)
                    : jsonResponse([])
            );
        });

        await service.topStations(5);
        await service.trendingStations(5);

        const lastCall = fetchMock.mock.calls.at(-1);
        expect(lastCall?.[0]).toContain('https://healthy.example');
    });

    it('throws when every mirror fails', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'only.example' }]));
        fetchMock.mockResolvedValue(errorResponse(500));

        await expect(service.topStations(5)).rejects.toThrow(
            'Radio Browser request failed: 500'
        );
    });

    it('still works when mirror discovery fails', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        fetchMock.mockResolvedValueOnce(jsonResponse([RAW_STATION]));

        await expect(service.topStations(5)).resolves.toHaveLength(1);
    });

    it('caches facet lookups', async () => {
        respondWith(
            [{ name: 'Germany', iso_3166_1: 'DE', stationcount: 120 }],
            []
        );

        const first = await service.countries();
        const second = await service.countries();

        expect(first).toEqual([
            { name: 'Germany', code: 'DE', stationCount: 120 },
        ]);
        expect(second).toBe(first);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('drops empty facets', async () => {
        respondWith([
            { name: 'Germany', stationcount: 5 },
            { name: 'Nowhere', stationcount: 0 },
            { name: '   ', stationcount: 9 },
        ]);

        await expect(service.languages()).resolves.toEqual([
            { name: 'Germany', code: '', stationCount: 5 },
        ]);
    });

    it('swallows click-report failures', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'de1.example' }]));
        fetchMock.mockRejectedValue(new Error('offline'));

        await expect(
            service.reportStationClick('uuid-1')
        ).resolves.toBeUndefined();
    });

    it('does not call the API for an empty station id', async () => {
        await service.reportStationClick('');

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns an empty list without calling the API for no ids', async () => {
        await expect(service.stationsByIds([])).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
