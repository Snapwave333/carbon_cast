import {
    FollowedSeriesProgramCandidate,
    FollowedSeriesProgramQuery,
} from '@iptvnator/shared/interfaces';
import { stableHash } from './followed-series-normalization.util';

const MAX_HINTS_PER_QUERY = 100;
const MAX_TOTAL_CANDIDATES = 20_000;

export interface FollowedSeriesProgramLookup {
    getFollowedSeriesPrograms(
        request: FollowedSeriesProgramQuery
    ): Promise<FollowedSeriesProgramCandidate[] | null>;
}

export async function queryFollowedSeriesProgramBatches(
    lookup: FollowedSeriesProgramLookup,
    request: Omit<FollowedSeriesProgramQuery, 'titleHints'> & {
        titleHints: readonly string[];
    }
): Promise<FollowedSeriesProgramCandidate[] | null> {
    const candidates = new Map<string, FollowedSeriesProgramCandidate>();
    for (
        let offset = 0;
        offset < request.titleHints.length &&
        candidates.size < MAX_TOTAL_CANDIDATES;
        offset += MAX_HINTS_PER_QUERY
    ) {
        const batch = await lookup.getFollowedSeriesPrograms({
            ...request,
            titleHints: request.titleHints.slice(
                offset,
                offset + MAX_HINTS_PER_QUERY
            ),
            limit: Math.min(
                request.limit ?? 5_000,
                MAX_TOTAL_CANDIDATES - candidates.size
            ),
        });
        if (batch === null) return null;
        for (const candidate of batch) {
            const key =
                candidate.databaseId == null
                    ? stableHash(
                          `${candidate.channel}|${candidate.start}|${candidate.title}`
                      )
                    : String(candidate.databaseId);
            candidates.set(key, candidate);
            if (candidates.size >= MAX_TOTAL_CANDIDATES) break;
        }
    }
    return [...candidates.values()];
}
