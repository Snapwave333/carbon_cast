#!/usr/bin/env node
/**
 * Regenerates the bundled free-channel catalogue from the public iptv-org API.
 *
 * The catalogue is committed rather than fetched at runtime so the Discover
 * tab opens instantly and works offline. That makes it a snapshot, and a
 * snapshot rots: this script is how it is refreshed, and `--check` is how a
 * maintainer finds out that a source has moved before a user does.
 *
 *   node tools/channel-sources/build-catalog.mjs           # regenerate
 *   node tools/channel-sources/build-catalog.mjs --check    # verify URLs only
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API = 'https://iptv-org.github.io/api';
const PLAYLIST_BASE = 'https://iptv-org.github.io/iptv';
const REQUEST_TIMEOUT_MS = 60_000;

/** Below this a slice is a handful of dead mirrors, not a browsable list. */
const MIN_STREAMS_PER_ENTRY = 3;

const OUTPUT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../libs/playlist/shared/util/src/lib/channel-sources/channel-source-catalog.data.ts'
);

async function fetchJson(name) {
    const url = `${API}/${name}.json`;
    const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`${url} responded ${response.status}`);
    }
    return response.json();
}

function countBy(values) {
    const counts = new Map();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
}

/**
 * Resolves each stream to the country, categories and languages of its
 * channel. A stream with no `channel` link is an orphan the aggregator could
 * not identify; it still plays, but it cannot be filed under any slice.
 */
function indexStreams({ streams, channels, feeds }) {
    const channelById = new Map(
        channels.map((channel) => [channel.id, channel])
    );
    const feedsByChannel = new Map();
    for (const feed of feeds) {
        const list = feedsByChannel.get(feed.channel) ?? [];
        list.push(feed);
        feedsByChannel.set(feed.channel, list);
    }

    const countries = [];
    const categories = [];
    const languages = [];
    const regionsByCountry = new Map();

    for (const stream of streams) {
        const channel = stream.channel
            ? channelById.get(stream.channel)
            : undefined;
        if (!channel) {
            continue;
        }

        if (channel.country) {
            countries.push(channel.country.toLowerCase());
        }
        for (const category of channel.categories ?? []) {
            categories.push(category);
        }

        const channelFeeds = feedsByChannel.get(channel.id) ?? [];
        const feed =
            channelFeeds.find((candidate) => candidate.id === stream.feed) ??
            channelFeeds.find((candidate) => candidate.is_main) ??
            channelFeeds[0];
        for (const language of feed?.languages ?? []) {
            languages.push(language);
        }
        for (const area of feed?.broadcast_area ?? []) {
            const [kind, code] = area.split('/');
            if (kind === 'r' && code) {
                const set = regionsByCountry.get(code.toLowerCase()) ?? 0;
                regionsByCountry.set(code.toLowerCase(), set + 1);
            }
        }
    }

    return {
        countries: countBy(countries),
        categories: countBy(categories),
        languages: countBy(languages),
        regions: regionsByCountry,
    };
}

function buildEntries(
    counts,
    { list, kind, pathSegment, nameOf, codeOf, flagOf }
) {
    return list
        .map((record) => {
            const code = codeOf(record);
            const streamCount = counts.get(code.toLowerCase()) ?? 0;
            return {
                id: `iptv-org:${kind}:${code.toLowerCase()}`,
                kind,
                code: code.toLowerCase(),
                name: nameOf(record),
                flag: flagOf?.(record) ?? undefined,
                url: `${PLAYLIST_BASE}/${pathSegment}/${code.toLowerCase()}.m3u`,
                streamCount,
            };
        })
        .filter((entry) => entry.streamCount >= MIN_STREAMS_PER_ENTRY)
        .sort(
            (a, b) =>
                b.streamCount - a.streamCount || a.name.localeCompare(b.name)
        );
}

async function headOk(url) {
    try {
        // GitHub Pages answers HEAD, but a redirect to a CDN sometimes does
        // not; a ranged GET is the reliable probe and still downloads nothing.
        const response = await fetch(url, {
            headers: { Range: 'bytes=0-64' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return response.ok || response.status === 206;
    } catch {
        return false;
    }
}

function serialize(entries) {
    const rows = entries
        .map(
            (entry) =>
                `    {\n` +
                `        id: ${JSON.stringify(entry.id)},\n` +
                `        kind: ${JSON.stringify(entry.kind)},\n` +
                `        code: ${JSON.stringify(entry.code)},\n` +
                `        name: ${JSON.stringify(entry.name)},\n` +
                (entry.flag
                    ? `        flag: ${JSON.stringify(entry.flag)},\n`
                    : '') +
                `        url: ${JSON.stringify(entry.url)},\n` +
                `        streamCount: ${entry.streamCount},\n` +
                `    },`
        )
        .join('\n');

    return `/* eslint-disable max-lines -- generated snapshot of the public iptv-org catalogue */
// GENERATED FILE — do not edit by hand.
// Regenerate with: node tools/channel-sources/build-catalog.mjs
// Snapshot taken: ${new Date().toISOString().slice(0, 10)}
import type { GeneratedChannelSource } from './channel-source.model';

export const GENERATED_CHANNEL_SOURCES: readonly GeneratedChannelSource[] = [
${rows}
];
`;
}

async function main() {
    const checkOnly = process.argv.includes('--check');

    const [
        countries,
        categories,
        languages,
        regions,
        channels,
        streams,
        feeds,
    ] = await Promise.all([
        fetchJson('countries'),
        fetchJson('categories'),
        fetchJson('languages'),
        fetchJson('regions'),
        fetchJson('channels'),
        fetchJson('streams'),
        fetchJson('feeds'),
    ]);

    const counts = indexStreams({ streams, channels, feeds });

    const entries = [
        ...buildEntries(counts.countries, {
            list: countries,
            kind: 'country',
            pathSegment: 'countries',
            nameOf: (record) => record.name,
            codeOf: (record) => record.code,
            flagOf: (record) => record.flag,
        }),
        ...buildEntries(counts.regions, {
            list: regions,
            kind: 'region',
            pathSegment: 'regions',
            nameOf: (record) => record.name,
            codeOf: (record) => record.code,
        }),
        ...buildEntries(counts.categories, {
            list: categories,
            kind: 'category',
            pathSegment: 'categories',
            nameOf: (record) => record.name,
            codeOf: (record) => record.id,
        }),
        ...buildEntries(counts.languages, {
            list: languages,
            kind: 'language',
            pathSegment: 'languages',
            nameOf: (record) => record.name,
            codeOf: (record) => record.code,
        }),
    ];

    console.log(
        `Built ${entries.length} entries ` +
            `(${entries.filter((e) => e.kind === 'country').length} countries, ` +
            `${entries.filter((e) => e.kind === 'region').length} regions, ` +
            `${entries.filter((e) => e.kind === 'category').length} categories, ` +
            `${entries.filter((e) => e.kind === 'language').length} languages)`
    );

    if (checkOnly) {
        const sample = entries.filter((_, index) => index % 7 === 0);
        const results = await Promise.all(
            sample.map(async (entry) => ({
                entry,
                ok: await headOk(entry.url),
            }))
        );
        const dead = results.filter((result) => !result.ok);
        for (const { entry } of dead) {
            console.error(`DEAD ${entry.id} -> ${entry.url}`);
        }
        console.log(`Checked ${sample.length} urls, ${dead.length} dead.`);
        process.exitCode = dead.length > 0 ? 1 : 0;
        return;
    }

    await writeFile(OUTPUT, serialize(entries), 'utf8');
    console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
