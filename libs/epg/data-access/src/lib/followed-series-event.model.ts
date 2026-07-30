export type FollowedSeriesEventKind =
    | 'broadcast-canceled'
    | 'new-episode'
    | 'schedule-changed'
    | 'starting-soon'
    | 'switch-failed'
    | 'switched';

export interface FollowedSeriesEvent {
    kind: FollowedSeriesEventKind;
    title: string;
    body: string;
    seriesId?: string;
    episodeId?: string;
    broadcastId?: string;
}
