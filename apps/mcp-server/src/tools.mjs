// MCP data tools plus authenticated live-control forwarding. All outputs are
// deliberately redacted: stream URLs, credentials, private paths, and raw
// provider payloads never leave the local application boundary.
import {
    withDb,
    dbExists,
    tableNames,
    count,
    playlistRows,
    playlistRow,
    m3uItems,
    isM3u,
    epgProgramsForChannel,
    epgAiringNow,
} from './db.mjs';
import { canonicalKey, expandCategories } from './categories.mjs';
import { liveHandlers, liveTools } from './live-tools.mjs';

const safeM3uChannel = (item) => ({
    id: item.id,
    name: item.name,
    group: item.group,
    tvgId: item.tvgId || undefined,
    radio: Boolean(item.radio),
});

const safePlaylist = (playlist) => ({
    id: playlist.id,
    name: playlist.name,
    type: playlist.type,
    channels: playlist.count,
    lastUpdated: playlist.last_updated || undefined,
    sourceConfigured: Boolean(
        playlist.filePath || playlist.url || playlist.serverUrl
    ),
});

// Resolve now-playing + upcoming programmes from a channel's EPG rows.
function pickNowNext(programs, limit) {
    const nowMs = Date.now();
    const parsed = programs.map((p) => ({
        ...p,
        s: Date.parse(p.start),
        e: Date.parse(p.stop),
    }));
    const now = parsed.find((p) => p.s <= nowMs && p.e > nowMs) || null;
    const next = parsed
        .filter((p) => p.s > nowMs)
        .sort((a, b) => a.s - b.s)
        .slice(0, limit);
    const strip = (p) =>
        p && {
            title: p.title,
            start: p.start,
            stop: p.stop,
            category: p.category || undefined,
            description: p.description || undefined,
        };
    return {
        now: strip(now),
        next: next.map(strip),
        programsForChannel: programs.length,
    };
}

const clampLimit = (n, def = 50, max = 500) => {
    const v = Number.isFinite(n) ? Math.floor(n) : def;
    return Math.max(1, Math.min(max, v));
};
const clampOffset = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

function requireDb() {
    if (!dbExists()) {
        throw new Error(
            'IPTVnator database not found. Open the IPTVnator app once (or set IPTVNATOR_DB_PATH) so the database is created.'
        );
    }
}

// ── Content-based (Xtream/Stalker) channel query ─────────────────────────────
function contentChannels(db, playlistId, { category, search, limit, offset }) {
    const where = ['cat.playlist_id = ?'];
    const args = [playlistId];
    if (category) {
        where.push('cat.name = ?');
        args.push(category);
    }
    if (search) {
        where.push('c.title LIKE ?');
        args.push(`%${search}%`);
    }
    const rows = db
        .prepare(
            'SELECT c.id, c.title, c.type, c.xtream_id, cat.name AS category ' +
                'FROM content c LEFT JOIN categories cat ON cat.id = c.category_id ' +
                `WHERE ${where.join(' AND ')} ORDER BY c.title LIMIT ? OFFSET ?`
        )
        .all(...args, limit, offset);
    return rows.map((r) => ({
        id: String(r.id),
        name: r.title,
        type: r.type,
        category: r.category ?? '',
    }));
}

