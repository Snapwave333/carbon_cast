import { Injectable } from '@angular/core';
import { PodcastShow } from './radio.types';

/**
 * Client for Apple's public podcast directory. Both endpoints used here are
 * open: no key, no signup, no authentication.
 *
 * - `itunes.apple.com/search` / `lookup` — catalogue metadata, including the
 *   show's own RSS `feedUrl`, which is what the episode list is built from.
 * - `itunes.apple.com/{country}/rss/toppodcasts/...` — the public top-charts
 *   feed, used to fill the Podcasts tab before the user types anything. It
 *   only returns collection ids, so the ids are resolved through `lookup`.
 *
 * Apple throttles at roughly 20 requests per minute per address, so callers
 * must debounce searches rather than fire per keystroke.
 */

const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const REQUEST_TIMEOUT_MS = 12_000;
/** Apple truncates very long id lists; resolve top charts in batches. */
const LOOKUP_BATCH_SIZE = 25;

interface RawCollection {
    collectionId?: number;
    trackId?: number;
    collectionName?: string;
    trackName?: string;
    artistName?: string;
    feedUrl?: string;
    artworkUrl600?: string;
    artworkUrl100?: string;
    artworkUrl60?: string;
    genres?: string[];
    primaryGenreName?: string;
    trackCount?: number;
    collectionViewUrl?: string;
    description?: string;
}

interface RawSearchResponse {
    results?: RawCollection[];
}

interface RawChartEntry {
    id?: { attributes?: { ['im:id']?: string } };
}

interface RawChartResponse {
    feed?: { entry?: RawChartEntry[] | RawChartEntry };
}

export interface PodcastSearchOptions {
    limit?: number;
    /** ISO country code scoping the catalogue; defaults to `US`. */
    country?: string;
}

export function normalizePodcastShow(
    raw: RawCollection
): PodcastShow | null {
    const feedUrl = (raw.feedUrl ?? '').trim();
    const id = String(raw.collectionId ?? raw.trackId ?? '').trim();
    const title = (raw.collectionName ?? raw.trackName ?? '').trim();
    if (!feedUrl || !title) {
        return null;
    }

    const genres = raw.genres?.filter(Boolean) ?? [];
    if (genres.length === 0 && raw.primaryGenreName) {
        genres.push(raw.primaryGenreName);
    }

    return {
        id: id || feedUrl,
        title,
        author: (raw.artistName ?? '').trim(),
        feedUrl,
        artwork:
            raw.artworkUrl600 ?? raw.artworkUrl100 ?? raw.artworkUrl60 ?? '',
        genres,
        episodeCount: typeof raw.trackCount === 'number' ? raw.trackCount : null,
        description: (raw.description ?? '').trim(),
        websiteUrl: raw.collectionViewUrl ?? '',
    };
}

@Injectable({ providedIn: 'root' })
export class PodcastDirectoryService {
    async search(
        term: string,
        options: PodcastSearchOptions = {}
    ): Promise<PodcastShow[]> {
        const query = term.trim();
        if (!query) {
            return [];
        }

        const response = await fetchJson<RawSearchResponse>(
            `${SEARCH_URL}?${new URLSearchParams({
                term: query,
                media: 'podcast',
                entity: 'podcast',
                limit: String(options.limit ?? 50),
                country: options.country ?? 'US',
            })}`
        );

        return toShows(response.results ?? []);
    }

    async lookup(collectionId: string): Promise<PodcastShow | null> {
        const shows = await this.lookupMany([collectionId]);
        return shows[0] ?? null;
    }

    async lookupMany(collectionIds: readonly string[]): Promise<PodcastShow[]> {
        const ids = collectionIds.map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0) {
            return [];
        }

        const batches: string[][] = [];
        for (let index = 0; index < ids.length; index += LOOKUP_BATCH_SIZE) {
            batches.push(ids.slice(index, index + LOOKUP_BATCH_SIZE));
        }

        const responses = await Promise.all(
            batches.map((batch) =>
                fetchJson<RawSearchResponse>(
                    `${LOOKUP_URL}?${new URLSearchParams({
                        id: batch.join(','),
                        entity: 'podcast',
                    })}`
                )
            )
        );

        const collected: RawCollection[] = [];
        for (const response of responses) {
            collected.push(...(response.results ?? []));
        }
        const shows = toShows(collected);

        // Preserve the caller's ordering — top charts arrive ranked.
        const byId = new Map(shows.map((show) => [show.id, show]));
        return ids
            .map((id) => byId.get(id))
            .filter((show): show is PodcastShow => show !== undefined);
    }

    /**
     * Apple's public top-podcasts chart for a country. Returns shows with a
     * usable `feedUrl`; entries Apple no longer resolves are dropped.
     */
    async topShows(limit = 40, country = 'us'): Promise<PodcastShow[]> {
        const safeCountry = /^[a-z]{2}$/i.test(country) ? country : 'us';
        const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
        const response = await fetchJson<RawChartResponse>(
            `https://itunes.apple.com/${safeCountry.toLowerCase()}/rss/toppodcasts/limit=${safeLimit}/json`
        );

        const entries = response.feed?.entry;
        const list = Array.isArray(entries)
            ? entries
            : entries
              ? [entries]
              : [];
        const ids = list
            .map((entry) => entry.id?.attributes?.['im:id'] ?? '')
            .filter(Boolean);

        return this.lookupMany(ids);
    }
}

function toShows(raw: readonly RawCollection[]): PodcastShow[] {
    const seen = new Set<string>();
    const shows: PodcastShow[] = [];

    for (const entry of raw) {
        const show = normalizePodcastShow(entry);
        if (!show || seen.has(show.id)) {
            continue;
        }
        seen.add(show.id);
        shows.push(show);
    }

    return shows;
}

async function fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(
                `iTunes request failed: ${response.status} ${response.statusText}`.trim()
            );
        }

        // The chart endpoint answers `text/javascript`, which `Response.json()`
        // still parses, but Safari-style empty bodies would not — guard both.
        const text = await response.text();
        if (!text.trim()) {
            throw new Error('iTunes request returned an empty response');
        }
        return JSON.parse(text) as T;
    } finally {
        clearTimeout(timeout);
    }
}
