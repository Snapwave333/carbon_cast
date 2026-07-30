import { EpgProgram } from './epg-program.model';

export type FollowedSeriesSource = 'epg' | 'stalker' | 'xtream';

export type EpisodeNewness = 'new' | 'repeat' | 'unknown';

export type BroadcastAvailability =
    | 'available'
    | 'canceled'
    | 'ended'
    | 'offline'
    | 'scheduled'
    | 'unavailable';

export type AutoSwitchStatus =
    | 'broadcast-unavailable'
    | 'currently-playing'
    | 'enabled'
    | 'ended'
    | 'off'
    | 'permission-required'
    | 'schedule-changed'
    | 'switching-soon';

export type FollowedSeriesConflictBehavior =
    'first-available' | 'priority' | 'prompt';

export type FollowedSeriesNotificationTiming =
    'countdown-only' | 'five-minutes' | 'one-minute' | 'ten-seconds';

export interface FollowedSeries {
    id: string;
    source: FollowedSeriesSource;
    sourceSeriesId?: string;
    sourcePlaylistId?: string;
    title: string;
    normalizedTitle: string;
    aliases: string[];
    artworkUrl?: string;
    priority: number;
    autoSwitchDefault: boolean;
    followedAt: string;
}

export interface FollowSeriesRequest {
    source: FollowedSeriesSource;
    sourceSeriesId?: string | number | null;
    sourcePlaylistId?: string | null;
    title: string;
    aliases?: string[];
    artworkUrl?: string | null;
    epgProgram?: EpgProgram | null;
}

export interface FollowedEpisode {
    id: string;
    seriesId: string;
    programId?: string;
    title: string;
    normalizedTitle: string;
    description: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    newness: EpisodeNewness;
    broadcastIds: string[];
}

export interface FollowedSeriesChannelMapping {
    id: string;
    playlistId: string;
    channelId: string;
    epgChannelIds: string[];
    name: string;
    normalizedName: string;
    number: number | null;
    logo: string | null;
    group: string | null;
    preferred: boolean;
}

export interface FollowedSeriesProgramCandidate extends EpgProgram {
    databaseId?: number;
    programId?: string | null;
    seriesId?: string | null;
    seriesTitle?: string | null;
    episodeTitle?: string | null;
    isNew?: boolean | null;
    previouslyShown?: boolean | null;
    channelName?: string | null;
    channelLogo?: string | null;
    sourceUrl?: string | null;
}

export interface FollowedSeriesProgramQuery {
    from: string;
    to: string;
    titleHints: string[];
    limit?: number;
}

export interface BroadcastInstance {
    id: string;
    episodeId: string;
    seriesId: string;
    epgChannelId: string;
    channelMappingId: string | null;
    playlistId: string | null;
    channelId: string | null;
    channelName: string;
    channelNumber: number | null;
    channelLogo: string | null;
    channelGroup: string | null;
    startAt: string;
    endAt: string;
    availability: BroadcastAvailability;
    alternativeBroadcastIds: string[];
    sourceProgramId?: string;
    sourceSeriesId?: string;
    revision: string;
}

export interface AutoSwitchSchedule {
    id: string;
    broadcastId: string;
    episodeId: string;
    seriesId: string;
    enabledAt: string;
    scheduledSwitchAt: string;
    status: AutoSwitchStatus;
    conflictGroupId: string | null;
    lastError?: string;
}

export interface FollowedSeriesConflictGroup {
    id: string;
    scheduledSwitchAt: string;
    scheduleIds: string[];
    selectedScheduleId: string | null;
    resolvedAt: string | null;
}

export interface FollowedSeriesNotificationPreferences {
    enabled: boolean;
    timing: FollowedSeriesNotificationTiming;
    newEpisode: boolean;
    scheduleChanges: boolean;
    failures: boolean;
}

export interface FollowedSeriesPreferences {
    defaultAutoSwitch: boolean;
    notifications: FollowedSeriesNotificationPreferences;
    includeReruns: boolean;
    onlyNewEpisodes: boolean;
    preferredChannelIds: string[];
    preferredVideoQuality: string;
    preferredLanguage: string;
    conflictBehavior: FollowedSeriesConflictBehavior;
    switchLeadSeconds: number;
    switchCountdownSeconds: number;
    returnToPreviousChannel: boolean;
    playNextScheduledEpisode: boolean;
    disableWhileRecording: boolean;
    disableWhileCasting: boolean;
}

export type FollowedSeriesPreferencesPatch = Partial<
    Omit<FollowedSeriesPreferences, 'notifications'>
> & {
    notifications?: Partial<FollowedSeriesNotificationPreferences>;
};

export interface FollowedSeriesSwitchHistoryEntry {
    id: string;
    scheduleId: string;
    broadcastId: string;
    attemptedAt: string;
    outcome: 'canceled' | 'failed' | 'switched';
    reason?: string;
}

export interface FollowedSeriesRefreshStatus {
    state: 'error' | 'idle' | 'offline' | 'refreshing' | 'success';
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    candidateCount: number;
}

export interface FollowedSeriesPersistedState {
    version: 1;
    followedSeries: FollowedSeries[];
    episodes: FollowedEpisode[];
    broadcasts: BroadcastInstance[];
    schedules: AutoSwitchSchedule[];
    conflicts: FollowedSeriesConflictGroup[];
    preferences: FollowedSeriesPreferences;
    history: FollowedSeriesSwitchHistoryEntry[];
    refreshStatus: FollowedSeriesRefreshStatus;
}

export interface FollowedSeriesCountdown {
    scheduleId: string;
    broadcastId: string;
    seriesTitle: string;
    episodeTitle: string;
    channelName: string;
    switchAt: string;
}

export interface FollowedSeriesSwitchRequest {
    schedule: AutoSwitchSchedule;
    broadcast: BroadcastInstance;
    episode: FollowedEpisode;
    series: FollowedSeries;
}
