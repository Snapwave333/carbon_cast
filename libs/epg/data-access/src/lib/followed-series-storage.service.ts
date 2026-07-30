import { Injectable } from '@angular/core';
import {
    FollowedSeriesPersistedState,
    FollowedSeriesPreferences,
    FollowedSeriesPreferencesPatch,
} from '@iptvnator/shared/interfaces';

const STORAGE_KEY = 'iptvnator:followed-series:v1';

export const DEFAULT_FOLLOWED_SERIES_PREFERENCES: FollowedSeriesPreferences = {
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
};

export function createEmptyFollowedSeriesState(): FollowedSeriesPersistedState {
    return {
        version: 1,
        followedSeries: [],
        episodes: [],
        broadcasts: [],
        schedules: [],
        conflicts: [],
        preferences: cloneDefaultPreferences(),
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

export function mergeFollowedSeriesPreferences(
    current: FollowedSeriesPreferences,
    patch: FollowedSeriesPreferencesPatch
): FollowedSeriesPreferences {
    const preferences = {
        ...current,
        ...patch,
        notifications: {
            ...current.notifications,
            ...(patch.notifications ?? {}),
        },
    };
    preferences.switchLeadSeconds = Number.isFinite(
        preferences.switchLeadSeconds
    )
        ? Math.min(300, Math.max(0, preferences.switchLeadSeconds))
        : 5;
    preferences.switchCountdownSeconds = Number.isFinite(
        preferences.switchCountdownSeconds
    )
        ? Math.min(300, Math.max(1, preferences.switchCountdownSeconds))
        : 5;
    return preferences;
}

@Injectable({ providedIn: 'root' })
export class FollowedSeriesStorageService {
    load(): FollowedSeriesPersistedState {
        const storage = this.storage;
        if (!storage) return createEmptyFollowedSeriesState();
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw) return createEmptyFollowedSeriesState();
            return normalizeState(JSON.parse(raw) as unknown);
        } catch {
            return createEmptyFollowedSeriesState();
        }
    }

    save(state: FollowedSeriesPersistedState): boolean {
        const storage = this.storage;
        if (!storage) return false;
        try {
            storage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    ...state,
                    history: state.history.slice(-200),
                })
            );
            return true;
        } catch {
            return false;
        }
    }

    clear(): void {
        try {
            this.storage?.removeItem(STORAGE_KEY);
        } catch {
            // Storage can be unavailable in privacy mode; in-memory state remains valid.
        }
    }

    private get storage(): Storage | null {
        try {
            return globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    }
}

function normalizeState(value: unknown): FollowedSeriesPersistedState {
    const empty = createEmptyFollowedSeriesState();
    if (!isRecord(value) || value['version'] !== 1) return empty;
    return {
        version: 1,
        followedSeries: Array.isArray(value['followedSeries'])
            ? value['followedSeries']
            : [],
        episodes: Array.isArray(value['episodes']) ? value['episodes'] : [],
        broadcasts: Array.isArray(value['broadcasts'])
            ? value['broadcasts']
            : [],
        schedules: Array.isArray(value['schedules']) ? value['schedules'] : [],
        conflicts: Array.isArray(value['conflicts']) ? value['conflicts'] : [],
        preferences: normalizePreferences(value['preferences']),
        history: Array.isArray(value['history']) ? value['history'] : [],
        refreshStatus: isRecord(value['refreshStatus'])
            ? {
                  ...empty.refreshStatus,
                  ...value['refreshStatus'],
              }
            : empty.refreshStatus,
    } as FollowedSeriesPersistedState;
}

function normalizePreferences(value: unknown): FollowedSeriesPreferences {
    const defaults = cloneDefaultPreferences();
    if (!isRecord(value)) return defaults;
    return {
        ...defaults,
        ...value,
        notifications: isRecord(value['notifications'])
            ? {
                  ...defaults.notifications,
                  ...value['notifications'],
              }
            : defaults.notifications,
        switchLeadSeconds: clampNumber(value['switchLeadSeconds'], 0, 300, 5),
        switchCountdownSeconds: clampNumber(
            value['switchCountdownSeconds'],
            1,
            300,
            5
        ),
        preferredChannelIds: Array.isArray(value['preferredChannelIds'])
            ? value['preferredChannelIds'].filter(
                  (item): item is string => typeof item === 'string'
              )
            : [],
    } as FollowedSeriesPreferences;
}

function cloneDefaultPreferences(): FollowedSeriesPreferences {
    return {
        ...DEFAULT_FOLLOWED_SERIES_PREFERENCES,
        notifications: {
            ...DEFAULT_FOLLOWED_SERIES_PREFERENCES.notifications,
        },
        preferredChannelIds: [
            ...DEFAULT_FOLLOWED_SERIES_PREFERENCES.preferredChannelIds,
        ],
    };
}

function clampNumber(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number
): number {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.min(maximum, Math.max(minimum, number))
        : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
