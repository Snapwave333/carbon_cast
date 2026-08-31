import { sql } from 'drizzle-orm';
import type { GlobalSearchResult } from '@iptvnator/shared/interfaces';
import type { AppDatabase } from '../database.types';

/** A rolling local search cache, long enough to cover regular use but bounded. */
export const MEDIA_QUERY_CACHE_TTL_MS = 72 * 60 * 60 * 1000;

type QueryCacheDatabase = AppDatabase & {
    run?: (query: unknown) => Promise<unknown> | unknown;
};

interface MediaQueryCacheRow {
    result_json?: unknown;
}

/**
 * Cache only the finished, paged result set. This avoids repeating expensive
 * M3U payload parsing while preserving the existing SQLite FTS search as the
 * source of truth for a cold query.
 */
export function createMediaQueryCacheKey(input: {
    searchTerm: string;
    types: readonly string[];
    excludeHidden: boolean;
    sources: readonly string[] | undefined;
    limit: number;
    offset: number;
}): string {
    return JSON.stringify({
        v: 1,
        searchTerm: input.searchTerm.trim().toLocaleLowerCase(),
        types: [...input.types].sort(),
        excludeHidden: input.excludeHidden,
        sources: input.sources ? [...input.sources].sort() : null,
        limit: input.limit,
        offset: input.offset,
    });
}

export async function readMediaQueryCache(
    db: AppDatabase,
    cacheKey: string,
    now = Date.now()
): Promise<GlobalSearchResult[] | null> {
    if (!supportsQueryCache(db)) return null;

    try {
        const rows = (await db.all(sql`
            SELECT result_json
            FROM media_query_cache
            WHERE cache_key = ${cacheKey}
              AND expires_at > ${now}
            LIMIT 1
        `)) as MediaQueryCacheRow[];
        const payload = rows[0]?.result_json;
        if (typeof payload !== 'string') return null;
        const results: unknown = JSON.parse(payload);
        return Array.isArray(results) ? (results as GlobalSearchResult[]) : null;
    } catch {
        // Schema upgrades and cache corruption must never block search. The
        // authoritative FTS query below is always the safe fallback.
        return null;
    }
}

export async function writeMediaQueryCache(
    db: AppDatabase,
    cacheKey: string,
    results: readonly GlobalSearchResult[],
    now = Date.now()
): Promise<void> {
    if (!supportsQueryCache(db)) return;

    const cache = db as QueryCacheDatabase;
    try {
        await cache.run?.(sql`
            INSERT INTO media_query_cache (
                cache_key,
                result_json,
                expires_at,
                updated_at
            ) VALUES (
                ${cacheKey},
                ${JSON.stringify(results)},
                ${now + MEDIA_QUERY_CACHE_TTL_MS},
                ${now}
            )
            ON CONFLICT(cache_key) DO UPDATE SET
                result_json = excluded.result_json,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
        `);
        // One bounded delete keeps long-lived installations from accumulating
        // query variants indefinitely. Catalog write triggers clear all rows
        // immediately, so this is only time-based housekeeping.
        await cache.run?.(sql`
            DELETE FROM media_query_cache
            WHERE expires_at <= ${now}
        `);
    } catch {
        // Cache writes are opportunistic. A locked DB still has a working
        // catalog and must return search results instead of an infrastructure
        // error.
    }
}

function supportsQueryCache(db: AppDatabase): boolean {
    return typeof (db as QueryCacheDatabase).run === 'function';
}
