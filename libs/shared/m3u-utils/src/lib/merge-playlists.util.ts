import {
    ParsedPlaylist,
    ParsedPlaylistItem,
} from '@iptvnator/shared/interfaces';

/**
 * Combines several parsed M3U playlists into one.
 *
 * Merging matters because the free-channel catalogue is sliced by country and
 * by category: a viewer who wants "UK + Ireland + news" ends up with three
 * playlists, three sidebars and three EPG fetches for what is one viewing
 * habit. Merging produces a single playlist whose channels sit side by side.
 *
 * The same stream genuinely does appear in several of those slices — a UK news
 * channel is in both `uk.m3u` and `news.m3u` — so a merge without dedup would
 * show it twice with no way to tell the copies apart.
 */

export interface PlaylistMergeSource {
    /** Human-readable origin, used for the optional group prefix. */
    readonly label: string;
    readonly playlist: ParsedPlaylist;
}

export interface PlaylistMergeOptions {
    /**
     * Prefixes every group title with the source label (`"UK · News"`), which
     * keeps the groups view navigable when the sources overlap heavily.
     */
    readonly prefixGroupsWithSource?: boolean;
    /**
     * Hard cap on the merged item count. A merge of several country lists can
     * run to six figures, and the renderer has to hold every item in memory;
     * the cap turns "the app froze" into a reported, explainable truncation.
     */
    readonly maxItems?: number;
}

export interface PlaylistMergeResult {
    readonly playlist: ParsedPlaylist;
    /** Items dropped because an identical stream URL was already present. */
    readonly duplicateCount: number;
    /** Items dropped because {@link PlaylistMergeOptions.maxItems} was hit. */
    readonly truncatedCount: number;
    /** Per-source contribution after dedup, in source order. */
    readonly acceptedBySource: readonly number[];
}

/** Ceiling used when the caller does not supply one. */
export const DEFAULT_MERGE_ITEM_LIMIT = 250_000;

const EPG_HEADER_ATTR = 'x-tvg-url';

export function mergeParsedPlaylists(
    sources: readonly PlaylistMergeSource[],
    options: PlaylistMergeOptions = {}
): PlaylistMergeResult {
    const maxItems = options.maxItems ?? DEFAULT_MERGE_ITEM_LIMIT;
    const seenUrls = new Set<string>();
    const items: ParsedPlaylistItem[] = [];
    const acceptedBySource: number[] = [];

    let duplicateCount = 0;
    let truncatedCount = 0;

    for (const source of sources) {
        let accepted = 0;

        for (const item of source.playlist?.items ?? []) {
            const dedupeKey = normalizeStreamUrl(item.url);

            // An entry with no URL cannot be played and cannot be compared,
            // so it is dropped rather than counted as a duplicate.
            if (!dedupeKey) {
                continue;
            }

            if (seenUrls.has(dedupeKey)) {
                duplicateCount++;
                continue;
            }

            if (items.length >= maxItems) {
                truncatedCount++;
                continue;
            }

            seenUrls.add(dedupeKey);
            items.push(
                options.prefixGroupsWithSource
                    ? withPrefixedGroup(item, source.label)
                    : item
            );
            accepted++;
        }

        acceptedBySource.push(accepted);
    }

    return {
        playlist: {
            header: mergeHeaders(sources),
            items,
        },
        duplicateCount,
        truncatedCount,
        acceptedBySource,
    };
}

/**
 * Collapses the cosmetic differences between two spellings of one stream URL.
 *
 * Aggregators re-publish each other, so the same stream arrives as `HTTP://`
 * from one list and `http://` from another, with or without a trailing slash.
 * Only the scheme and host are case-folded: the path and query of a stream URL
 * are frequently case-sensitive tokens, and lowercasing them breaks playback.
 */
export function normalizeStreamUrl(url: string | undefined): string {
    const trimmed = url?.trim();
    if (!trimmed) {
        return '';
    }

    try {
        const parsed = new URL(trimmed);
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
    } catch {
        // Relative or malformed URLs keep their literal form; they still
        // deduplicate against an identical copy from another source.
        return trimmed.replace(/\/+$/, '');
    }
}

function withPrefixedGroup(
    item: ParsedPlaylistItem,
    label: string
): ParsedPlaylistItem {
    const existing = item.group?.title?.trim();
    return {
        ...item,
        group: {
            ...item.group,
            title: existing ? `${label} · ${existing}` : label,
        },
    };
}

/**
 * Builds one header for the merged playlist.
 *
 * The header's only load-bearing content is the EPG URL list, and every source
 * carries its own. Dropping the others would silently strip the guide from all
 * but the first slice, so they are unioned into a single `x-tvg-url`.
 */
function mergeHeaders(
    sources: readonly PlaylistMergeSource[]
): ParsedPlaylist['header'] {
    const attrs: Record<string, string | undefined> = {};
    const epgUrls = new Set<string>();

    for (const source of sources) {
        const header = source.playlist?.header;
        for (const [key, value] of Object.entries(header?.attrs ?? {})) {
            if (key.toLowerCase() === EPG_HEADER_ATTR) {
                for (const url of splitEpgAttribute(value)) {
                    epgUrls.add(url);
                }
                continue;
            }
            if (value !== undefined && attrs[key] === undefined) {
                attrs[key] = value;
            }
        }
    }

    if (epgUrls.size > 0) {
        attrs[EPG_HEADER_ATTR] = Array.from(epgUrls).join(',');
    }

    const raw = Object.entries(attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

    return {
        attrs,
        raw: raw ? `#EXTM3U ${raw}` : '#EXTM3U',
    };
}

function splitEpgAttribute(value: string | undefined): string[] {
    return (value ?? '')
        .split(/[,\s]+/)
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
}
