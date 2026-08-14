import { Injectable } from '@angular/core';
import {
    RadioFacet,
    RadioStation,
    RadioStationQuery,
} from './radio.types';

/**
 * Client for the Radio Browser community catalogue
 * (https://api.radio-browser.info). The API is public: no key, no signup, no
 * authentication, and it sends `Access-Control-Allow-Origin: *`, so the same
 * code path works in the Electron renderer and in the PWA.
 *
 * Radio Browser is a set of independently operated mirrors. `all.api` is a
 * round-robin DNS record over them, which is fine as a bootstrap but goes dark
 * whenever the machine it resolved to is down — so the client discovers the
 * live mirror list once, then fails over between mirrors per request and
 * remembers whichever one answered.
 */

const MIRROR_DIRECTORY_URL = 'https://all.api.radio-browser.info/json/servers';

/** Used until directory discovery succeeds, and whenever it fails. */
const FALLBACK_MIRRORS = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
    'https://fi1.api.radio-browser.info',
] as const;

const REQUEST_TIMEOUT_MS = 12_000;
const FACET_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_STATION_LIMIT = 60;

interface RawStation {
    stationuuid?: string;
    name?: string;
    url?: string;
    url_resolved?: string;
    homepage?: string;
    favicon?: string;
    tags?: string;
    country?: string;
    countrycode?: string;
    language?: string;
    codec?: string;
    bitrate?: number;
    votes?: number;
    clickcount?: number;
    hls?: number;
    lastcheckok?: number;
}

interface RawFacet {
    name?: string;
    iso_3166_1?: string;
    stationcount?: number;
}

interface RawMirror {
    name?: string;
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

function splitList(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
        const swapWith = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
    }
    return copy;
}

export function normalizeStation(raw: RawStation): RadioStation | null {
    const streamUrl = (raw.url_resolved || raw.url || '').trim();
    const id = (raw.stationuuid ?? '').trim();
    if (!id || !streamUrl) {
        return null;
    }

    return {
        id,
        name: (raw.name ?? '').trim() || streamUrl,
        streamUrl,
        homepage: raw.homepage ?? '',
        favicon: raw.favicon ?? '',
        tags: splitList(raw.tags),
        country: raw.country ?? '',
        countryCode: raw.countrycode ?? '',
        languages: splitList(raw.language),
        codec: raw.codec ?? '',
        bitrate: raw.bitrate ?? 0,
        votes: raw.votes ?? 0,
        clickCount: raw.clickcount ?? 0,
        isHls: raw.hls === 1,
        isOnline: raw.lastcheckok !== 0,
    };
}

function normalizeFacet(raw: RawFacet): RadioFacet | null {
    const name = (raw.name ?? '').trim();
    if (!name) {
        return null;
    }

    return {
        name,
        code: raw.iso_3166_1 ?? '',
        stationCount: raw.stationcount ?? 0,
    };
}

@Injectable({ providedIn: 'root' })
export class RadioBrowserService {
    private mirrors: string[] = shuffle(FALLBACK_MIRRORS);
    private mirrorDiscovery: Promise<void> | null = null;
    private readonly facetCache = new Map<string, CacheEntry<RadioFacet[]>>();

    async searchStations(query: RadioStationQuery): Promise<RadioStation[]> {
        const params: Record<string, string> = {
            hidebroken: 'true',
            limit: String(query.limit ?? DEFAULT_STATION_LIMIT),
            offset: String(query.offset ?? 0),
            order: query.order ?? 'clickcount',
            reverse: String(query.reverse ?? true),
        };

        if (query.name) params['name'] = query.name;
        if (query.country) params['country'] = query.country;
        if (query.countryCode) params['countrycode'] = query.countryCode;
        if (query.language) params['language'] = query.language;
        if (query.tag) params['tag'] = query.tag;

        const stations = await this.request<RawStation[]>(
            '/json/stations/search',
            params
        );
        return this.toStations(stations);
    }

    /** Highest-voted stations overall — the default "browse" view. */
    async topStations(limit = DEFAULT_STATION_LIMIT): Promise<RadioStation[]> {
        return this.toStations(
            await this.request<RawStation[]>(`/json/stations/topvote/${limit}`)
        );
    }

