#!/usr/bin/env node
// Builds one merged M3U from several public GitHub playlist sources, dropping
// anything that already exists in the local library and any channel that
// repeats across sources.
//
//   node tools/playlists/merge-sources.mjs [--out <path>]
//
// Sources are listed most-trusted first: the first occurrence of a channel
// wins, so a curated entry is preferred over a bulk-aggregated one.
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';

// `englishByConstruction` marks lists that are already language- or
// country-scoped to English. The remaining sources are global, so their
// entries are kept only when the group label names an English-speaking
// country — Free-TV groups by country, iptv-org groups by category.
const ENGLISH_GROUPS = new Set(
    [
        'uk',
        'usa',
        'united states',
        'united kingdom',
        'canada',
        'australia',
        'ireland',
        'new zealand',
    ].map((value) => value.toLowerCase())
);

const SOURCES = [
    {
        label: 'Free-TV',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    },
    {
        label: 'iptv-org/eng',
        url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',
        englishByConstruction: true,
    },
    ...['us', 'uk', 'ca', 'au', 'ie', 'nz'].map((code) => ({
        label: `iptv-org/${code}`,
        url: `https://iptv-org.github.io/iptv/countries/${code}.m3u`,
        englishByConstruction: true,
    })),
];

function isEnglish(source, extinf) {
    if (source.englishByConstruction) return true;
    const group = (extinf.match(/group-title="([^"]*)"/) ?? [, ''])[1];
    return ENGLISH_GROUPS.has(group.trim().toLowerCase());
}

const outFlag = process.argv.indexOf('--out');
const outPath =
    outFlag !== -1 && process.argv[outFlag + 1]
        ? process.argv[outFlag + 1]
        : path.join(os.homedir(), 'Desktop', 'carboncast-extra-sources.m3u');

// Quality/status annotations are cosmetic, so "CNN (720p)" and "CNN [Not 24/7]"
// are the same channel for de-duplication purposes.
const NOISE = /\((?:\d{3,4}p|SD|HD|FHD|UHD|4K)\)|\[[^\]]*\]/gi;

function normalizeName(name) {
    return name
        .replace(NOISE, ' ')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function normalizeUrl(url) {
    return url.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * The display name follows the first comma that is not inside an attribute
 * value. Attributes such as `http-user-agent="...(KHTML, like Gecko)..."`
 * routinely contain commas, so a plain indexOf(',') reads a fragment of the
 * user agent as the channel name and defeats de-duplication.
 */
function extinfDisplayName(line) {
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) return line.slice(i + 1).trim();
    }
    return '';
}

function parseM3u(text) {
    const lines = text.split(/\r?\n/);
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('#EXTINF')) continue;
        const name = extinfDisplayName(line);
        let url = '';
        for (let j = i + 1; j < lines.length; j++) {
            const candidate = lines[j].trim();
            if (!candidate || candidate.startsWith('#')) continue;
            url = candidate;
            break;
        }
        if (!name || !url) continue;
        entries.push({ extinf: line, name, url });
    }
    return entries;
}

function existingLibrary() {
    const db = new DatabaseSync(
        path.join(os.homedir(), '.iptvnator', 'databases', 'iptvnator.db'),
        { readOnly: true }
    );
    const names = new Set();
    const urls = new Set();
    let count = 0;
    for (const row of db.prepare('SELECT payload FROM playlists').all()) {
        let items = [];
        try {
            items = JSON.parse(row.payload)?.playlist?.items ?? [];
        } catch {
            continue;
        }
        for (const item of items) {
            const name = (item.name || item.title || '').trim();
            if (name) names.add(normalizeName(name));
            if (item.url) urls.add(normalizeUrl(item.url));
            count += 1;
        }
    }
    db.close();
    return { names, urls, count };
}

const library = existingLibrary();
console.log(`local library: ${library.count} channels`);

const seenNames = new Set(library.names);
const seenUrls = new Set(library.urls);
const merged = [];
const stats = [];

for (const source of SOURCES) {
    let text;
    try {
        const response = await fetch(source.url, { redirect: 'follow' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        text = await response.text();
    } catch (error) {
        stats.push({
            source: source.label,
            fetched: 0,
            added: 0,
            error: error.message,
        });
        continue;
    }

    const entries = parseM3u(text);
    let added = 0;
    let nonEnglish = 0;
    let duplicate = 0;
    for (const entry of entries) {
        if (!isEnglish(source, entry.extinf)) {
            nonEnglish += 1;
            continue;
        }
        const nameKey = normalizeName(entry.name);
        const urlKey = normalizeUrl(entry.url);
        if (!nameKey || seenNames.has(nameKey) || seenUrls.has(urlKey)) {
            duplicate += 1;
            continue;
        }
        seenNames.add(nameKey);
        seenUrls.add(urlKey);
        merged.push(entry);
        added += 1;
    }
    stats.push({
        source: source.label,
        fetched: entries.length,
        nonEnglish,
        duplicate,
        added,
    });
}

const body = merged.map((e) => `${e.extinf}\n${e.url}`).join('\n');
writeFileSync(outPath, `#EXTM3U\n${body}\n`, 'utf8');

console.table(stats);
console.log(`\nnew unique channels: ${merged.length}`);
console.log(`written to: ${outPath}`);
