import {
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeries,
    FollowedSeriesChannelMapping,
    FollowedSeriesPreferences,
    FollowedSeriesProgramCandidate,
} from '@iptvnator/shared/interfaces';
import {
    descriptionFingerprint,
    descriptionSimilarity,
    normalizeFollowedSeriesTitle,
    parseSeasonEpisode,
    stableHash,
} from './followed-series-normalization.util';
import { indexFollowedSeriesChannelMappings } from './followed-series-channel-ranking.util';
import { matchesFollowedSeriesCandidate } from './followed-series-identity.util';

export interface FollowedSeriesMatchResult {
    episodes: FollowedEpisode[];
    broadcasts: BroadcastInstance[];
}

export function matchFollowedSeriesPrograms(
    series: readonly FollowedSeries[],
    candidates: readonly FollowedSeriesProgramCandidate[],
    channelMappings: readonly FollowedSeriesChannelMapping[],
    preferences: FollowedSeriesPreferences,
    now = new Date()
): FollowedSeriesMatchResult {
    const episodes: FollowedEpisode[] = [];
    const broadcasts: BroadcastInstance[] = [];
    const mappingsByEpgId = indexFollowedSeriesChannelMappings(
        channelMappings,
        preferences
    );

    for (const item of series) {
        const itemEpisodes: FollowedEpisode[] = [];
        for (const candidate of candidates) {
            if (!matchesFollowedSeriesCandidate(item, candidate)) continue;

            const newness = candidate.isNew
                ? 'new'
                : candidate.previouslyShown
                  ? 'repeat'
                  : 'unknown';
            if (!preferences.includeReruns && newness === 'repeat') continue;
            if (preferences.onlyNewEpisodes && newness !== 'new') continue;

            const parsed = parseSeasonEpisode(
                candidate.episodeNum,
                candidate.title
            );
            const episodeTitle = resolveEpisodeTitle(item, candidate, parsed);
            const normalizedEpisodeTitle =
                normalizeFollowedSeriesTitle(episodeTitle);
            let episode = findEquivalentEpisode(itemEpisodes, {
                candidate,
                seasonNumber: parsed.seasonNumber,
                episodeNumber: parsed.episodeNumber,
                normalizedTitle: normalizedEpisodeTitle,
            });
            if (!episode) {
                const episodeId = buildEpisodeId(
                    item.id,
                    candidate,
                    parsed.seasonNumber,
                    parsed.episodeNumber,
                    normalizedEpisodeTitle
                );
                episode = {
                    id: episodeId,
                    seriesId: item.id,
                    programId: candidate.programId ?? undefined,
                    title: episodeTitle,
                    normalizedTitle: normalizedEpisodeTitle,
                    description: candidate.desc,
                    seasonNumber: parsed.seasonNumber,
                    episodeNumber: parsed.episodeNumber,
                    newness,
                    broadcastIds: [],
                };
                itemEpisodes.push(episode);
                episodes.push(episode);
            }

            const startMs = Date.parse(candidate.start);
            const endMs = Date.parse(candidate.stop);
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;

            const mapping = mappingsByEpgId.get(
                candidate.channel.toLowerCase()
            )?.[0];
            const broadcastId = `broadcast-${stableHash(
                `${episode.id}|${candidate.channel.toLowerCase()}|${candidate.start}`
            )}`;
            if (broadcasts.some((broadcast) => broadcast.id === broadcastId)) {
                continue;
            }
            const availability =
                endMs <= now.getTime()
                    ? 'ended'
                    : mapping
                      ? startMs <= now.getTime()
                          ? 'available'
                          : 'scheduled'
                      : 'unavailable';
            const revision = stableHash(
                [
                    candidate.start,
                    candidate.stop,
                    candidate.channel,
                    candidate.title,
                ].join('|')
            );
            const broadcast: BroadcastInstance = {
                id: broadcastId,
                episodeId: episode.id,
                seriesId: item.id,
                epgChannelId: candidate.channel,
                channelMappingId: mapping?.id ?? null,
                playlistId: mapping?.playlistId ?? null,
                channelId: mapping?.channelId ?? null,
                channelName:
                    mapping?.name ?? candidate.channelName ?? candidate.channel,
                channelNumber: mapping?.number ?? null,
                channelLogo:
                    mapping?.logo ??
                    candidate.channelLogo ??
                    candidate.iconUrl ??
                    null,
                channelGroup: mapping?.group ?? candidate.category ?? null,
                startAt: new Date(startMs).toISOString(),
                endAt: new Date(endMs).toISOString(),
                availability,
                alternativeBroadcastIds: [],
                sourceProgramId: candidate.programId ?? undefined,
                sourceSeriesId: candidate.seriesId ?? undefined,
                revision,
            };
            broadcasts.push(broadcast);
            episode.broadcastIds.push(broadcast.id);
        }
    }

    attachAlternativeBroadcasts(episodes, broadcasts);
    episodes.sort(
        (left, right) =>
            firstStart(left, broadcasts) - firstStart(right, broadcasts)
    );
    broadcasts.sort(
        (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt)
    );
    return { episodes, broadcasts };
}

