// SQLite access for the IPTVnator MCP server.
//
// Uses Node's built-in `node:sqlite` (NOT better-sqlite3): the server runs under
// system Node, while the repo's better-sqlite3 is compiled for Electron's ABI and
// would fail to load here. node:sqlite is dependency-free and ABI-safe.
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function dbPath() {
    return (
        process.env.IPTVNATOR_DB_PATH ||
        path.join(os.homedir(), '.iptvnator', 'databases', 'iptvnator.db')
    );
}

export function dbExists() {
    try {
        return fs.existsSync(dbPath());
    } catch {
        return false;
    }
}

// Open a fresh read-only connection per call so we always see what the running
// app has committed, and never hold a lock. Cheap for our call frequency.
export function withDb(fn) {
    const db = new DatabaseSync(dbPath(), { readOnly: true });
    try {
        return fn(db);
    } finally {
        try {
            db.close();
        } catch {
            /* ignore */
        }
    }
}

export function tableNames(db) {
    return db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((r) => r.name);
}

export function count(db, table) {
    try {
        return db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get().c;
    } catch {
        return null;
    }
}

export function playlistRows(db) {
    return db
        .prepare(
            'SELECT id,name,type,count,date_created,last_updated,filePath,url,serverUrl ' +
                'FROM playlists ORDER BY position, name'
        )
        .all();
}

export function playlistRow(db, id) {
    return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
}

export function isM3u(type) {
    return typeof type === 'string' && type.startsWith('m3u');
}

// Parse and normalize M3U channel items from a playlist's payload blob.
// Cached per playlist, invalidated by last_updated.
const itemsCache = new Map();

export function m3uItems(db, id) {
    const row = db
        .prepare('SELECT payload,last_updated FROM playlists WHERE id = ?')
        .get(id);
    if (!row || !row.payload) return [];
    const key = String(row.last_updated ?? '');
    const cached = itemsCache.get(id);
    if (cached && cached.key === key) return cached.items;

    let raw = [];
    try {
        const j = JSON.parse(row.payload);
        raw = j && j.playlist && Array.isArray(j.playlist.items) ? j.playlist.items : [];
    } catch {
        raw = [];
    }
    const items = raw.map((it, i) => ({
        index: i,
        id: it.id != null ? String(it.id) : String(i),
        name: it.name ?? '',
        url: it.url ?? '',
        group: it.group && it.group.title ? it.group.title : '',
        tvgId: (it.tvg && it.tvg.id) || '',
        logo: (it.tvg && it.tvg.logo) || '',
        radio: it.radio === 'true' || it.radio === true,
    }));
    itemsCache.set(id, { key, items });
    return items;
}

// EPG programs for a channel (channel_id matches an M3U channel's tvg-id),
// sorted by start time. Times are ISO-8601 strings; callers compare via Date.
export function epgProgramsForChannel(db, channelId) {
    return db
        .prepare(
            'SELECT channel_id, start, stop, title, description, category, episode_num ' +
                'FROM epg_programs WHERE channel_id = ? ORDER BY start'
        )
        .all(channelId);
}
