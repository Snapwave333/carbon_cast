import {
    applyChannelContentFilter,
    isForeignNewsChannel,
    isNewsChannel,
    isReligiousChannel,
    resolveHomeCountryFromLocale,
} from './channel-content-filter.util';

function channel(group: string, raw = '', tvgId = '') {
    return {
        group: { title: group },
        raw,
        tvg: { id: tvgId, name: '', url: '', logo: '', rec: '' },
    };
}

describe('isReligiousChannel', () => {
    it.each(['Religious', 'religion', 'GOSPEL', ' Islamic ', 'Bible'])(
        'recognises the %s group',
        (group) => {
            expect(isReligiousChannel(channel(group))).toBe(true);
        }
    );

    it('recognises a religious bucket inside a multi-group title', () => {
        expect(isReligiousChannel(channel('Music;Gospel'))).toBe(true);
    });

    it('does not hide a music channel that merely mentions a faith', () => {
        expect(isReligiousChannel(channel('Christian Rock'))).toBe(false);
    });

    it('is false for a channel with no group', () => {
        expect(isReligiousChannel({ group: undefined } as never)).toBe(false);
    });
});

describe('isNewsChannel', () => {
    it('recognises the news group regardless of case', () => {
        expect(isNewsChannel(channel('NEWS'))).toBe(true);
    });

    it('does not classify a documentary channel as news', () => {
        expect(isNewsChannel(channel('Documentary'))).toBe(false);
    });
});

describe('isForeignNewsChannel', () => {
    it('flags a news channel from another country', () => {
        const uk = channel('News', 'tvg-country="UK"');
        expect(isForeignNewsChannel(uk, 'us')).toBe(true);
    });

    it('keeps a news channel from the home country', () => {
        const us = channel('News', 'tvg-country="US"');
        expect(isForeignNewsChannel(us, 'us')).toBe(false);
    });

    it('keeps a news channel whose country is unknown', () => {
        expect(isForeignNewsChannel(channel('News'), 'us')).toBe(false);
    });

    it('reads the country out of a standard tvg-id', () => {
        const uk = channel('News', '', 'BBCNews.uk@HD');
        expect(isForeignNewsChannel(uk, 'us')).toBe(true);
    });

    it('never touches a non-news channel', () => {
        const uk = channel('Sports', 'tvg-country="UK"');
        expect(isForeignNewsChannel(uk, 'us')).toBe(false);
    });

    it('is inert without a home country', () => {
        const uk = channel('News', 'tvg-country="UK"');
        expect(isForeignNewsChannel(uk, undefined)).toBe(false);
    });
});

describe('applyChannelContentFilter', () => {
    const channels = [
        channel('News', 'tvg-country="US"'),
        channel('News', 'tvg-country="UK"'),
        channel('Religious'),
        channel('Sports', 'tvg-country="UK"'),
    ];

    it('returns the same array reference when both filters are off', () => {
        expect(applyChannelContentFilter(channels, {})).toBe(channels);
    });

    it('hides religious channels when asked', () => {
        const result = applyChannelContentFilter(channels, {
            hideReligious: true,
        });

        expect(result).toHaveLength(3);
        expect(result.some((c) => c.group.title === 'Religious')).toBe(false);
    });

    it('hides foreign news but keeps foreign sport', () => {
        const result = applyChannelContentFilter(channels, {
            localNewsOnly: true,
            homeCountry: 'us',
        });

        expect(result.map((c) => c.group.title)).toEqual([
            'News',
            'Religious',
            'Sports',
        ]);
        expect(result).toHaveLength(3);
    });

    it('applies both filters together', () => {
        const result = applyChannelContentFilter(channels, {
            hideReligious: true,
            localNewsOnly: true,
            homeCountry: 'us',
        });

        expect(result).toHaveLength(2);
    });

    it('ignores local-news-only without a home country', () => {
        expect(
            applyChannelContentFilter(channels, { localNewsOnly: true })
        ).toBe(channels);
    });

    it('accepts an upper-cased home country', () => {
        const result = applyChannelContentFilter(channels, {
            localNewsOnly: true,
            homeCountry: 'US',
        });

        expect(result).toHaveLength(3);
    });
});

describe('resolveHomeCountryFromLocale', () => {
    it('reads the region out of a full locale', () => {
        expect(resolveHomeCountryFromLocale('en-GB')).toBe('gb');
        expect(resolveHomeCountryFromLocale('pt_BR')).toBe('br');
    });

    it('returns undefined rather than guessing for a language-only locale', () => {
        expect(resolveHomeCountryFromLocale('en')).toBeUndefined();
        expect(resolveHomeCountryFromLocale(undefined)).toBeUndefined();
    });
});