    /** Most-tuned-in stations right now. */
    async trendingStations(
        limit = DEFAULT_STATION_LIMIT
    ): Promise<RadioStation[]> {
        return this.toStations(
            await this.request<RawStation[]>(`/json/stations/topclick/${limit}`)
        );
    }

    async stationsByIds(ids: readonly string[]): Promise<RadioStation[]> {
        if (ids.length === 0) {
            return [];
        }

        const stations = await this.request<RawStation[]>(
            '/json/stations/byuuid',
            { uuids: ids.join(',') }
        );
        return this.toStations(stations);
    }

    async countries(): Promise<RadioFacet[]> {
        return this.facets('countries', '/json/countries');
    }

    async languages(): Promise<RadioFacet[]> {
        return this.facets('languages', '/json/languages');
    }

    async tags(limit = 150): Promise<RadioFacet[]> {
        return this.facets(`tags:${limit}`, '/json/tags', {
            order: 'stationcount',
            reverse: 'true',
            limit: String(limit),
            hidebroken: 'true',
        });
    }

    /**
     * Tells Radio Browser a station was tuned in, which is what feeds its
     * popularity ranking back. Best effort: a failure here must never stop
     * playback, so the promise always resolves.
     */
    async reportStationClick(stationId: string): Promise<void> {
        if (!stationId) {
            return;
        }

        try {
            await this.request(`/json/url/${encodeURIComponent(stationId)}`);
        } catch {
            // The catalogue's play counter is not worth surfacing an error for.
        }
    }

    private toStations(raw: readonly RawStation[]): RadioStation[] {
        const seen = new Set<string>();
        const stations: RadioStation[] = [];

        for (const entry of raw) {
            const station = normalizeStation(entry);
            if (!station || seen.has(station.id)) {
                continue;
            }
            seen.add(station.id);
            stations.push(station);
        }

        return stations;
    }

    private async facets(
        cacheKey: string,
        path: string,
        params?: Record<string, string>
    ): Promise<RadioFacet[]> {
        const cached = this.facetCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const raw = await this.request<RawFacet[]>(path, params);
        const facets = raw
            .map(normalizeFacet)
            .filter((facet): facet is RadioFacet => facet !== null)
            .filter((facet) => facet.stationCount > 0);

        this.facetCache.set(cacheKey, {
            value: facets,
            expiresAt: Date.now() + FACET_CACHE_TTL_MS,
        });
        return facets;
    }

    /**
     * Runs a request against the mirrors in order, promoting whichever one
     * answers to the front so subsequent calls hit it first.
     */
    private async request<T>(
        path: string,
        params?: Record<string, string>
    ): Promise<T> {
        await this.ensureMirrorsDiscovered();

        const search = params ? `?${new URLSearchParams(params)}` : '';
        let lastError: unknown = new Error('No Radio Browser mirror available');

        for (const mirror of [...this.mirrors]) {
            try {
                const payload = await fetchJson<T>(`${mirror}${path}${search}`);
                this.promoteMirror(mirror);
                return payload;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }

    private promoteMirror(mirror: string): void {
        if (this.mirrors[0] === mirror) {
            return;
        }
        this.mirrors = [
            mirror,
            ...this.mirrors.filter((entry) => entry !== mirror),
        ];
    }

    private ensureMirrorsDiscovered(): Promise<void> {
        this.mirrorDiscovery ??= this.discoverMirrors();
        return this.mirrorDiscovery;
    }

    private async discoverMirrors(): Promise<void> {
        try {
            const raw = await fetchJson<RawMirror[]>(MIRROR_DIRECTORY_URL);
            const discovered = raw
                .map((entry) => (entry.name ?? '').trim())
                .filter(Boolean)
                .map((name) => `https://${name}`);

            if (discovered.length > 0) {
                this.mirrors = shuffle(discovered);
            }
        } catch {
            // Keep the built-in mirror list; it is refreshed on the next boot.
        }
    }
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
                `Radio Browser request failed: ${response.status} ${response.statusText}`.trim()
            );
        }

        return (await response.json()) as T;
    } finally {
        clearTimeout(timeout);
    }
}
