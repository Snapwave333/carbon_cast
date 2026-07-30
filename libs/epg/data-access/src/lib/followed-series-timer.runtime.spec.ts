import { FollowedSeriesPersistedState } from '@iptvnator/shared/interfaces';
import { FollowedSeriesTimerRuntime } from './followed-series-timer.runtime';
import { createEmptyFollowedSeriesState } from './followed-series-storage.service';

describe('FollowedSeriesTimerRuntime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-01T09:59:50Z'));
    });

    afterEach(() => jest.useRealTimers());

    it('shows a countdown, refreshes before switching, and dispatches on time', async () => {
        let state = scheduledState();
        const refresh = jest.fn().mockImplementation(async () => {
            state = {
                ...state,
                refreshStatus: { ...state.refreshStatus, state: 'success' },
            };
        });
        const runtime = new FollowedSeriesTimerRuntime({
            snapshot: () => state,
            patch: (patch) => (state = { ...state, ...patch }),
            refresh,
        });
        const requests: string[] = [];
        runtime.switchRequests$.subscribe((request) =>
            requests.push(request.broadcast.id)
        );

        runtime.start();
        jest.advanceTimersByTime(5_000);
        await Promise.resolve();

        expect(runtime.countdown()).toEqual(
            expect.objectContaining({
                seriesTitle: 'The Show',
                episodeTitle: 'Pilot',
                channelName: 'Channel 1',
            })
        );
        expect(refresh).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(5_000);
        expect(requests).toEqual(['broadcast-primary']);
        runtime.stop();
    });

    it('retries exactly one mapped alternative after a switch failure', async () => {
        let state = scheduledState(true);
        const refresh = jest.fn().mockImplementation(async () => {
            state = {
                ...state,
                refreshStatus: { ...state.refreshStatus, state: 'success' },
            };
        });
        const runtime = new FollowedSeriesTimerRuntime({
            snapshot: () => state,
            patch: (patch) => (state = { ...state, ...patch }),
            refresh,
        });
        const requests: string[] = [];
        runtime.switchRequests$.subscribe((request) =>
            requests.push(request.broadcast.id)
        );

        await runtime.switchNow('schedule-primary');
        runtime.reportSwitchFailure('schedule-primary', 'offline');

        expect(requests).toEqual([
            'broadcast-primary',
            'broadcast-alternative',
        ]);
        expect(state.schedules[0].broadcastId).toBe('broadcast-alternative');
    });

    it('records a user cancellation and removes the airing from the heap', () => {
        let state = scheduledState();
        const runtime = new FollowedSeriesTimerRuntime({
            snapshot: () => state,
            patch: (patch) => (state = { ...state, ...patch }),
            refresh: jest.fn().mockResolvedValue(undefined),
        });

        runtime.cancel('schedule-primary');

        expect(state.schedules[0].status).toBe('off');
        expect(state.history.at(-1)).toEqual(
            expect.objectContaining({
                scheduleId: 'schedule-primary',
                outcome: 'canceled',
            })
        );
    });

    it('does not switch from stale guide data when preflight refresh is unavailable', async () => {
        let state = scheduledState();
        const runtime = new FollowedSeriesTimerRuntime({
            snapshot: () => state,
            patch: (patch) => (state = { ...state, ...patch }),
            refresh: jest.fn().mockResolvedValue(undefined),
        });
        const request = jest.fn();
        runtime.switchRequests$.subscribe(request);

        await runtime.switchNow('schedule-primary');

        expect(request).not.toHaveBeenCalled();
        expect(state.schedules[0].status).toBe('broadcast-unavailable');
    });

    it('opens a channel manually without requiring a fresh EPG preflight', async () => {
        let state = scheduledState();
        const refresh = jest.fn().mockResolvedValue(undefined);
        const runtime = new FollowedSeriesTimerRuntime({
            snapshot: () => state,
            patch: (patch) => (state = { ...state, ...patch }),
            refresh,
        });
        const request = jest.fn();
        runtime.switchRequests$.subscribe(request);

        await runtime.switchNow('schedule-primary', false);

        expect(request).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
        expect(state.schedules[0].status).toBe('enabled');
    });
});

function scheduledState(withAlternative = false): FollowedSeriesPersistedState {
    const state = createEmptyFollowedSeriesState();
    state.followedSeries = [
        {
            id: 'series-1',
            source: 'epg',
            title: 'The Show',
            normalizedTitle: 'the show',
            aliases: ['The Show'],
            priority: 0,
            autoSwitchDefault: true,
            followedAt: '2026-01-01T00:00:00Z',
        },
    ];
    state.episodes = [
        {
            id: 'episode-1',
            seriesId: 'series-1',
            title: 'Pilot',
            normalizedTitle: 'pilot',
            description: null,
            seasonNumber: 1,
            episodeNumber: 1,
            newness: 'new',
            broadcastIds: withAlternative
                ? ['broadcast-primary', 'broadcast-alternative']
                : ['broadcast-primary'],
        },
    ];
    state.broadcasts = [
        makeBroadcast(
            'broadcast-primary',
            withAlternative ? ['broadcast-alternative'] : []
        ),
        ...(withAlternative
            ? [makeBroadcast('broadcast-alternative', ['broadcast-primary'])]
            : []),
    ];
    state.schedules = [
        {
            id: 'schedule-primary',
            broadcastId: 'broadcast-primary',
            episodeId: 'episode-1',
            seriesId: 'series-1',
            enabledAt: '2026-01-01T00:00:00Z',
            scheduledSwitchAt: '2026-08-01T10:00:00Z',
            status: 'enabled',
            conflictGroupId: null,
        },
    ];
    return state;
}

function makeBroadcast(id: string, alternativeBroadcastIds: string[]) {
    return {
        id,
        episodeId: 'episode-1',
        seriesId: 'series-1',
        epgChannelId: id,
        channelMappingId: `mapping-${id}`,
        playlistId: 'playlist-1',
        channelId: id,
        channelName: 'Channel 1',
        channelNumber: 1,
        channelLogo: null,
        channelGroup: null,
        startAt: '2026-08-01T10:00:05Z',
        endAt: '2026-08-01T10:30:00Z',
        availability: 'scheduled' as const,
        alternativeBroadcastIds,
        revision: id,
    };
}
