import {
    adjustArtworkFit,
    formatEpisodeBadge,
    getEpgCategoryAccent,
    getProgramArtworkUrl,
    getProgramTimeMs,
} from './epg-program.utils';

describe('getProgramTimeMs', () => {
    const isoOfSeconds = (seconds: number) =>
        new Date(seconds * 1000).toISOString();

    it('reads a normal epoch-seconds timestamp', () => {
        const seconds = Math.floor(Date.UTC(2026, 0, 2, 10, 30) / 1000);

        expect(getProgramTimeMs(isoOfSeconds(seconds), seconds)).toBe(
            seconds * 1000
        );
    });

    it('accepts a timestamp a feed already sent in milliseconds', () => {
        const ms = Date.UTC(2026, 0, 2, 10, 30);

        // Multiplying this by 1000 used to place the programme ~55,000 years
        // out, which stretched the timeline axis until the tab locked up.
        expect(getProgramTimeMs(new Date(ms).toISOString(), ms)).toBe(ms);
    });

    it('rejects timestamps outside a plausible range', () => {
        const farFuture = Math.floor(Date.UTC(9999, 0, 1) / 1000);
        const longPast = Math.floor(Date.UTC(1970, 0, 1) / 1000) + 1;

        expect(getProgramTimeMs('', farFuture)).toBeNaN();
        expect(getProgramTimeMs('', longPast)).toBeNaN();
    });

    it('falls back to the ISO value when no timestamp is supplied', () => {
        const iso = new Date(Date.UTC(2026, 0, 2, 10, 30)).toISOString();

        expect(getProgramTimeMs(iso)).toBe(Date.parse(iso));
    });

    it('returns NaN for an unparseable date', () => {
        expect(getProgramTimeMs('not-a-date')).toBeNaN();
    });
});

describe('getEpgCategoryAccent', () => {
    it('maps known category vocabularies onto their bucket colour', () => {
        expect(getEpgCategoryAccent('Movie')).toBe(
            getEpgCategoryAccent('Film / Drama')
        );
        expect(getEpgCategoryAccent('News magazine')).toBe(
            getEpgCategoryAccent('Nachrichten')
        );
        expect(getEpgCategoryAccent('Sports')).toBe(
            getEpgCategoryAccent('Fußball')
        );
        expect(getEpgCategoryAccent('Movie')).not.toBe(
            getEpgCategoryAccent('Sports')
        );
        expect(getEpgCategoryAccent('Comedy')).not.toBe(
            getEpgCategoryAccent('Drama series')
        );
        expect(getEpgCategoryAccent('Animation')).not.toBe(
            getEpgCategoryAccent('Kids')
        );
    });

    it('gives unknown categories a stable colour via hashing', () => {
        const first = getEpgCategoryAccent('Telenovela Especial');
        expect(first).toMatch(/^#/);
        expect(getEpgCategoryAccent('Telenovela Especial')).toBe(first);
    });

    it('returns null for missing or blank categories', () => {
        expect(getEpgCategoryAccent(null)).toBeNull();
        expect(getEpgCategoryAccent(undefined)).toBeNull();
        expect(getEpgCategoryAccent('   ')).toBeNull();
    });
});

describe('adjustArtworkFit', () => {
    function imageLoadEvent(width: number, height: number): HTMLImageElement {
        const img = document.createElement('img');
        Object.defineProperty(img, 'naturalWidth', { value: width });
        Object.defineProperty(img, 'naturalHeight', { value: height });
        adjustArtworkFit({ target: img } as unknown as Event);
        return img;
    }

    it('marks near-square and portrait images for contain fit', () => {
        expect(imageLoadEvent(100, 100).classList.contains('art-contain')).toBe(
            true
        );
        expect(imageLoadEvent(200, 300).classList.contains('art-contain')).toBe(
            true
        );
    });

    it('leaves wide stills on the cover crop', () => {
        expect(imageLoadEvent(640, 360).classList.contains('art-contain')).toBe(
            false
        );
    });

    it('ignores events without usable dimensions', () => {
        expect(imageLoadEvent(0, 0).classList.contains('art-contain')).toBe(
            false
        );
    });
});

describe('formatEpisodeBadge', () => {
    it('parses onscreen values', () => {
        expect(formatEpisodeBadge('S02E13')).toBe('S2 E13');
        expect(formatEpisodeBadge('s2 e13')).toBe('S2 E13');
        expect(formatEpisodeBadge('2x13')).toBe('S2 E13');
        expect(formatEpisodeBadge('E5')).toBe('E5');
        expect(formatEpisodeBadge('Ep12')).toBe('E12');
    });

    it('parses zero-based xmltv_ns values', () => {
        expect(formatEpisodeBadge('1.12.')).toBe('S2 E13');
        expect(formatEpisodeBadge('1.12.0/2')).toBe('S2 E13');
        expect(formatEpisodeBadge('0 . 12/13 .')).toBe('S1 E13');
        expect(formatEpisodeBadge('.4.')).toBe('E5');
        expect(formatEpisodeBadge('2..')).toBe('S3');
    });

    it('returns null for unparseable or empty values', () => {
        expect(formatEpisodeBadge(null)).toBeNull();
        expect(formatEpisodeBadge(undefined)).toBeNull();
        expect(formatEpisodeBadge('')).toBeNull();
        expect(formatEpisodeBadge('Season finale')).toBeNull();
        expect(formatEpisodeBadge('..')).toBeNull();
        expect(formatEpisodeBadge('EP123456')).toBeNull();
    });
});

describe('getProgramArtworkUrl', () => {
    it('returns trimmed absolute http(s) URLs', () => {
        expect(
            getProgramArtworkUrl({ iconUrl: ' https://img.example/still.jpg ' })
        ).toBe('https://img.example/still.jpg');
        expect(
            getProgramArtworkUrl({ iconUrl: 'http://img.example/still.jpg' })
        ).toBe('http://img.example/still.jpg');
    });

    it('rejects missing or empty values', () => {
        expect(getProgramArtworkUrl({})).toBeNull();
        expect(getProgramArtworkUrl({ iconUrl: null })).toBeNull();
        expect(getProgramArtworkUrl({ iconUrl: '   ' })).toBeNull();
    });

    it('rejects non-http(s) URLs from untrusted XMLTV feeds', () => {
        expect(
            getProgramArtworkUrl({ iconUrl: 'javascript:alert(1)' })
        ).toBeNull();
        expect(
            getProgramArtworkUrl({ iconUrl: 'data:image/png;base64,AAAA' })
        ).toBeNull();
        expect(
            getProgramArtworkUrl({ iconUrl: 'file:///etc/x.png' })
        ).toBeNull();
        expect(
            getProgramArtworkUrl({ iconUrl: 'relative/path.png' })
        ).toBeNull();
    });
});
