import {
    canonicalCategoryKey,
    canonicalizeCategoryLabel,
    expandChannelCategories,
} from './category-normalization.util';

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
        expect(expandChannelCategories('Animation;animation; ANIMATION ')).toEqual(
            [{ key: 'animation', label: 'Animation' }]
        );
    });

    it('drops empty semicolon segments', () => {
        expect(expandChannelCategories('Animation;;Kids;')).toEqual([
            { key: 'animation', label: 'Animation' },
            { key: 'kids', label: 'Kids' },
        ]);
    });

    it('returns a single Uncategorized bucket for empty or missing titles', () => {
        const uncategorized = [{ key: '', label: 'Uncategorized' }];
        expect(expandChannelCategories(undefined)).toEqual(uncategorized);
        expect(expandChannelCategories('')).toEqual(uncategorized);
        expect(expandChannelCategories('   ')).toEqual(uncategorized);
        expect(expandChannelCategories(';;')).toEqual(uncategorized);
    });
});
