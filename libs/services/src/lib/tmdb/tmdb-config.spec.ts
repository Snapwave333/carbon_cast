import { Language } from '@iptvnator/shared/interfaces';
import {
    isTmdbBearerToken,
    normalizeTmdbApiKey,
    tmdbSearchLanguageForTitle,
    toTmdbLanguage,
} from './tmdb-config';

describe('toTmdbLanguage', () => {
    it('maps app languages to TMDB codes', () => {
        expect(toTmdbLanguage(Language.GERMAN)).toBe('de-DE');
        expect(toTmdbLanguage(Language.RUSSIAN)).toBe('ru-RU');
    });

    it('falls back to en-US for unknown values', () => {
        expect(toTmdbLanguage(undefined)).toBe('en-US');
        expect(toTmdbLanguage('xx')).toBe('en-US');
    });
});

describe('tmdbSearchLanguageForTitle', () => {
    it('uses the app language for Latin titles', () => {
        expect(tmdbSearchLanguageForTitle('The Matrix', Language.GERMAN)).toBe(
            'de-DE'
        );
    });

    it('switches to ru-RU for Cyrillic titles when the app language is not Cyrillic-based', () => {
        expect(
            tmdbSearchLanguageForTitle('Ирония судьбы', Language.ENGLISH)
        ).toBe('ru-RU');
        expect(
            tmdbSearchLanguageForTitle('Ирония судьбы', Language.GERMAN)
        ).toBe('ru-RU');
    });

    it('keeps Cyrillic-based app languages for Cyrillic titles', () => {
        expect(
            tmdbSearchLanguageForTitle('Ирония судьбы', Language.RUSSIAN)
        ).toBe('ru-RU');
        expect(
            tmdbSearchLanguageForTitle('Ірония лёсу', Language.BELARUSIAN)
        ).toBe('be-BY');
    });
});

describe('normalizeTmdbApiKey', () => {
    it('returns an empty string for missing values', () => {
        expect(normalizeTmdbApiKey(undefined)).toBe('');
        expect(normalizeTmdbApiKey(null)).toBe('');
        expect(normalizeTmdbApiKey('   ')).toBe('');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeTmdbApiKey('  abc123  ')).toBe('abc123');
    });

    it('strips a pasted Bearer prefix so v4 tokens stay detectable', () => {
        expect(normalizeTmdbApiKey('Bearer eyJhbGciOi')).toBe('eyJhbGciOi');
        expect(normalizeTmdbApiKey('bearer   eyJhbGciOi')).toBe('eyJhbGciOi');
        expect(isTmdbBearerToken(normalizeTmdbApiKey('Bearer eyJhbGciOi'))).toBe(
            true
        );
    });

    it('strips wrapping quotes copied from curl examples', () => {
        expect(normalizeTmdbApiKey('"abc123"')).toBe('abc123');
        expect(normalizeTmdbApiKey("'Bearer eyJhbGciOi'")).toBe('eyJhbGciOi');
    });

    it('leaves a plain v3 key untouched', () => {
        expect(normalizeTmdbApiKey('0123456789abcdef')).toBe('0123456789abcdef');
        expect(isTmdbBearerToken('0123456789abcdef')).toBe(false);
    });
});
