const CHANNEL_SORT_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});

/**
 * Shared by the M3U channel list and the portal channel lists. `server` keeps
 * whatever order the source delivered — the playlist file or the portal API.
 */
export type ChannelSortMode = 'server' | 'name-asc' | 'name-desc';

export const DEFAULT_CHANNEL_SORT_MODE: ChannelSortMode = 'server';

/**
 * Label keys for `server`. The mode is the same, but the wording is not: an
 * M3U list is in playlist order, a portal list is in the order the server sent.
 */
export const PLAYLIST_ORDER_LABEL_KEY = 'CHANNELS.SORT_PLAYLIST_ORDER';
export const SERVER_ORDER_LABEL_KEY = 'CHANNELS.SORT_SERVER_ORDER';

export function isChannelSortMode(value: unknown): value is ChannelSortMode {
    return value === 'server' || value === 'name-asc' || value === 'name-desc';
}

/**
 * Reads the stored mode. Callers restore from a field initializer, so a
 * throwing `localStorage` (blocked storage, sandboxed origin) must cost the
 * preference rather than the whole list.
 */
export function restoreChannelSortMode(
    storageKey: string,
    fallback: ChannelSortMode = DEFAULT_CHANNEL_SORT_MODE
): ChannelSortMode {
    try {
        const storedValue = localStorage.getItem(storageKey);
        return isChannelSortMode(storedValue) ? storedValue : fallback;
    } catch {
        return fallback;
    }
}

export function persistChannelSortMode(
    storageKey: string,
    mode: ChannelSortMode
): void {
    try {
        localStorage.setItem(storageKey, mode);
    } catch {
        // Preference is best-effort; sorting still applies for this session.
    }
}

/** Translation key for the mode, for use with the `translate` pipe. */
export function getChannelSortModeLabelKey(
    mode: ChannelSortMode,
    serverOrderLabelKey: string = PLAYLIST_ORDER_LABEL_KEY
): string {
    if (mode === 'name-asc') {
        return 'CHANNELS.SORT_NAME_ASC';
    }

    if (mode === 'name-desc') {
        return 'CHANNELS.SORT_NAME_DESC';
    }

    return serverOrderLabelKey;
}

/** Returns the original array reference in `server` mode, so large lists avoid cloning. */
export function sortChannelItems<T>(
    items: readonly T[],
    mode: ChannelSortMode,
    getDisplayName: (item: T) => string | null | undefined
): readonly T[] {
    if (mode === 'server') {
        return items;
    }

    return [...items].sort((a, b) => {
        const result = CHANNEL_SORT_COLLATOR.compare(
            getDisplayName(a) ?? '',
            getDisplayName(b) ?? ''
        );
        return mode === 'name-asc' ? result : -result;
    });
}
