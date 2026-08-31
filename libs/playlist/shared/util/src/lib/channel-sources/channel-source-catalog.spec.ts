import {
    CHANNEL_SOURCE_CATALOG,
    filterChannelSources,
    findChannelSource,
    findChannelSources,
    totalStreamCount,
} from './channel-source-catalog';
import { FEATURED_CHANNEL_SOURCES } from './channel-source-featured';

describe('channel source catalog', () => {
    it('leads with the curated entries', () => {
        expect(
            CHANNEL_SOURCE_CATALOG.slice(0, FEATURED_CHANNEL_SOURCES.length)
        ).toEqual(FEATURED_CHANNEL_SOURCES);
    });

    it('gives every entry a unique id', () => {
        const ids = CHANNEL_SOURCE_CATALOG.map((source) => source.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('points every entry at an https url', () => {
        const insecure = CHANNEL_SOURCE_CATALOG.filter(
            (source) => !source.url.startsWith('https://')
        );
        expect(insecure).toEqual([]);
    });

    it('attributes every entry to a provider with a homepage', () => {
        for (const source of CHANNEL_SOURCE_CATALOG) {
            expect(source.provider.name).toBeTruthy();
            expect(source.provider.homepage).toMatch(/^https:\/\//);
        }
    });

    it('carries enough slices to be worth browsing', () => {
        const kinds = new Set(CHANNEL_SOURCE_CATALOG.map((s) => s.kind));
        expect(kinds).toEqual(
            new Set(['featured', 'country', 'region', 'category', 'language'])
        );
        expect(CHANNEL_SOURCE_CATALOG.length).toBeGreaterThan(100);
    });
});

describe('findChannelSources', () => {
    it('resolves ids in the order given and skips unknown ones', () => {
        const [first, second] = CHANNEL_SOURCE_CATALOG;
        const resolved = findChannelSources([second.id, 'nope', first.id]);

        expect(resolved).toEqual([second, first]);
    });

    it('resolves a repeated id only once', () => {
        const [first] = CHANNEL_SOURCE_CATALOG;
        expect(findChannelSources([first.id, first.id])).toEqual([first]);
    });

    it('returns undefined for an unknown single id', () => {
        expect(findChannelSource('nope')).toBeUndefined();
    });
});

describe('filterChannelSources', () => {
    it('returns everything for an empty query', () => {
        expect(filterChannelSources(CHANNEL_SOURCE_CATALOG, {})).toHaveLength(
            CHANNEL_SOURCE_CATALOG.length
        );
    });

    it('matches a country by name', () => {
        const results = filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            query: 'united states',
            kinds: ['country'],
        });

        expect(results.some((source) => source.code === 'us')).toBe(true);
    });

    it('matches a country by its code', () => {
        const results = filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            query: 'uk',
            kinds: ['country'],
        });

        expect(results.some((source) => source.code === 'uk')).toBe(true);
    });

    it('requires every term of a multi-word query to match', () => {
        const results = filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            query: 'united zzzz',
        });

        expect(results).toEqual([]);
    });

    it('restricts results to the requested kinds', () => {
        const results = filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            kinds: ['category'],
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results.every((source) => source.kind === 'category')).toBe(
            true
        );
    });

    it('ignores case and surrounding whitespace', () => {
        const results = filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            query: '  NEWS  ',
            kinds: ['category'],
        });

        expect(results.some((source) => source.code === 'news')).toBe(true);
    });
});

describe('totalStreamCount', () => {
    it('sums the snapshot counts of a selection', () => {
        expect(
            totalStreamCount([{ streamCount: 10 }, { streamCount: 5 }] as never)
        ).toBe(15);
    });

    it('is zero for an empty selection', () => {
        expect(totalStreamCount([])).toBe(0);
    });
});
