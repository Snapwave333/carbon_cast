import {
    FollowedSeriesChannelMapping,
    FollowedSeriesPreferences,
} from '@iptvnator/shared/interfaces';
import { normalizeFollowedSeriesTitle } from './followed-series-normalization.util';

export function indexFollowedSeriesChannelMappings(
    mappings: readonly FollowedSeriesChannelMapping[],
    preferences: FollowedSeriesPreferences
): Map<string, FollowedSeriesChannelMapping[]> {
    const preferredIds = new Set(preferences.preferredChannelIds);
    const result = new Map<string, FollowedSeriesChannelMapping[]>();
    for (const mapping of mappings) {
        for (const epgId of mapping.epgChannelIds) {
            const key = epgId.trim().toLowerCase();
            if (!key) continue;
            const bucket = result.get(key) ?? [];
            bucket.push(mapping);
            bucket.sort(
                (left, right) =>
                    channelPreferenceScore(right, preferredIds, preferences) -
                    channelPreferenceScore(left, preferredIds, preferences)
            );
            result.set(key, bucket);
        }
    }
    return result;
}

function channelPreferenceScore(
    mapping: FollowedSeriesChannelMapping,
    preferredIds: ReadonlySet<string>,
    preferences: FollowedSeriesPreferences
): number {
    const searchable = normalizeFollowedSeriesTitle(
        `${mapping.name} ${mapping.group ?? ''}`
    );
    const language = normalizeFollowedSeriesTitle(
        preferences.preferredLanguage
    );
    const quality = normalizeFollowedSeriesTitle(
        preferences.preferredVideoQuality
    );
    return (
        Number(preferredIds.has(mapping.channelId) || mapping.preferred) * 100 +
        Number(Boolean(language) && searchable.includes(language)) * 10 +
        Number(Boolean(quality) && searchable.includes(quality)) * 5
    );
}
