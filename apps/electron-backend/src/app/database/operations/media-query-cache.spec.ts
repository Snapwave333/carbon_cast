import type { GlobalSearchResult } from '@iptvnator/shared/interfaces';
import {
    createMediaQueryCacheKey,
    MEDIA_QUERY_CACHE_TTL_MS,
    readMediaQueryCache,
    writeMediaQueryCache,
} from './media-query-cache';

const result = [
    {
        id: 42,
        title: 'Local result',
        playlist_id: 'playlist-1',
        playlist_name: 'Portal',
        source_type: 'xtream',
        content_type: 'movie',
        type: 'movie',
    },
] as unknown as GlobalSearchResult[];

describe('media query cache', () => {
    it('normalizes equivalent query keys for fast repeated searches', () => {
        const first = createMediaQueryCacheKey({
            searchTerm: '  The Matrix  ',
            types: ['series', 'movie'],
            excludeHidden: false,
            sources: ['m3u', 'xtream'],
            limit: 101,
            offset: 0,
        });
        const second = createMediaQueryCacheKey({
            searchTerm: 'the matrix',
            types: ['movie', 'series'],
            excludeHidden: false,
            sources: ['xtream', 'm3u'],
            limit: 101,
            offset: 0,
        });

        expect(first).toBe(second);
    });

    it('returns only a fresh cached result set', async () => {
        const db = {
            all: jest.fn().mockResolvedValue([{ result_json: JSON.stringify(result) }]),
            run: jest.fn(),
        };

        await expect(readMediaQueryCache(db as never, 'key', 100)).resolves.toEqual(result);
        expect(db.all).toHaveBeenCalledTimes(1);
    });

    it('fails open for malformed cached JSON', async () => {
        const db = {
            all: jest.fn().mockResolvedValue([{ result_json: '{not-json' }]),
            run: jest.fn(),
        };

        await expect(readMediaQueryCache(db as never, 'key')).resolves.toBeNull();
    });

    it('writes a result set and prunes entries past the exact 72-hour window', async () => {
        const db = { run: jest.fn().mockResolvedValue(undefined) };
        await writeMediaQueryCache(db as never, 'key', result, 1_000);

        expect(db.run).toHaveBeenCalledTimes(2);
        expect(db.run.mock.calls[0][0]).toBeDefined();
        expect(MEDIA_QUERY_CACHE_TTL_MS).toBe(72 * 60 * 60 * 1000);
    });
});
