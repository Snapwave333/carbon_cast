import {
    FollowedSeries,
    FollowedSeriesProgramCandidate,
    FollowSeriesRequest,
} from '@iptvnator/shared/interfaces';
import {
    normalizeFollowedSeriesTitle,
    normalizeOptionalId,
    followedSeriesTokenSimilarity,
    stableHash,
} from './followed-series-normalization.util';

export function createFollowedSeries(
    request: FollowSeriesRequest,
    now = new Date()
): FollowedSeries {
    const title = request.title.trim();
    const normalizedTitle = normalizeFollowedSeriesTitle(title);
    const sourceSeriesId = normalizeOptionalId(request.sourceSeriesId);
    const sourcePlaylistId = request.sourcePlaylistId?.trim() || undefined;
    const aliases = Array.from(
        new Set(
            [title, ...(request.aliases ?? [])]
                .map((alias) => alias.trim())
                .filter(Boolean)
        )
    );
    const identity = [
        request.source,
        sourcePlaylistId ?? '',
        sourceSeriesId ?? normalizedTitle,
    ].join('|');

    return {
        id: `series-${stableHash(identity)}`,
        source: request.source,
        sourceSeriesId,
        sourcePlaylistId,
        title,
        normalizedTitle,
        aliases,
        artworkUrl: request.artworkUrl?.trim() || undefined,
        priority: 0,
        autoSwitchDefault: false,
        followedAt: now.toISOString(),
    };
}

export function matchesFollowedSeriesCandidate(
    series: FollowedSeries,
    candidate: FollowedSeriesProgramCandidate
): boolean {
    if (
        series.source === 'epg' &&
        series.sourceSeriesId &&
        candidate.seriesId &&
        series.sourceSeriesId === candidate.seriesId
    ) {
        return true;
    }
    const candidateTitle = normalizeFollowedSeriesTitle(
        candidate.seriesTitle || candidate.title
    );
    if (!candidateTitle) return false;
    const aliases = new Set([
        series.normalizedTitle,
        ...series.aliases.map(normalizeFollowedSeriesTitle),
    ]);
    for (const alias of aliases) {
        if (!alias) continue;
        if (candidateTitle === alias) return true;
        if (
            alias.split(' ').length > 1 &&
            (candidateTitle.startsWith(`${alias} `) ||
                alias.startsWith(`${candidateTitle} `))
        ) {
            return true;
        }
        if (followedSeriesTokenSimilarity(alias, candidateTitle) >= 0.8) {
            return true;
        }
    }
    return false;
}
