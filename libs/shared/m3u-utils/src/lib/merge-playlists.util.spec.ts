import {
    ParsedPlaylist,
    ParsedPlaylistItem,
} from '@iptvnator/shared/interfaces';
import {
    mergeParsedPlaylists,
    normalizeStreamUrl,
    PlaylistMergeSource,
} from './merge-playlists.util';

function item(
    overrides: Partial<ParsedPlaylistItem> & { url?: string }
): ParsedPlaylistItem {
    return {
        name: 'Channel',
        tvg: { id: '', name: '', url: '', logo: '', rec: '' },
        group: { title: '' },
        http: { referrer: '', 'user-agent': '' },
        raw: '#EXTINF:-1,Channel',
        ...overrides,
    };
}

function playlist(
    items: ParsedPlaylistItem[],
    attrs: Record<string, string | undefined> = {}
): ParsedPlaylist {
    return { header: { attrs, raw: '#EXTM3U' }, items };
}

function source(
    label: string,
    items: ParsedPlaylistItem[]
): PlaylistMergeSource {
    return { label, playlist: playlist(items) };
}

describe('mergeParsedPlaylists', () => {
    it('concatenates the items of every source', () => {
        const result = mergeParsedPlaylists([
            source('UK', [item({ url: 'http://a.example/1' })]),
            source('News', [item({ url: 'http://b.example/2' })]),
        ]);

        expect(result.playlist.items).toHaveLength(2);
        expect(result.acceptedBySource).toEqual([1, 1]);
        expect(result.duplicateCount).toBe(0);
    });

    it('keeps only the first copy of a stream that appears in several sources', () => {
        const result = mergeParsedPlaylists([
            source('UK', [item({ name: 'BBC', url: 'http://a.example/1' })]),
            source('News', [
                item({ name: 'BBC News', url: 'http://a.example/1' }),
            ]),
        ]);

        expect(result.playlist.items).toHaveLength(1);
        expect(result.playlist.items[0].name).toBe('BBC');
        expect(result.duplicateCount).toBe(1);
        expect(result.acceptedBySource).toEqual([1, 0]);
    });

    it('treats cosmetic URL differences as the same stream', () => {
        const result = mergeParsedPlaylists([
            source('A', [item({ url: 'HTTP://Cdn.Example/Live/' })]),
            source('B', [item({ url: 'http://cdn.example/Live' })]),
        ]);

        expect(result.playlist.items).toHaveLength(1);
        expect(result.duplicateCount).toBe(1);
    });

    it('does not case-fold the path, which providers treat as significant', () => {
        const result = mergeParsedPlaylists([
            source('A', [item({ url: 'http://cdn.example/Live' })]),
            source('B', [item({ url: 'http://cdn.example/live' })]),
        ]);

        expect(result.playlist.items).toHaveLength(2);
        expect(result.duplicateCount).toBe(0);
    });

    it('drops entries that carry no stream URL without counting them as duplicates', () => {
        const result = mergeParsedPlaylists([
            source('A', [item({ url: undefined }), item({ url: '   ' })]),
        ]);

        expect(result.playlist.items).toHaveLength(0);
        expect(result.duplicateCount).toBe(0);
        expect(result.acceptedBySource).toEqual([0]);
    });

    it('reports truncation instead of exceeding the item ceiling', () => {
        const result = mergeParsedPlaylists(
            [
                source('A', [
                    item({ url: 'http://a.example/1' }),
                    item({ url: 'http://a.example/2' }),
                    item({ url: 'http://a.example/3' }),
                ]),
            ],
            { maxItems: 2 }
        );

        expect(result.playlist.items).toHaveLength(2);
        expect(result.truncatedCount).toBe(1);
    });

    it('optionally prefixes group titles with the source label', () => {
        const result = mergeParsedPlaylists(
            [
                source('UK', [
                    item({
                        url: 'http://a.example/1',
                        group: { title: 'News' },
                    }),
                    item({ url: 'http://a.example/2', group: { title: '' } }),
                ]),
            ],
            { prefixGroupsWithSource: true }
        );

        expect(result.playlist.items[0].group.title).toBe('UK · News');
        expect(result.playlist.items[1].group.title).toBe('UK');
    });

    it('leaves group titles untouched by default', () => {
        const result = mergeParsedPlaylists([
            source('UK', [
                item({ url: 'http://a.example/1', group: { title: 'News' } }),
            ]),
        ]);

        expect(result.playlist.items[0].group.title).toBe('News');
    });

    it('unions the EPG urls of every source into one header attribute', () => {
        const result = mergeParsedPlaylists([
            {
                label: 'UK',
                playlist: playlist([item({ url: 'http://a.example/1' })], {
                    'x-tvg-url': 'http://epg.example/uk.xml',
                }),
            },
            {
                label: 'IE',
                playlist: playlist([item({ url: 'http://a.example/2' })], {
                    'x-tvg-url':
                        'http://epg.example/ie.xml,http://epg.example/uk.xml',
                }),
            },
        ]);

        expect(result.playlist.header.attrs['x-tvg-url']).toBe(
            'http://epg.example/uk.xml,http://epg.example/ie.xml'
        );
        expect(result.playlist.header.raw).toContain('x-tvg-url=');
    });

    it('produces a valid header when no source declares any attribute', () => {
        const result = mergeParsedPlaylists([
            source('A', [item({ url: 'http://a.example/1' })]),
        ]);

        expect(result.playlist.header.raw).toBe('#EXTM3U');
    });

    it('returns an empty playlist for an empty source list', () => {
        const result = mergeParsedPlaylists([]);

        expect(result.playlist.items).toEqual([]);
        expect(result.acceptedBySource).toEqual([]);
    });
});

describe('normalizeStreamUrl', () => {
    it('returns an empty string for missing input', () => {
        expect(normalizeStreamUrl(undefined)).toBe('');
        expect(normalizeStreamUrl('  ')).toBe('');
    });

    it('preserves the query string, which selects the stream on many hosts', () => {
        expect(normalizeStreamUrl('http://a.example/get?token=AbC')).toBe(
            'http://a.example/get?token=AbC'
        );
    });

    it('falls back to a literal comparison for malformed URLs', () => {
        expect(normalizeStreamUrl('not a url/')).toBe('not a url');
    });
});
