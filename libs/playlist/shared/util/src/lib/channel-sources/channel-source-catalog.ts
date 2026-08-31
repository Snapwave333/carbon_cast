import { GENERATED_CHANNEL_SOURCES } from './channel-source-catalog.data';
import { FEATURED_CHANNEL_SOURCES } from './channel-source-featured';
import {
    CHANNEL_SOURCE_PROVIDERS,
    ChannelSource,
    ChannelSourceKind,
} from './channel-source.model';

/**
 * The full catalogue: curated entries first, then the generated slices in
 * descending stream count, so the first screenful is always worth importing.
 */
export const CHANNEL_SOURCE_CATALOG: readonly ChannelSource[] = [
    ...FEATURED_CHANNEL_SOURCES,
    ...GENERATED_CHANNEL_SOURCES.map((entry): ChannelSource => ({
        ...entry,
        provider: CHANNEL_SOURCE_PROVIDERS.iptvOrg,
    })),
];

const CATALOG_BY_ID = new Map(
    CHANNEL_SOURCE_CATALOG.map((source) => [source.id, source])
);

export function findChannelSource(id: string): ChannelSource | undefined {
    return CATALOG_BY_ID.get(id);
}

export function findChannelSources(ids: readonly string[]): ChannelSource[] {
    const seen = new Set<string>();
    const sources: ChannelSource[] = [];

    for (const id of ids) {
        if (seen.has(id)) {
            continue;
        }
        const source = CATALOG_BY_ID.get(id);
        if (source) {
            seen.add(id);
            sources.push(source);
        }
    }

    return sources;
}

export interface ChannelSourceFilter {
    readonly query?: string;
    readonly kinds?: readonly ChannelSourceKind[];
}

/**
 * Filters the catalogue for the Discover list.
 *
 * The query matches the name, the code and the provider, because a viewer
 * looking for British channels types "uk", "united kingdom" or "gb" with equal
 * likelihood — and `gb` is the ISO code while iptv-org files the slice under
 * `uk`, so both have to hit.
 */
export function filterChannelSources(
    sources: readonly ChannelSource[],
    filter: ChannelSourceFilter
): ChannelSource[] {
    const kinds = filter.kinds?.length ? new Set(filter.kinds) : undefined;
    const terms = tokenize(filter.query);

    return sources.filter((source) => {
        if (kinds && !kinds.has(source.kind)) {
            return false;
        }
        if (terms.length === 0) {
            return true;
        }

        const haystack = searchTextFor(source);
        return terms.every((term) => haystack.includes(term));
    });
}

const SEARCH_TEXT_CACHE = new WeakMap<ChannelSource, string>();

function searchTextFor(source: ChannelSource): string {
    // Every keystroke re-filters 300+ entries; building the haystack once per
    // source keeps that to a set of substring checks.
    const cached = SEARCH_TEXT_CACHE.get(source);
    if (cached !== undefined) {
        return cached;
    }

    const text = [source.name, source.code, source.provider.name, source.kind]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLowerCase();

    SEARCH_TEXT_CACHE.set(source, text);
    return text;
}

function tokenize(query: string | undefined): string[] {
    return (query ?? '')
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 0);
}

/**
 * Total streams across a selection, used to warn before an import that will
 * take minutes and hold six figures of channels in memory.
 */
export function totalStreamCount(sources: readonly ChannelSource[]): number {
    return sources.reduce((total, source) => total + source.streamCount, 0);
}
