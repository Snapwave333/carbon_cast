/**
 * EPG Database IPC event handlers
 *
 * The renderer can perform a user-driven full-text search and a bounded,
 * indexed followed-series lookahead. Imports and channel-centric lookups stay
 * in the EPG worker and `epg-query.service.ts`.
 */

import { sql } from 'drizzle-orm';
import { ipcMain } from 'electron';
import type {
    FollowedSeriesProgramCandidate,
    FollowedSeriesProgramQuery,
} from '@iptvnator/shared/interfaces';
import { getDatabase } from '../../database/connection';

const loggerLabel = '[EPG DB]';
const MAX_FOLLOWED_LOOKAHEAD_MS = 31 * 24 * 60 * 60 * 1_000;

type FollowedSeriesProgramRow = Omit<
    FollowedSeriesProgramCandidate,
    'isNew' | 'previouslyShown'
> & {
    isNew?: number | boolean | null;
    previouslyShown?: number | boolean | null;
};

/**
 * Full-text search EPG programs using FTS5 with LIKE fallback
 * Handles Cyrillic and other Unicode text properly
 * Includes channel display name via JOIN
 */
ipcMain.handle(
    'EPG_DB_SEARCH_PROGRAMS',
    async (_event, searchTerm: string, limit = 50) => {
        try {
            const db = await getDatabase();
            const trimmedTerm = searchTerm.trim();

            if (!trimmedTerm) {
                return [];
            }

            // Use LIKE for substring matching (works better with Cyrillic)
            // This is more intuitive for users expecting exact substring matches
            const likePattern = `%${trimmedTerm}%`;

            // JOIN with epg_channels to get channel display name
            // Include all programs (past and future) for catchup/archive feature
            const results = await db.all(sql`
                SELECT
                    p.*,
                    c.display_name as channel_name
                FROM epg_programs p
                LEFT JOIN epg_channels c ON p.channel_id = c.id
                WHERE (
                    p.title LIKE ${likePattern}
                    OR p.description LIKE ${likePattern}
                    OR p.category LIKE ${likePattern}
                )
                ORDER BY p.start
                LIMIT ${limit}
            `);

            return results;
        } catch (error) {
            console.error(loggerLabel, 'Error searching EPG programs:', error);
            throw error;
        }
    }
);

ipcMain.handle(
    'EPG_DB_FOLLOWED_SERIES_PROGRAMS',
    async (_event, request: FollowedSeriesProgramQuery) => {
        try {
            return await queryFollowedSeriesPrograms(request);
        } catch (error) {
            console.error(
                loggerLabel,
                'Error querying followed-series programs:',
                error
            );
            return [];
        }
    }
);

export async function queryFollowedSeriesPrograms(
    request: FollowedSeriesProgramQuery
): Promise<FollowedSeriesProgramCandidate[]> {
    if (
        !request ||
        typeof request.from !== 'string' ||
        typeof request.to !== 'string' ||
        !Array.isArray(request.titleHints)
    ) {
        return [];
    }
    const fromMs = Date.parse(request.from);
    const toMs = Date.parse(request.to);
    const hints = Array.from(
        new Set(
            request.titleHints
                .filter((hint): hint is string => typeof hint === 'string')
                .map((hint) => hint.trim().slice(0, 160))
                .filter(Boolean)
                .slice(0, 100)
        )
    );
    if (
        !Number.isFinite(fromMs) ||
        !Number.isFinite(toMs) ||
        toMs <= fromMs ||
        toMs - fromMs > MAX_FOLLOWED_LOOKAHEAD_MS ||
        hints.length === 0
    ) {
        return [];
    }
    const limit = Math.min(10_000, Math.max(1, request.limit ?? 5_000));
    const hintConditions = hints.map((hint) => {
        const pattern = `%${escapeLikePattern(hint)}%`;
        return sql`(
            p.title LIKE ${pattern} ESCAPE '\\'
            OR p.description LIKE ${pattern} ESCAPE '\\'
        )`;
    });
    const db = await getDatabase();
    const rows = (await db.all(sql`
        SELECT
            p.id AS databaseId,
            p.channel_id AS channel,
            p.start AS start,
            p.stop AS stop,
            p.title AS title,
            p.description AS desc,
            p.category AS category,
            p.episode_num AS episodeNum,
            p.icon_url AS iconUrl,
            p.rating AS rating,
            p.program_id AS programId,
            p.series_id AS seriesId,
            p.title AS seriesTitle,
            p.episode_title AS episodeTitle,
            p.is_new AS isNew,
            p.previously_shown AS previouslyShown,
            p.source_url AS sourceUrl,
            c.display_name AS channelName,
            c.icon_url AS channelLogo
        FROM epg_programs p
        LEFT JOIN epg_channels c ON p.channel_id = c.id
        WHERE p.start >= ${new Date(fromMs).toISOString()}
          AND p.start <= ${new Date(toMs).toISOString()}
          AND (${sql.join(hintConditions, sql` OR `)})
        GROUP BY p.channel_id, p.start, p.title
        ORDER BY p.start, p.channel_id
        LIMIT ${limit}
    `)) as FollowedSeriesProgramRow[];

    return rows.map((row) => ({
        ...row,
        isNew: row.isNew == null ? null : Boolean(row.isNew),
        previouslyShown:
            row.previouslyShown == null ? null : Boolean(row.previouslyShown),
    }));
}

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
