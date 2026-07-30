import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
    FollowedSeriesPersistedState,
} from '@iptvnator/shared/interfaces';

export interface FollowedBroadcastView {
    broadcast: BroadcastInstance;
    schedule: AutoSwitchSchedule | null;
    isAlternative: boolean;
}

export interface FollowedEpisodeView {
    episode: FollowedEpisode;
    broadcasts: FollowedBroadcastView[];
    nextStartAt: string;
}

export interface FollowedSeriesView {
    series: FollowedSeries;
    episodes: FollowedEpisodeView[];
    nextStartAt: string;
}

export function buildFollowedSeriesView(
    state: FollowedSeriesPersistedState,
    now = new Date()
): FollowedSeriesView[] {
    const cutoff = now.getTime();
    const schedulesByBroadcast = new Map(
        state.schedules.map((schedule) => [schedule.broadcastId, schedule])
    );
    const broadcastsById = new Map(
        state.broadcasts.map((broadcast) => [broadcast.id, broadcast])
    );
    return state.followedSeries
        .map((series) => {
            const episodes = state.episodes
                .filter((episode) => episode.seriesId === series.id)
                .map((episode) => {
                    const broadcasts = episode.broadcastIds
                        .map((id) => broadcastsById.get(id))
                        .filter(
                            (broadcast): broadcast is BroadcastInstance =>
                                broadcast !== undefined &&
                                Date.parse(broadcast.endAt) >= cutoff
                        )
                        .sort(
                            (left, right) =>
                                Date.parse(left.startAt) -
                                    Date.parse(right.startAt) ||
                                left.channelName.localeCompare(
                                    right.channelName
                                )
                        )
                        .map((broadcast, index) => ({
                            broadcast,
                            schedule:
                                schedulesByBroadcast.get(broadcast.id) ?? null,
                            isAlternative: index > 0,
                        }));
                    return {
                        episode,
                        broadcasts,
                        nextStartAt:
                            broadcasts[0]?.broadcast.startAt ??
                            '9999-12-31T23:59:59.999Z',
                    };
                })
                .filter((episode) => episode.broadcasts.length > 0)
                .sort(
                    (left, right) =>
                        Date.parse(left.nextStartAt) -
                            Date.parse(right.nextStartAt) ||
                        compareEpisodeNumbers(left.episode, right.episode)
                );
            return {
                series,
                episodes,
                nextStartAt:
                    episodes[0]?.nextStartAt ?? '9999-12-31T23:59:59.999Z',
            };
        })
        .sort(
            (left, right) =>
                Date.parse(left.nextStartAt) - Date.parse(right.nextStartAt) ||
                right.series.priority - left.series.priority ||
                left.series.title.localeCompare(right.series.title)
        );
}

function compareEpisodeNumbers(
    left: FollowedEpisode,
    right: FollowedEpisode
): number {
    return (
        (left.seasonNumber ?? Number.MAX_SAFE_INTEGER) -
            (right.seasonNumber ?? Number.MAX_SAFE_INTEGER) ||
        (left.episodeNumber ?? Number.MAX_SAFE_INTEGER) -
            (right.episodeNumber ?? Number.MAX_SAFE_INTEGER)
    );
}
