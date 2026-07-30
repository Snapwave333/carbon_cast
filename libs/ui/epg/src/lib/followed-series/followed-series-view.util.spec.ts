import { FollowedSeriesPersistedState } from '@iptvnator/shared/interfaces';
import { buildFollowedSeriesView } from './followed-series-view.util';

describe('buildFollowedSeriesView', () => {
    it('groups episodes under series, removes ended airings, and sorts by next broadcast', () => {
        const state = makeState();

        const result = buildFollowedSeriesView(
            state,
            new Date('2026-08-01T09:00:00Z')
        );

        expect(result.map((item) => item.series.id)).toEqual([
            'series-next',
            'series-later',
        ]);
        expect(result[0].episodes[0].broadcasts).toHaveLength(1);
        expect(result[0].episodes[0].broadcasts[0].schedule?.id).toBe(
            'schedule-next'
        );
    });
});

function makeState(): FollowedSeriesPersistedState {
    const followedAt = '2026-01-01T00:00:00Z';
    return {
        version: 1,
        followedSeries: [
            {
                id: 'series-later',
                source: 'epg',
                title: 'Later',
                normalizedTitle: 'later',
                aliases: ['Later'],
                priority: 0,
                autoSwitchDefault: false,
                followedAt,
            },
            {
                id: 'series-next',
                source: 'epg',
                title: 'Next',
                normalizedTitle: 'next',
                aliases: ['Next'],
                priority: 0,
                autoSwitchDefault: false,
                followedAt,
            },
        ],
        episodes: [
            episode('episode-later', 'series-later', ['broadcast-later']),
            episode('episode-next', 'series-next', [
                'broadcast-ended',
                'broadcast-next',
            ]),
        ],
        broadcasts: [
            broadcast(
                'broadcast-later',
                'episode-later',
                'series-later',
                '2026-08-02T10:00:00Z'
            ),
            broadcast(
                'broadcast-ended',
                'episode-next',
                'series-next',
                '2026-08-01T07:00:00Z'
            ),
            broadcast(
                'broadcast-next',
                'episode-next',
                'series-next',
                '2026-08-01T10:00:00Z'
            ),
        ],
        schedules: [
            {
                id: 'schedule-next',
                broadcastId: 'broadcast-next',
                episodeId: 'episode-next',
                seriesId: 'series-next',
                enabledAt: followedAt,
                scheduledSwitchAt: '2026-08-01T09:59:55Z',
                status: 'enabled',
                conflictGroupId: null,
            },
        ],
        conflicts: [],
        preferences: {
            defaultAutoSwitch: false,
            notifications: {
                enabled: true,
                timing: 'countdown-only',
                newEpisode: true,
                scheduleChanges: true,
                failures: true,
            },
            includeReruns: true,
            onlyNewEpisodes: false,
            preferredChannelIds: [],
            preferredVideoQuality: '',
            preferredLanguage: '',
            conflictBehavior: 'prompt',
            switchLeadSeconds: 5,
            switchCountdownSeconds: 5,
            returnToPreviousChannel: false,
            playNextScheduledEpisode: false,
            disableWhileRecording: true,
            disableWhileCasting: true,
        },
        history: [],
        refreshStatus: {
            state: 'idle',
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastError: null,
            candidateCount: 0,
        },
    };
}

function episode(id: string, seriesId: string, broadcastIds: string[]) {
    return {
        id,
        seriesId,
        title: id,
        normalizedTitle: id,
        description: null,
        seasonNumber: 1,
        episodeNumber: 1,
        newness: 'new' as const,
        broadcastIds,
    };
}

function broadcast(
    id: string,
    episodeId: string,
    seriesId: string,
    startAt: string
) {
    return {
        id,
        episodeId,
        seriesId,
        epgChannelId: 'channel',
        channelMappingId: 'mapping',
        playlistId: 'playlist',
        channelId: 'channel',
        channelName: 'Channel',
        channelNumber: 1,
        channelLogo: null,
        channelGroup: null,
        startAt,
        endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(),
        availability: 'scheduled' as const,
        alternativeBroadcastIds: [],
        revision: id,
    };
}
