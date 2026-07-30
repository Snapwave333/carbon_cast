import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
} from '@iptvnator/shared/interfaces';
import { reconcileFollowedSeriesSchedule } from './followed-series-reconciliation.util';
import { DEFAULT_FOLLOWED_SERIES_PREFERENCES } from './followed-series-storage.service';

describe('reconcileFollowedSeriesSchedule', () => {
    const series: FollowedSeries = {
        id: 'series-1',
        source: 'epg',
        title: 'Show',
        normalizedTitle: 'show',
        aliases: ['Show'],
        priority: 0,
        autoSwitchDefault: false,
        followedAt: '2026-01-01T00:00:00Z',
    };
    const episode: FollowedEpisode = {
        id: 'episode-1',
        seriesId: series.id,
        title: 'Pilot',
        normalizedTitle: 'pilot',
        description: null,
        seasonNumber: 1,
        episodeNumber: 1,
        newness: 'new',
        broadcastIds: ['broadcast-old'],
    };
    const oldBroadcast = makeBroadcast('broadcast-old', '2026-08-01T10:00:00Z');
    const oldSchedule: AutoSwitchSchedule = {
        id: 'switch-1',
        broadcastId: oldBroadcast.id,
        episodeId: episode.id,
        seriesId: series.id,
        enabledAt: '2026-01-01T00:00:00Z',
        scheduledSwitchAt: '2026-08-01T09:59:55Z',
        status: 'enabled',
        conflictGroupId: null,
    };

    it('moves an enabled schedule when the EPG airing changes', () => {
        const replacement = makeBroadcast(
            'broadcast-new',
            '2026-08-01T10:15:00Z'
        );
        const result = reconcileFollowedSeriesSchedule({
            previousEpisodes: [episode],
            previousBroadcasts: [oldBroadcast],
            previousSchedules: [oldSchedule],
            nextEpisodes: [{ ...episode, broadcastIds: [replacement.id] }],
            nextBroadcasts: [replacement],
            series: [series],
            preferences: DEFAULT_FOLLOWED_SERIES_PREFERENCES,
            now: new Date('2026-07-31T00:00:00Z'),
        });

        expect(result.schedules[0]).toEqual(
            expect.objectContaining({
                id: 'switch-1',
                broadcastId: 'broadcast-new',
                scheduledSwitchAt: '2026-08-01T10:14:55.000Z',
                status: 'schedule-changed',
            })
        );
        expect(result.changedScheduleIds).toEqual(['switch-1']);
    });

    it('retains a missing future broadcast as canceled and unavailable', () => {
        const result = reconcileFollowedSeriesSchedule({
            previousEpisodes: [episode],
            previousBroadcasts: [oldBroadcast],
            previousSchedules: [oldSchedule],
            nextEpisodes: [],
            nextBroadcasts: [],
            series: [series],
            preferences: DEFAULT_FOLLOWED_SERIES_PREFERENCES,
            now: new Date('2026-07-31T00:00:00Z'),
        });

        expect(result.broadcasts[0].availability).toBe('canceled');
        expect(result.schedules[0].status).toBe('broadcast-unavailable');
        expect(result.canceledScheduleIds).toEqual(['switch-1']);
    });
});

function makeBroadcast(id: string, startAt: string): BroadcastInstance {
    return {
        id,
        episodeId: 'episode-1',
        seriesId: 'series-1',
        epgChannelId: 'channel-1',
        channelMappingId: 'mapping-1',
        playlistId: 'playlist-1',
        channelId: 'channel-1',
        channelName: 'Channel 1',
        channelNumber: 1,
        channelLogo: null,
        channelGroup: null,
        startAt,
        endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(),
        availability: 'scheduled',
        alternativeBroadcastIds: [],
        revision: id,
    };
}
