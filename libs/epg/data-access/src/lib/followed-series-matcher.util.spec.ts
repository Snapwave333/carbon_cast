import {
    FollowedSeriesChannelMapping,
    FollowedSeriesProgramCandidate,
} from '@iptvnator/shared/interfaces';
import {
    createFollowedSeries,
    matchesFollowedSeriesCandidate,
} from './followed-series-identity.util';
import { matchFollowedSeriesPrograms } from './followed-series-matcher.util';
import { DEFAULT_FOLLOWED_SERIES_PREFERENCES } from './followed-series-storage.service';

const mappings: FollowedSeriesChannelMapping[] = [
    {
        id: 'mapping-hd',
        playlistId: 'playlist-1',
        channelId: 'channel-hd',
        epgChannelIds: ['office.us'],
        name: 'US 1080p Comedy',
        normalizedName: 'us 1080p comedy',
        number: 42,
        logo: null,
        group: 'English',
        preferred: false,
    },
];

function candidate(
    start: string,
    overrides: Partial<FollowedSeriesProgramCandidate> = {}
): FollowedSeriesProgramCandidate {
    return {
        start,
        stop: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
        channel: 'office.us',
        title: 'The Office',
        seriesTitle: 'The Office',
        episodeTitle: 'Diversity Day',
        episodeNum: '0.1.0/1',
        programId: 'episode-2',
        desc: 'Michael stages a diversity exercise.',
        category: 'Comedy',
        isNew: true,
        ...overrides,
    };
}

describe('matchFollowedSeriesPrograms', () => {
    const series = createFollowedSeries(
        { source: 'xtream', title: 'The Office (2005)', sourceSeriesId: 20 },
        new Date('2026-01-01T00:00:00Z')
    );

    it('groups duplicate metadata and alternative airings into one episode', () => {
        const result = matchFollowedSeriesPrograms(
            [series],
            [
                candidate('2026-11-01T07:30:00Z'),
                candidate('2026-11-01T07:30:00Z'),
                candidate('2026-11-01T08:30:00Z'),
            ],
            mappings,
            {
                ...DEFAULT_FOLLOWED_SERIES_PREFERENCES,
                preferredLanguage: 'English',
                preferredVideoQuality: '1080p',
            },
            new Date('2026-10-31T00:00:00Z')
        );

        expect(result.episodes).toHaveLength(1);
        expect(result.broadcasts).toHaveLength(2);
        expect(result.episodes[0].broadcastIds).toHaveLength(2);
        expect(result.broadcasts[0]).toEqual(
            expect.objectContaining({
                channelMappingId: 'mapping-hd',
                channelName: 'US 1080p Comedy',
            })
        );
        expect(result.broadcasts[0].alternativeBroadcastIds).toEqual([
            result.broadcasts[1].id,
        ]);
    });

    it('honors new-only and rerun filtering', () => {
        const result = matchFollowedSeriesPrograms(
            [series],
            [
                candidate('2026-08-01T10:00:00Z', {
                    programId: 'repeat',
                    isNew: false,
                    previouslyShown: true,
                }),
            ],
            mappings,
            {
                ...DEFAULT_FOLLOWED_SERIES_PREFERENCES,
                onlyNewEpisodes: true,
            },
            new Date('2026-07-31T00:00:00Z')
        );

        expect(result.episodes).toEqual([]);
        expect(result.broadcasts).toEqual([]);
    });

    it('does not treat a single-word title as every longer title sharing its prefix', () => {
        const office = createFollowedSeries({ source: 'epg', title: 'Office' });

        expect(
            matchesFollowedSeriesCandidate(office, {
                ...candidate('2026-08-01T10:00:00Z'),
                title: 'Office Hours',
                seriesTitle: 'Office Hours',
            })
        ).toBe(false);
    });
});
