import { MultiEpgLayoutProgram } from './multi-epg-layout.util';
import { MultiEpgTmdbArtwork } from './multi-epg-tmdb-artwork';

const NOW = Date.parse('2026-08-13T20:00:00.000Z');

function program(
    overrides: Partial<MultiEpgLayoutProgram> = {}
): MultiEpgLayoutProgram {
    return {
        title: 'Night Train',
        start: '2026-08-13T19:30:00.000Z',
        stop: '2026-08-13T21:00:00.000Z',
        channel: 'channel-1',
        desc: null,
        category: 'Movie',
        startDate: new Date('2026-08-13T19:30:00.000Z'),
        stopDate: new Date('2026-08-13T21:00:00.000Z'),
        startPosition: 0,
        width: 240,
        timeLabel: '19:30 – 21:00',
        episodeBadge: null,
        categoryAccent: null,
        ...overrides,
    } as MultiEpgLayoutProgram;
}

function createTmdbMock(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        isEnabled: jest.fn().mockReturnValue(true),
        enrichMovie: jest
            .fn()
            .mockResolvedValue({ id: 1, backdrop_path: '/movie.jpg' }),
        enrichTv: jest
            .fn()
            .mockResolvedValue({ id: 2, poster_path: '/show.jpg' }),
        ...overrides,
    };
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe('MultiEpgTmdbArtwork', () => {
    it('resolves a movie backdrop after the first ask and memoizes it', async () => {
        const tmdb = createTmdbMock();
        const queue = new MultiEpgTmdbArtwork(tmdb, 48, 2, () => NOW);

        expect(queue.cellArtwork(program())).toBeNull();
        await flush();

        expect(tmdb.enrichMovie).toHaveBeenCalledWith({
            title: 'Night Train',
        });
        expect(queue.cellArtwork(program())).toBe(
            'https://image.tmdb.org/t/p/w300/movie.jpg'
        );
        expect(tmdb.enrichMovie).toHaveBeenCalledTimes(1);
    });

    it('dedupes lookups by title across repeat airings', async () => {
        const tmdb = createTmdbMock();
        const queue = new MultiEpgTmdbArtwork(tmdb, 48, 2, () => NOW);

        queue.cellArtwork(program());
        queue.cellArtwork(program({ startPosition: 500 }));
        await flush();

        expect(tmdb.enrichMovie).toHaveBeenCalledTimes(1);
    });

    it('uses the TV lookup for non-movie categories and memoizes misses', async () => {
        const tmdb = createTmdbMock({
            enrichTv: jest.fn().mockResolvedValue(null),
        });
        const queue = new MultiEpgTmdbArtwork(tmdb, 48, 2, () => NOW);
        const drama = program({ category: 'Drama series' });

        queue.cellArtwork(drama);
        await flush();

        expect(tmdb.enrichTv).toHaveBeenCalledWith({ title: 'Night Train' });
        expect(queue.cellArtwork(drama)).toBeNull();
        expect(tmdb.enrichTv).toHaveBeenCalledTimes(1);
    });

    it('never looks up when disabled, narrow, uncategorized, news/sports, or off-window', async () => {
        const disabled = createTmdbMock({
            isEnabled: jest.fn().mockReturnValue(false),
        });
        new MultiEpgTmdbArtwork(disabled, 48, 2, () => NOW).cellArtwork(
            program()
        );

        const tmdb = createTmdbMock();
        const queue = new MultiEpgTmdbArtwork(tmdb, 48, 2, () => NOW);
        queue.cellArtwork(program({ width: 120 }));
        queue.cellArtwork(program({ category: null }));
        queue.cellArtwork(program({ category: 'Sports' }));
        queue.cellArtwork(
            program({
                startDate: new Date('2026-08-14T10:00:00.000Z'),
                stopDate: new Date('2026-08-14T11:00:00.000Z'),
            })
        );
        await flush();

        expect(disabled.enrichMovie).not.toHaveBeenCalled();
        expect(tmdb.enrichMovie).not.toHaveBeenCalled();
        expect(tmdb.enrichTv).not.toHaveBeenCalled();
    });

    it('never looks up when the guide-artwork setting is off', async () => {
        const tmdb = createTmdbMock();
        const queue = new MultiEpgTmdbArtwork(
            tmdb,
            48,
            2,
            () => NOW,
            () => false
        );
        queue.cellArtwork(program());
        await flush();

        expect(tmdb.enrichMovie).not.toHaveBeenCalled();
    });

    it('caps the number of lookups per session', async () => {
        const tmdb = createTmdbMock();
        const queue = new MultiEpgTmdbArtwork(tmdb, 2, 2, () => NOW);

        queue.cellArtwork(program({ title: 'One' }));
        queue.cellArtwork(program({ title: 'Two' }));
        queue.cellArtwork(program({ title: 'Three' }));
        await flush();

        expect(tmdb.enrichMovie).toHaveBeenCalledTimes(2);
    });
});