// ── Handlers ─────────────────────────────────────────────────────────────────
const handlers = {
    get_app_status() {
        const ok = dbExists();
        if (!ok) return { databaseFound: false };
        return withDb((db) => {
            const tables = tableNames(db);
            const counts = {};
            for (const t of [
                'playlists',
                'categories',
                'content',
                'favorites',
                'downloads',
                'recently_viewed',
                'epg_channels',
                'epg_programs',
            ])
                if (tables.includes(t)) counts[t] = count(db, t);
            const playlists = playlistRows(db).map(safePlaylist);
            return {
                databaseFound: true,
                tables: tables.length,
                counts,
                playlists,
            };
        });
    },

    list_playlists() {
        requireDb();
        return withDb((db) => playlistRows(db).map(safePlaylist));
    },

    get_playlist({ playlistId }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            return {
                ...safePlaylist(p),
                createdAt: p.date_created || undefined,
                hasCredentials: Boolean(p.password || p.username),
            };
        });
    },

    list_categories({ playlistId }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            if (isM3u(p.type)) {
                // Derive canonical, de-duplicated categories from the M3U groups.
                const buckets = new Map();
                let rawDistinct = new Set();
                for (const it of m3uItems(db, playlistId)) {
                    rawDistinct.add(it.group || '(none)');
                    for (const { key, label } of expandCategories(it.group)) {
                        const b = buckets.get(key) || {
                            key,
                            label,
                            channels: 0,
                            variants: new Set(),
                        };
                        b.channels += 1;
                        if (it.group) b.variants.add(it.group);
                        buckets.set(key, b);
                    }
                }
                const categories = [...buckets.values()]
                    .sort((a, b) => b.channels - a.channels)
                    .map((b) => ({
                        label: b.label,
                        key: b.key,
                        channels: b.channels,
                        mergedFrom: [...b.variants],
                    }));
                return {
                    playlistId,
                    source: 'm3u',
                    rawGroupCount: rawDistinct.size,
                    canonicalCount: categories.length,
                    note: `Normalized ${rawDistinct.size} raw group labels into ${categories.length} canonical categories.`,
                    categories,
                };
            }
            const cats = db
                .prepare(
                    'SELECT id,name,type,xtream_id,hidden FROM categories WHERE playlist_id = ? ORDER BY name'
                )
                .all(playlistId);
            return {
                playlistId,
                source: 'provider',
                canonicalCount: cats.length,
                categories: cats,
            };
        });
    },

    list_channels({ playlistId, category, search, limit, offset }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        const lim = clampLimit(limit);
        const off = clampOffset(offset);
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            if (isM3u(p.type)) {
                const catKey = category ? canonicalKey(category) : null;
                const q = search ? String(search).toLowerCase() : null;
                let items = m3uItems(db, playlistId);
                if (catKey != null)
                    items = items.filter((it) =>
                        expandCategories(it.group).some((c) => c.key === catKey)
                    );
                if (q)
                    items = items.filter((it) =>
                        it.name.toLowerCase().includes(q)
                    );
                const total = items.length;
                const page = items.slice(off, off + lim).map(safeM3uChannel);
                return {
                    playlistId,
                    total,
                    offset: off,
                    limit: lim,
                    count: page.length,
                    channels: page,
                };
            }
            const channels = contentChannels(db, playlistId, {
                category,
                search,
                limit: lim,
                offset: off,
            });
            return {
                playlistId,
                offset: off,
                limit: lim,
                count: channels.length,
                channels,
            };
        });
    },

    search_channels({ query, playlistId, limit }) {
        requireDb();
        if (!query) throw new Error('query is required');
        const lim = clampLimit(limit);
        const q = String(query).toLowerCase();
        return withDb((db) => {
            const pls = playlistId
                ? [playlistRow(db, playlistId)].filter(Boolean)
                : playlistRows(db);
            const results = [];
            for (const p of pls) {
                if (isM3u(p.type)) {
                    for (const it of m3uItems(db, p.id)) {
                        if (it.name.toLowerCase().includes(q)) {
                            results.push({
                                playlistId: p.id,
                                playlist: p.name,
                                ...safeM3uChannel(it),
                            });
                            if (results.length >= lim)
                                return {
                                    query,
                                    count: results.length,
                                    results,
                                };
                        }
                    }
                } else {
                    for (const c of contentChannels(db, p.id, {
                        search: query,
                        limit: lim,
                        offset: 0,
                    })) {
                        results.push({
                            playlistId: p.id,
                            playlist: p.name,
                            ...c,
                        });
                        if (results.length >= lim)
                            return { query, count: results.length, results };
                    }
                }
            }
            return { query, count: results.length, results };
        });
    },

    get_channel({ playlistId, channelId, name }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        if (!channelId && !name) throw new Error('Provide channelId or name');
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            if (isM3u(p.type)) {
                const items = m3uItems(db, playlistId);
                const found =
                    (channelId != null &&
                        items.find((it) => it.id === String(channelId))) ||
                    (name &&
                        items.find(
                            (it) =>
                                it.name.toLowerCase() ===
                                String(name).toLowerCase()
                        )) ||
                    (name &&
                        items.find((it) =>
                            it.name
                                .toLowerCase()
                                .includes(String(name).toLowerCase())
                        ));
                if (!found) throw new Error('Channel not found');
                return safeM3uChannel(found);
            }
            // Match only on the identifiers actually provided — a LIKE '%%'
            // fallback would return an arbitrary channel on a bad channelId.
            const match = [];
            const args = [playlistId];
            if (channelId != null) {
                match.push('c.id=?');
                args.push(channelId);
            }
            if (name) {
                match.push('c.title LIKE ?');
                args.push(`%${name}%`);
            }
            const row = db
                .prepare(
                    `SELECT c.*, cat.name AS category FROM content c LEFT JOIN categories cat ON cat.id=c.category_id WHERE c.category_id IN (SELECT id FROM categories WHERE playlist_id=?) AND (${match.join(' OR ')}) LIMIT 1`
                )
                .get(...args);
            if (!row) throw new Error('Channel not found');
            return {
                id: String(row.id),
                name: row.title,
                type: row.type,
                category: row.category ?? '',
                providerId: row.xtream_id ?? undefined,
            };
        });
    },

    list_favorites({ playlistId }) {
        requireDb();
        return withDb((db) => {
            const rows = playlistId
                ? db
                      .prepare(
                          'SELECT playlist_id, content_id, position FROM favorites WHERE playlist_id = ? ORDER BY position'
                      )
                      .all(playlistId)
                : db
                      .prepare(
                          'SELECT playlist_id, content_id, position FROM favorites ORDER BY playlist_id, position'
                      )
                      .all();
            // For M3U playlists, favorites also live in the payload as channel ids.
            let m3uFavorites = [];
            if (playlistId) {
                const p = playlistRow(db, playlistId);
                if (p && isM3u(p.type)) {
                    const favIds = new Set(
                        (() => {
                            try {
                                const j = JSON.parse(p.payload || '{}');
                                return Array.isArray(j.favorites)
                                    ? j.favorites.map(String)
                                    : [];
                            } catch {
                                return [];
                            }
                        })()
                    );
                    if (favIds.size)
                        m3uFavorites = m3uItems(db, playlistId)
                            .filter((it) => favIds.has(it.id))
                            .map(safeM3uChannel);
                }
            }
            return { table: rows, m3uFavorites };
        });
    },

    list_downloads({ status }) {
        requireDb();
        return withDb((db) => {
            const rows = status
                ? db
                      .prepare(
                          'SELECT id, playlist_id, xtream_id, content_type, title, status, bytes_downloaded, total_bytes, created_at, updated_at FROM downloads WHERE status = ? ORDER BY updated_at DESC'
                      )
                      .all(status)
                : db
                      .prepare(
                          'SELECT id, playlist_id, xtream_id, content_type, title, status, bytes_downloaded, total_bytes, created_at, updated_at FROM downloads ORDER BY updated_at DESC'
                      )
                      .all();
            return { count: rows.length, downloads: rows };
        });
    },

    get_epg_now_next({ tvgId, playlistId, channelName, limit }) {
        requireDb();
        const lim = clampLimit(limit, 3, 10);
        return withDb((db) => {
            let channelId = tvgId;
            let resolvedName = null;
            if (!channelId && playlistId && channelName) {
                const q = String(channelName).toLowerCase();
                const it = m3uItems(db, playlistId).find(
                    (i) => i.tvgId && i.name.toLowerCase().includes(q)
                );
                if (it) {
                    channelId = it.tvgId;
                    resolvedName = it.name;
                }
            }
            if (!channelId)
                throw new Error(
                    'Provide tvgId, or playlistId + channelName to resolve one.'
                );
            const programs = epgProgramsForChannel(db, channelId);
            return {
                channelId,
                channel: resolvedName,
                ...pickNowNext(programs, lim),
            };
        });
    },

    whats_on_now({ playlistId, category, limit }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        const lim = clampLimit(limit, 30, 100);
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            if (!isM3u(p.type))
                throw new Error(
                    'whats_on_now currently supports M3U playlists.'
                );
            const catKey = category ? canonicalKey(category) : null;
            let items = m3uItems(db, playlistId).filter((it) => it.tvgId);
            if (catKey != null)
                items = items.filter((it) =>
                    expandCategories(it.group).some((c) => c.key === catKey)
                );
            items = items.slice(0, lim);
            // One query for everything airing now, instead of one full-history
            // query per channel.
            const airing = new Map();
            for (const r of epgAiringNow(db))
                if (!airing.has(r.channel_id)) airing.set(r.channel_id, r);
            const channels = items.map((it) => {
                const now = airing.get(it.tvgId);
                return {
                    channel: it.name,
                    group: it.group,
                    nowPlaying: now ? now.title : null,
                    until: now ? now.stop : null,
                };
            });
            return {
                playlistId,
                category: category || null,
                count: channels.length,
                channels,
            };
        });
    },

    find_now_playing({ playlistId, query, limit }) {
        requireDb();
        if (!playlistId) throw new Error('playlistId is required');
        const lim = clampLimit(limit, 40, 200);
        return withDb((db) => {
            const p = playlistRow(db, playlistId);
            if (!p) throw new Error(`No playlist with id ${playlistId}`);
            if (!isM3u(p.type))
                throw new Error(
                    'find_now_playing currently supports M3U playlists.'
                );
            const byTvg = new Map();
            for (const it of m3uItems(db, playlistId))
                if (it.tvgId && !byTvg.has(it.tvgId)) byTvg.set(it.tvgId, it);
            const q = query ? String(query).toLowerCase() : null;
            // epgAiringNow filters to current programmes in SQL, so we only
            // match/format the few hundred rows on air instead of the full EPG.
            const results = [];
            for (const r of epgAiringNow(db)) {
                const ch = byTvg.get(r.channel_id);
                if (!ch) continue;
                if (
                    q &&
                    !r.title?.toLowerCase().includes(q) &&
                    !r.category?.toLowerCase().includes(q)
                )
                    continue;
                results.push({
                    channel: ch.name,
                    group: ch.group,
                    title: r.title,
                    category: r.category || undefined,
                    until: r.stop,
                });
                if (results.length >= lim) break;
            }
            return {
                playlistId,
                query: query || null,
                count: results.length,
                results,
            };
        });
    },

    get_epg_schedule({ tvgId, playlistId, channelName, hours, limit }) {
        requireDb();
        const h = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 48) : 6;
        const lim = clampLimit(limit, 20, 100);
        return withDb((db) => {
            let channelId = tvgId;
            let resolvedName = null;
            if (!channelId && playlistId && channelName) {
                const q = String(channelName).toLowerCase();
                const it = m3uItems(db, playlistId).find(
                    (i) => i.tvgId && i.name.toLowerCase().includes(q)
                );
                if (it) {
                    channelId = it.tvgId;
                    resolvedName = it.name;
                }
            }
            if (!channelId)
                throw new Error('Provide tvgId, or playlistId + channelName.');
            const nowMs = Date.now();
            const endMs = nowMs + h * 3600 * 1000;
            const programs = epgProgramsForChannel(db, channelId)
                .map((p) => ({
                    ...p,
                    s: Date.parse(p.start),
                    e: Date.parse(p.stop),
                }))
                .filter((p) => p.e > nowMs && p.s < endMs)
                .sort((a, b) => a.s - b.s)
                .slice(0, lim)
                .map((p) => ({
                    title: p.title,
                    start: p.start,
                    stop: p.stop,
                    category: p.category || undefined,
                }));
            return {
                channelId,
                channel: resolvedName,
                hours: h,
                count: programs.length,
                programs,
            };
        });
    },
};

