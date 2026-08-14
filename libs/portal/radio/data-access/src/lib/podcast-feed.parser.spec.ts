import { parseDuration, parsePodcastFeed } from './podcast-feed.parser';

const CONTEXT = {
    showId: '1234',
    showTitle: 'Fallback Show',
    artwork: 'https://cdn.example/fallback.jpg',
};

function rssFeed(items: string, channelExtras = ''): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
            <channel>
                <title>Deep Dive</title>
                <link>https://deepdive.example</link>
                <description>&lt;p&gt;A show about &amp;amp; things&lt;/p&gt;</description>
                <itunes:image href="https://cdn.example/show.jpg"/>
                ${channelExtras}
                ${items}
            </channel>
        </rss>`;
}

describe('parseDuration', () => {
    it.each([
        ['90', 90],
        ['1:30', 90],
        ['01:02:03', 3723],
        ['3600', 3600],
        ['12:34.5', 755],
    ])('parses %s', (input, expected) => {
        expect(parseDuration(input)).toBe(expected);
    });

    it.each(['', '   ', 'abc', '-30', '0', '1:2:3:4'])(
        'returns null for %s',
        (input) => {
            expect(parseDuration(input)).toBeNull();
        }
    );
});

describe('parsePodcastFeed', () => {
    it('reads channel metadata and strips markup from the description', () => {
        const feed = parsePodcastFeed(rssFeed(''), CONTEXT);

        expect(feed.title).toBe('Deep Dive');
        expect(feed.artwork).toBe('https://cdn.example/show.jpg');
        expect(feed.websiteUrl).toBe('https://deepdive.example');
        expect(feed.description).toBe('A show about & things');
        expect(feed.episodes).toEqual([]);
    });

    it('maps an RSS item with an audio enclosure to an episode', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Episode One</title>
                    <guid>urn:episode:1</guid>
                    <pubDate>Tue, 04 Mar 2025 09:00:00 GMT</pubDate>
                    <itunes:duration>45:10</itunes:duration>
                    <description>First &lt;b&gt;episode&lt;/b&gt;</description>
                    <enclosure url="https://cdn.example/1.mp3" type="audio/mpeg" length="100"/>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes).toEqual([
            {
                id: 'urn:episode:1',
                showId: '1234',
                showTitle: 'Deep Dive',
                title: 'Episode One',
                audioUrl: 'https://cdn.example/1.mp3',
                durationSeconds: 2710,
                publishedAt: '2025-03-04T09:00:00.000Z',
                description: 'First episode',
                artwork: 'https://cdn.example/show.jpg',
            },
        ]);
    });

    it('prefers the episode artwork over the channel artwork', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Art</title>
                    <itunes:image href="https://cdn.example/episode.jpg"/>
                    <enclosure url="https://cdn.example/2.mp3" type="audio/mpeg"/>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes[0].artwork).toBe('https://cdn.example/episode.jpg');
    });

    it('accepts an enclosure identified only by its file extension', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Untyped</title>
                    <enclosure url="https://cdn.example/3.m4a?token=x"/>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes[0].audioUrl).toBe(
            'https://cdn.example/3.m4a?token=x'
        );
    });

    it('skips items that carry no audio', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Video only</title>
                    <enclosure url="https://cdn.example/clip.mp4" type="video/mp4"/>
                </item>
                <item>
                    <title>No enclosure</title>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes).toEqual([]);
    });

    it('falls back to the audio URL when the item has no guid', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Anonymous</title>
                    <enclosure url="https://cdn.example/4.mp3" type="audio/mpeg"/>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes[0].id).toBe('https://cdn.example/4.mp3');
    });

    it('leaves publishedAt null for an unparsable date', () => {
        const feed = parsePodcastFeed(
            rssFeed(`
                <item>
                    <title>Undated</title>
                    <pubDate>whenever</pubDate>
                    <enclosure url="https://cdn.example/5.mp3" type="audio/mpeg"/>
                </item>`),
            CONTEXT
        );

        expect(feed.episodes[0].publishedAt).toBeNull();
    });

    it('parses Atom entries with enclosure links', () => {
        const feed = parsePodcastFeed(
            `<?xml version="1.0" encoding="UTF-8"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
                <title>Atom Cast</title>
                <link rel="alternate" href="https://atom.example"/>
                <entry>
                    <title>Atom One</title>
                    <id>atom-1</id>
                    <published>2025-01-02T10:00:00Z</published>
                    <link rel="enclosure" type="audio/mpeg" href="https://cdn.example/a1.mp3"/>
                </entry>
            </feed>`,
            CONTEXT
        );

        expect(feed.title).toBe('Atom Cast');
        expect(feed.websiteUrl).toBe('https://atom.example');
        expect(feed.episodes).toHaveLength(1);
        expect(feed.episodes[0].audioUrl).toBe('https://cdn.example/a1.mp3');
        expect(feed.episodes[0].publishedAt).toBe('2025-01-02T10:00:00.000Z');
    });

    it('falls back to the channel image element when itunes:image is absent', () => {
        const xml = `<?xml version="1.0"?>
            <rss version="2.0">
                <channel>
                    <title>Plain</title>
                    <image><url>https://cdn.example/plain.png</url></image>
                </channel>
            </rss>`;

        expect(parsePodcastFeed(xml, CONTEXT).artwork).toBe(
            'https://cdn.example/plain.png'
        );
    });

    it('falls back to the caller-supplied title and artwork for a bare feed', () => {
        const feed = parsePodcastFeed(
            '<?xml version="1.0"?><rss version="2.0"><channel/></rss>',
            CONTEXT
        );

        expect(feed.title).toBe('Fallback Show');
        expect(feed.artwork).toBe('https://cdn.example/fallback.jpg');
    });

    it('throws when the document is not XML', () => {
        expect(() => parsePodcastFeed('<<<not xml', CONTEXT)).toThrow(
            'Podcast feed is not valid XML'
        );
    });
});