function resolveEpisodeTitle(
    series: FollowedSeries,
    candidate: FollowedSeriesProgramCandidate,
    parsed: { seasonNumber: number | null; episodeNumber: number | null }
): string {
    if (candidate.episodeTitle?.trim()) return candidate.episodeTitle.trim();
    const suffix = candidate.title.match(/^[^:-]+\s*[:-]\s*(.+)$/)?.[1]?.trim();
    if (
        suffix &&
        normalizeFollowedSeriesTitle(candidate.title).startsWith(
            series.normalizedTitle
        )
    ) {
        return suffix;
    }
    if (parsed.seasonNumber != null && parsed.episodeNumber != null) {
        return `S${String(parsed.seasonNumber).padStart(2, '0')}E${String(
            parsed.episodeNumber
        ).padStart(2, '0')}`;
    }
    return candidate.title.trim() || series.title;
}

function findEquivalentEpisode(
    episodes: FollowedEpisode[],
    input: {
        candidate: FollowedSeriesProgramCandidate;
        seasonNumber: number | null;
        episodeNumber: number | null;
        normalizedTitle: string;
    }
): FollowedEpisode | undefined {
    return episodes.find((episode) => {
        if (
            input.candidate.programId &&
            episode.programId === input.candidate.programId
        ) {
            return true;
        }
        if (
            input.seasonNumber != null &&
            input.episodeNumber != null &&
            episode.seasonNumber === input.seasonNumber &&
            episode.episodeNumber === input.episodeNumber
        ) {
            return true;
        }
        if (
            input.normalizedTitle &&
            episode.normalizedTitle === input.normalizedTitle
        ) {
            return true;
        }
        return (
            descriptionSimilarity(episode.description, input.candidate.desc) >=
            0.82
        );
    });
}

function buildEpisodeId(
    seriesId: string,
    candidate: FollowedSeriesProgramCandidate,
    seasonNumber: number | null,
    episodeNumber: number | null,
    normalizedTitle: string
): string {
    const identity = candidate.programId
        ? `program:${candidate.programId}`
        : seasonNumber != null && episodeNumber != null
          ? `season:${seasonNumber}:episode:${episodeNumber}`
          : `title:${normalizedTitle}:desc:${descriptionFingerprint(candidate.desc)}`;
    return `episode-${stableHash(`${seriesId}|${identity}`)}`;
}

function attachAlternativeBroadcasts(
    episodes: readonly FollowedEpisode[],
    broadcasts: BroadcastInstance[]
): void {
    const byId = new Map(
        broadcasts.map((broadcast) => [broadcast.id, broadcast])
    );
    for (const episode of episodes) {
        for (const broadcastId of episode.broadcastIds) {
            const broadcast = byId.get(broadcastId);
            if (broadcast) {
                broadcast.alternativeBroadcastIds = episode.broadcastIds.filter(
                    (id) => id !== broadcastId
                );
            }
        }
    }
}

function firstStart(
    episode: FollowedEpisode,
    broadcasts: readonly BroadcastInstance[]
): number {
    const ids = new Set(episode.broadcastIds);
    return Math.min(
        ...broadcasts
            .filter((broadcast) => ids.has(broadcast.id))
            .map((broadcast) => Date.parse(broadcast.startAt))
    );
}
