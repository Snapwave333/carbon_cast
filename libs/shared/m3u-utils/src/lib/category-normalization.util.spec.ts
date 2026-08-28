import type { Channel } from '@iptvnator/shared/interfaces';
import {
    canonicalCategoryKey,
    canonicalizeCategoryLabel,
    expandChannelCategories,
    getChannelCountryCodes,
    isExplicitlyNonUsChannel,
    resolveChannelCategories,
} from './category-normalization.util';

function channel(overrides: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-id',
        name: 'Channel name',
        url: 'https://example.com/live.m3u8',
        group: { title: 'Undefined' },
        tvg: { id: 'Channel.us@SD', name: '', url: '', logo: '', rec: '' },
        http: { origin: '', referrer: '', 'user-agent': '' },
        radio: 'false',
        ...overrides,
    };
}

describe('canonicalizeCategoryLabel', () => {
    it('trims and collapses internal whitespace', () => {
        expect(canonicalizeCategoryLabel('  Animation  ')).toBe('Animation');
        expect(canonicalizeCategoryLabel('Kids   Shows')).toBe('Kids Shows');
    });

    it('keeps an empty or whitespace-only label empty', () => {
        expect(canonicalizeCategoryLabel('')).toBe('');
        expect(canonicalizeCategoryLabel('   ')).toBe('');
    });

    it('preserves the display casing', () => {
        expect(canonicalizeCategoryLabel('ANIMATION')).toBe('ANIMATION');
    });
});

describe('canonicalCategoryKey', () => {
    it('folds case and whitespace variants onto one key', () => {
        expect(canonicalCategoryKey('Animation')).toBe('animation');
        expect(canonicalCategoryKey('ANIMATION')).toBe('animation');
        expect(canonicalCategoryKey('  Animation  ')).toBe('animation');
    });

    it('applies the conservative alias map', () => {
        expect(canonicalCategoryKey('Anime')).toBe('animation');
        expect(canonicalCategoryKey(' anime ')).toBe('animation');
    });

    it('keeps an empty key empty', () => {
        expect(canonicalCategoryKey('')).toBe('');
        expect(canonicalCategoryKey('   ')).toBe('');
    });
});

describe('expandChannelCategories', () => {
    it('collapses case and whitespace variants to a single canonical key', () => {
        expect(expandChannelCategories('Animation')).toEqual([
            { key: 'animation', label: 'Animation' },
        ]);
        expect(expandChannelCategories('ANIMATION')).toEqual([
            { key: 'animation', label: 'ANIMATION' },
        ]);
        expect(expandChannelCategories('  Animation  ')).toEqual([
            { key: 'animation', label: 'Animation' },
        ]);
    });

    it('folds the anime alias into animation', () => {
        expect(expandChannelCategories('Anime')).toEqual([
            { key: 'animation', label: 'Anime' },
        ]);
    });

    it('splits on semicolons only, not commas', () => {
        expect(expandChannelCategories('Animation;Kids')).toEqual([
            { key: 'animation', label: 'Animation' },
            { key: 'kids', label: 'Kids' },
        ]);
        expect(expandChannelCategories('Movies, Series')).toEqual([
            { key: 'movies, series', label: 'Movies, Series' },
        ]);
    });

    it('de-dupes multi-group membership by canonical key regardless of order', () => {
        const first = expandChannelCategories('Kids;Animation');
        const second = expandChannelCategories('Animation;Kids');

        expect(new Set(first.map((c) => c.key))).toEqual(
            new Set(second.map((c) => c.key))
        );
        expect(
            expandChannelCategories('Animation;animation; ANIMATION ')
        ).toEqual([{ key: 'animation', label: 'Animation' }]);
    });

    it('drops empty semicolon segments', () => {
        expect(expandChannelCategories('Animation;;Kids;')).toEqual([
            { key: 'animation', label: 'Animation' },
            { key: 'kids', label: 'Kids' },
        ]);
    });

    it('drops empty and placeholder titles instead of creating a catch-all category', () => {
        expect(expandChannelCategories(undefined)).toEqual([]);
        expect(expandChannelCategories('')).toEqual([]);
        expect(expandChannelCategories('Undefined')).toEqual([]);
        expect(expandChannelCategories(' none ; n/a ')).toEqual([]);
    });

    it('keeps geographic and generic provider titles as real buckets', () => {
        expect(expandChannelCategories('USA')).toEqual([
            { key: 'usa', label: 'USA' },
        ]);
        expect(expandChannelCategories('General')).toEqual([
            { key: 'general', label: 'General' },
        ]);
        expect(expandChannelCategories('Series')).toEqual([
            { key: 'series', label: 'Series' },
        ]);
        expect(expandChannelCategories('Local')).toEqual([
            { key: 'local', label: 'Local' },
        ]);
        expect(expandChannelCategories('International')).toEqual([
            { key: 'international', label: 'International' },
        ]);
    });

    it('treats the provider group as authoritative and never re-classifies by channel name', () => {
        // "ESPN Sports" must stay in the provider's News group rather than
        // being guessed into Sports; geographic groups keep their channels.
        expect(
            resolveChannelCategories(
                channel({ group: { title: 'News' }, name: 'ESPN Sports' })
            )
        ).toEqual([{ key: 'news', label: 'News' }]);
        expect(
            resolveChannelCategories(
                channel({
                    group: { title: 'USA' },
                    name: 'Natick Public Access',
                })
            )
        ).toEqual([{ key: 'usa', label: 'USA' }]);
        expect(
            resolveChannelCategories(
                channel({ group: { title: 'General' }, name: 'NBC West' })
            )
        ).toEqual([{ key: 'general', label: 'General' }]);
        expect(
            resolveChannelCategories(
                channel({ group: { title: 'Series' }, name: 'PBS Nature' })
            )
        ).toEqual([{ key: 'series', label: 'Series' }]);
    });

    it('falls back to a single Uncategorized bucket for missing or placeholder titles', () => {
        const uncategorized = [{ key: 'uncategorized', label: 'Uncategorized' }];

        expect(
            resolveChannelCategories(channel({ group: { title: '' } }))
        ).toEqual(uncategorized);
        expect(
            resolveChannelCategories(channel({ group: { title: 'Undefined' } }))
        ).toEqual(uncategorized);
        expect(
            resolveChannelCategories(
                channel({ group: undefined, name: 'Praise TV' })
            )
        ).toEqual(uncategorized);
    });

    it('identifies explicit country metadata without treating unknown channels as foreign', () => {
        expect(
            getChannelCountryCodes(
                channel({
                    tvg: {
                        id: 'WPIX.us@SD',
                        name: '',
                        url: '',
                        logo: '',
                        rec: '',
                    },
                })
            )
        ).toEqual(['us']);
        expect(
            isExplicitlyNonUsChannel(
                channel({
                    tvg: {
                        id: 'RugbyPass.uk@SD',
                        name: '',
                        url: '',
                        logo: '',
                        rec: '',
                    },
                })
            )
        ).toBe(true);
        expect(
            isExplicitlyNonUsChannel(
                channel({
                    tvg: {
                        id: 'UnknownChannel',
                        name: '',
                        url: '',
                        logo: '',
                        rec: '',
                    },
                })
            )
        ).toBe(false);
    });
});
