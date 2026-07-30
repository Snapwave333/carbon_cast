import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
} from '@iptvnator/shared/interfaces';
import {
    AutoSwitchPriorityQueue,
    buildAutoSwitchConflicts,
    selectConflictWinner,
} from './followed-series-scheduler.util';

const schedules: AutoSwitchSchedule[] = [
    schedule('switch-low', 'series-low', 'broadcast-low', 'episode-low', 2),
    schedule('switch-high', 'series-high', 'broadcast-high', 'episode-high', 1),
];
const broadcasts: BroadcastInstance[] = [
    broadcast('broadcast-low', 'episode-low', 'series-low'),
    broadcast('broadcast-high', 'episode-high', 'series-high'),
];
const episodes: FollowedEpisode[] = [
    episode('episode-low', 'series-low', 'repeat'),
    episode('episode-high', 'series-high', 'new'),
];
const series: FollowedSeries[] = [
    followed('series-low', 1),
    followed('series-high', 10),
];

describe('followed series scheduler', () => {
    it('uses a min-heap ordered by switch time and enable time', () => {
        const queue = new AutoSwitchPriorityQueue();
        queue.rebuild([
            { ...schedules[0], scheduledSwitchAt: '2026-08-01T10:00:10Z' },
            { ...schedules[1], scheduledSwitchAt: '2026-08-01T10:00:00Z' },
        ]);

        expect(queue.pop()?.schedule.id).toBe('switch-high');
        expect(queue.pop()?.schedule.id).toBe('switch-low');
    });

    it('groups overlapping switches and waits for a prompt choice', () => {
        const conflict = buildAutoSwitchConflicts(schedules)[0];

        expect(conflict.scheduleIds).toEqual(['switch-low', 'switch-high']);
        expect(
            selectConflictWinner(
                conflict,
                schedules,
                broadcasts,
                episodes,
                series,
                'prompt'
            )
        ).toBeUndefined();
    });

    it('uses series priority and newness for deterministic resolution', () => {
        const conflict = buildAutoSwitchConflicts(schedules)[0];

        expect(
            selectConflictWinner(
                conflict,
                schedules,
                broadcasts,
                episodes,
                series,
                'priority'
            )?.id
        ).toBe('switch-high');
    });
});

function schedule(
    id: string,
    seriesId: string,
    broadcastId: string,
    episodeId: string,
    enabledSecond: number
): AutoSwitchSchedule {
    return {
        id,
        seriesId,
        broadcastId,
        episodeId,
        enabledAt: `2026-01-01T00:00:0${enabledSecond}Z`,
        scheduledSwitchAt: '2026-08-01T10:00:00Z',
        status: 'enabled',
        conflictGroupId: null,
    };
}

function broadcast(
    id: string,
    episodeId: string,
    seriesId: string
): BroadcastInstance {
    return {
        id,
        episodeId,
        seriesId,
        epgChannelId: id,
        channelMappingId: id,
        playlistId: 'playlist',
        channelId: id,
        channelName: id,
        channelNumber: null,
        channelLogo: null,
        channelGroup: null,
        startAt: '2026-08-01T10:00:05Z',
        endAt: '2026-08-01T10:30:00Z',
        availability: 'scheduled',
        alternativeBroadcastIds: [],
        revision: id,
    };
}

function episode(
    id: string,
    seriesId: string,
    newness: FollowedEpisode['newness']
): FollowedEpisode {
    return {
        id,
        seriesId,
        title: id,
        normalizedTitle: id,
        description: null,
        seasonNumber: 1,
        episodeNumber: 1,
        newness,
        broadcastIds: [],
    };
}

function followed(id: string, priority: number): FollowedSeries {
    return {
        id,
        source: 'epg',
        title: id,
        normalizedTitle: id,
        aliases: [id],
        priority,
        autoSwitchDefault: false,
        followedAt: '2026-01-01T00:00:00Z',
    };
}
