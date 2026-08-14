import { computed, Injectable, signal } from '@angular/core';
import {
    PodcastShow,
    RadioStation,
    RadioTrack,
} from './radio.types';

/**
 * The user's own radio state: favourited stations, subscribed shows, recent
 * plays and episode resume points.
 *
 * It is deliberately kept in `localStorage` rather than the app database: it
 * is small, it must work identically in the PWA (where the SQLite bridge is
 * absent) and in Electron, and it needs no migration to ship.
 */

const STORAGE_KEY = 'carboncast.radio.library.v1';
const MAX_RECENT_TRACKS = 40;
const MAX_TRACKED_EPISODES = 300;
/** Below this the listener has barely started; above it the episode is done. */
const RESUME_MIN_SECONDS = 30;
const RESUME_COMPLETE_RATIO = 0.97;

export interface EpisodeProgress {
    positionSeconds: number;
    durationSeconds: number | null;
    updatedAt: number;
}

interface RadioLibraryState {
    favoriteStations: RadioStation[];
    subscribedShows: PodcastShow[];
    recentTracks: RadioTrack[];
    episodeProgress: Record<string, EpisodeProgress>;
}

const EMPTY_STATE: RadioLibraryState = {
    favoriteStations: [],
    subscribedShows: [],
    recentTracks: [],
    episodeProgress: {},
};

function readState(): RadioLibraryState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return EMPTY_STATE;
        }

        const parsed = JSON.parse(raw) as Partial<RadioLibraryState>;
        return {
            favoriteStations: Array.isArray(parsed.favoriteStations)
                ? parsed.favoriteStations
                : [],
            subscribedShows: Array.isArray(parsed.subscribedShows)
                ? parsed.subscribedShows
                : [],
            recentTracks: Array.isArray(parsed.recentTracks)
                ? parsed.recentTracks
                : [],
            episodeProgress:
                parsed.episodeProgress && typeof parsed.episodeProgress === 'object'
                    ? parsed.episodeProgress
                    : {},
        };
    } catch {
        return EMPTY_STATE;
    }
}

@Injectable({ providedIn: 'root' })
export class RadioLibraryStore {
    private readonly state = signal<RadioLibraryState>(readState());

    readonly favoriteStations = computed(() => this.state().favoriteStations);
    readonly subscribedShows = computed(() => this.state().subscribedShows);
    readonly recentTracks = computed(() => this.state().recentTracks);

    private readonly favoriteStationIds = computed(
        () => new Set(this.state().favoriteStations.map((station) => station.id))
    );
    private readonly subscribedShowIds = computed(
        () => new Set(this.state().subscribedShows.map((show) => show.id))
    );

    isFavoriteStation(stationId: string): boolean {
        return this.favoriteStationIds().has(stationId);
    }

    isSubscribed(showId: string): boolean {
        return this.subscribedShowIds().has(showId);
    }

    toggleFavoriteStation(station: RadioStation): boolean {
        const isFavorite = this.isFavoriteStation(station.id);
        this.patch((state) => ({
            ...state,
            favoriteStations: isFavorite
                ? state.favoriteStations.filter(
                      (entry) => entry.id !== station.id
                  )
                : [station, ...state.favoriteStations],
        }));
        return !isFavorite;
    }

    toggleSubscription(show: PodcastShow): boolean {
        const isSubscribed = this.isSubscribed(show.id);
        this.patch((state) => ({
            ...state,
            subscribedShows: isSubscribed
                ? state.subscribedShows.filter((entry) => entry.id !== show.id)
                : [show, ...state.subscribedShows],
        }));
        return !isSubscribed;
    }

    rememberPlayed(track: RadioTrack): void {
        this.patch((state) => ({
            ...state,
            recentTracks: [
                track,
                ...state.recentTracks.filter(
                    (entry) => !(entry.id === track.id && entry.kind === track.kind)
                ),
            ].slice(0, MAX_RECENT_TRACKS),
        }));
    }

    clearRecent(): void {
        this.patch((state) => ({ ...state, recentTracks: [] }));
    }

    episodeProgress(episodeId: string): EpisodeProgress | null {
        return this.state().episodeProgress[episodeId] ?? null;
    }

    /**
     * Stores a resume point. Positions near either end of the episode are
     * dropped instead of stored, so "resume" never means "restart" or
     * "replay the closing seconds".
     */
    saveEpisodeProgress(
        episodeId: string,
        positionSeconds: number,
        durationSeconds: number | null
    ): void {
        const isNearStart = positionSeconds < RESUME_MIN_SECONDS;
        const isFinished =
            durationSeconds !== null &&
            durationSeconds > 0 &&
            positionSeconds / durationSeconds >= RESUME_COMPLETE_RATIO;

        if (isNearStart || isFinished) {
            if (this.state().episodeProgress[episodeId]) {
                this.patch((state) => {
                    const remaining = { ...state.episodeProgress };
                    delete remaining[episodeId];
                    return { ...state, episodeProgress: remaining };
                });
            }
            return;
        }

        this.patch((state) => ({
            ...state,
            episodeProgress: pruneProgress({
                ...state.episodeProgress,
                [episodeId]: {
                    positionSeconds: Math.round(positionSeconds),
                    durationSeconds,
                    updatedAt: Date.now(),
                },
            }),
        }));
    }

    private patch(
        update: (state: RadioLibraryState) => RadioLibraryState
    ): void {
        const next = update(this.state());
        this.state.set(next);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // A full or unavailable quota must not break playback; the library
            // simply stays in memory for the rest of the session.
        }
    }
}

function pruneProgress(
    progress: Record<string, EpisodeProgress>
): Record<string, EpisodeProgress> {
    const entries = Object.entries(progress);
    if (entries.length <= MAX_TRACKED_EPISODES) {
        return progress;
    }

    const kept: Record<string, EpisodeProgress> = {};
    for (const [episodeId, entry] of entries
        .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_TRACKED_EPISODES)) {
        kept[episodeId] = entry;
    }
    return kept;
}
