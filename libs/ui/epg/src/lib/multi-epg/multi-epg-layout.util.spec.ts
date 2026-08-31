import {
    buildProgramAriaLabel,
    getEpgChannelIcon,
    layoutEpgChannelsForDay,
} from './multi-epg-layout.util';

const channel = {
    id: 'channel-1',
    displayName: 'Channel One',
    iconUrl: null,
    programs: [],
};

function program(title: string, start: string, stop: string) {
    return {
        title,
        start,
        stop,
        channel: 'channel-1',
        desc: null,
        category: null,
    };
}

describe('layoutEpgChannelsForDay', () => {
    it('omits source-only rows when the host marks them unavailable', () => {
        const rows = layoutEpgChannelsForDay(
            [
                { ...channel, id: 'playable' },
                { ...channel, id: 'source-only' },
            ],
            '20260812',
            120,
            new Map(),
            (item) => item.id === 'playable'
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe('playable');
    });

    it('keeps and clips programmes that cross into the selected day', () => {
        const [laidOut] = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    programs: [
                        program(
                            'Late movie',
                            '2026-08-11T23:30:00',
                            '2026-08-12T00:30:00'
                        ),
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(laidOut.programs).toHaveLength(1);
        expect(laidOut.programs[0]).toMatchObject({
            startPosition: 0,
            width: 60,
        });
    });

    it('clips programmes that continue beyond the selected day', () => {
        const [laidOut] = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    programs: [
                        program(
                            'Midnight special',
                            '2026-08-12T23:30:00',
                            '2026-08-13T00:30:00'
                        ),
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(laidOut.programs[0]).toMatchObject({
            startPosition: 2820,
            width: 60,
        });
    });

    it('drops invalid and non-overlapping programmes', () => {
        const [laidOut] = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    programs: [
                        program(
                            'Yesterday',
                            '2026-08-11T10:00:00',
                            '2026-08-11T11:00:00'
                        ),
                        program('Broken', 'invalid', 'also-invalid'),
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(laidOut.programs).toEqual([]);
    });

    it('groups guide rows by programme category before channel name', () => {
        const channels = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    id: 'news-z',
                    displayName: 'Zulu News',
                    programs: [
                        {
                            ...program(
                                'News hour',
                                '2026-08-12T09:00:00',
                                '2026-08-12T10:00:00'
                            ),
                            category: 'News',
                        },
                    ],
                },
                {
                    ...channel,
                    id: 'movie-a',
                    displayName: 'Alpha Movies',
                    programs: [
                        {
                            ...program(
                                'Film',
                                '2026-08-12T09:00:00',
                                '2026-08-12T10:00:00'
                            ),
                            category: 'Movies',
                        },
                    ],
                },
                {
                    ...channel,
                    id: 'movie-b',
                    displayName: 'Bravo Movies',
                    programs: [
                        {
                            ...program(
                                'Film',
                                '2026-08-12T09:00:00',
                                '2026-08-12T10:00:00'
                            ),
                            category: 'Movies',
                        },
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(channels.map((item) => item.id)).toEqual([
            'movie-a',
            'movie-b',
            'news-z',
        ]);
    });

    it('builds an accessible programme label with its original times', () => {
        const [laidOut] = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    programs: [
                        program(
                            'News',
                            '2026-08-12T09:00:00',
                            '2026-08-12T09:30:00'
                        ),
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(buildProgramAriaLabel(laidOut.programs[0])).toContain('News');
        expect(buildProgramAriaLabel(laidOut.programs[0])).toContain('–');
    });

    it('pre-formats a time label from the original (unclipped) times', () => {
        const [laidOut] = layoutEpgChannelsForDay(
            [
                {
                    ...channel,
                    programs: [
                        program(
                            'Late movie',
                            '2026-08-11T23:30:00',
                            '2026-08-12T00:30:00'
                        ),
                    ],
                },
            ],
            '20260812',
            120
        );

        expect(laidOut.programs[0].timeLabel).toBe('23:30 – 00:30');
    });
});

describe('layout channel icon precompute', () => {
    it('sanitizes the channel icon once into safeIconUrl', () => {
        const [safe] = layoutEpgChannelsForDay(
            [{ ...channel, iconUrl: 'https://x/logo.png' }],
            '20260812',
            120
        );
        expect(safe.safeIconUrl).toBe('https://x/logo.png');

        const [unsafe] = layoutEpgChannelsForDay(
            [{ ...channel, iconUrl: 'javascript:alert(1)' }],
            '20260812',
            120
        );
        expect(unsafe.safeIconUrl).toBe('');
    });
});

describe('getEpgChannelIcon', () => {
    it('returns http(s) icons from either channel shape', () => {
        expect(
            getEpgChannelIcon({ ...channel, iconUrl: 'https://x/logo.png' })
        ).toBe('https://x/logo.png');
        expect(
            getEpgChannelIcon({
                id: 'c1',
                displayName: [{ lang: 'en', value: 'One' }],
                icon: [{ src: 'http://x/logo.png' }],
                url: [],
            })
        ).toBe('http://x/logo.png');
    });

    it('drops non-http(s) icon URLs from untrusted XMLTV feeds', () => {
        expect(
            getEpgChannelIcon({ ...channel, iconUrl: 'javascript:alert(1)' })
        ).toBe('');
        expect(getEpgChannelIcon({ ...channel, iconUrl: null })).toBe('');
    });
});