// ── Tool schemas (advertised over MCP tools/list) ────────────────────────────
export const tools = [
    {
        name: 'get_app_status',
        description:
            'CarbonCast IPTV database status, table row counts, and a safe playlist summary.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'list_playlists',
        description:
            'List all playlists (M3U, Xtream, Stalker) with id, name, type, and channel count.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'get_playlist',
        description:
            'Full metadata for one playlist (credentials/payload omitted).',
        inputSchema: {
            type: 'object',
            properties: { playlistId: { type: 'string' } },
            required: ['playlistId'],
        },
    },
    {
        name: 'list_categories',
        description:
            'Categories for a playlist. For M3U playlists the raw group labels are normalized and de-duplicated into canonical categories (so "Animation", "ANIMATION", "Anime", "Animation;Kids" collapse into one).',
        inputSchema: {
            type: 'object',
            properties: { playlistId: { type: 'string' } },
            required: ['playlistId'],
        },
    },
    {
        name: 'list_channels',
        description:
            'List channels in a playlist, optionally filtered by category (canonical) and a name search. Paginated.',
        inputSchema: {
            type: 'object',
            properties: {
                playlistId: { type: 'string' },
                category: { type: 'string' },
                search: { type: 'string' },
                limit: { type: 'number' },
                offset: { type: 'number' },
            },
            required: ['playlistId'],
        },
    },
    {
        name: 'search_channels',
        description: 'Search channels by name across one or all playlists.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                playlistId: { type: 'string' },
                limit: { type: 'number' },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_channel',
        description:
            'Get one channel by id or name using safe metadata only; stream URLs and provider credentials are never returned.',
        inputSchema: {
            type: 'object',
            properties: {
                playlistId: { type: 'string' },
                channelId: { type: 'string' },
                name: { type: 'string' },
            },
            required: ['playlistId'],
        },
    },
    {
        name: 'list_favorites',
        description:
            'List favorite channels (optionally scoped to one playlist).',
        inputSchema: {
            type: 'object',
            properties: { playlistId: { type: 'string' } },
        },
    },
    {
        name: 'list_downloads',
        description: 'List downloads (optionally filtered by status).',
        inputSchema: {
            type: 'object',
            properties: { status: { type: 'string' } },
        },
    },
    {
        name: 'get_epg_now_next',
        description:
            "Now-playing and upcoming programmes for a channel from the EPG. Provide a channel's tvgId, or a playlistId + channelName to resolve one.",
        inputSchema: {
            type: 'object',
            properties: {
                tvgId: { type: 'string' },
                playlistId: { type: 'string' },
                channelName: { type: 'string' },
                limit: { type: 'number' },
            },
        },
    },
    {
        name: 'whats_on_now',
        description:
            "What's playing right now across a playlist's channels, optionally filtered to one canonical category. M3U playlists with EPG data.",
        inputSchema: {
            type: 'object',
            properties: {
                playlistId: { type: 'string' },
                category: { type: 'string' },
                limit: { type: 'number' },
            },
            required: ['playlistId'],
        },
    },
    {
        name: 'find_now_playing',
        description:
            "Search the whole EPG for what's airing RIGHT NOW matching a title/category term (e.g. 'news', 'movie', 'football'). Empty query returns everything currently on. M3U playlists with EPG data.",
        inputSchema: {
            type: 'object',
            properties: {
                playlistId: { type: 'string' },
                query: { type: 'string' },
                limit: { type: 'number' },
            },
            required: ['playlistId'],
        },
    },
    {
        name: 'get_epg_schedule',
        description:
            "A channel's upcoming schedule over the next N hours (default 6). Provide a tvgId, or a playlistId + channelName.",
        inputSchema: {
            type: 'object',
            properties: {
                tvgId: { type: 'string' },
                playlistId: { type: 'string' },
                channelName: { type: 'string' },
                hours: { type: 'number' },
                limit: { type: 'number' },
            },
        },
    },
    ...liveTools,
];

export async function callTool(name, args) {
    const live = liveHandlers[name];
    if (live) return live(args || {});
    const fn = handlers[name];
    if (!fn) throw new Error(`Unknown tool: ${name}`);
    return fn(args || {});
}
