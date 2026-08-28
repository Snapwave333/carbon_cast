import type { Channel } from '@iptvnator/shared/interfaces';

/**
 * Canonical category derivation for M3U `group-title` values.
 *
 * The provider's `group-title` is authoritative: the playlist author knows
 * which group a channel belongs to, and second-guessing that from the channel
 * name scatters coherent provider groups across wrong buckets ("USA" torn into
 * News/Sports/Kids by regex, ABC/CBS/NBC landing in News, ...). These helpers
 * therefore keep the provider's taxonomy and only normalize its *form*:
 * casing and whitespace variants ("Animation", "ANIMATION", " Animation ")
 * fold onto one canonical key, a channel can declare several groups joined by
 * `;` ("Animation;Kids"), and true placeholder titles (empty, "undefined",
 * "none", ...) collapse into a single Uncategorized bucket. Geographic and
 * generic titles ("USA", "International", "Local", "General", "Series") are
 * real provider groups and are kept verbatim.
 */

/**
 * Conservative alias map, applied after lower-casing, that folds well-known
 * synonyms onto one canonical key. Keep this tiny — every entry silently merges
 * two labels for every user.
 */
const CATEGORY_KEY_ALIASES: Readonly<Record<string, string>> = {
    anime: 'animation',
};

/**
 * Group titles that carry no taxonomy information — placeholder exports from
 * playlist generators, not real provider groups. Geographic or generic titles
 * ("USA", "General", "Local") are deliberately NOT here: they are the
 * provider's chosen groups and stay intact.
 */
const PLACEHOLDER_CATEGORY_KEYS = new Set([
    '',
    'undefined',
    'uncategorized',
    'none',
    'null',
    'n/a',
    'na',
]);

const UNCATEGORIZED_CATEGORY: CanonicalCategory = {
    key: 'uncategorized',
    label: 'Uncategorized',
};

export interface CanonicalCategory {
    /** Stable grouping/hiding key (lower-cased, alias-folded). */
    readonly key: string;
    /** First-seen human-readable label for display. */
    readonly label: string;
}

/**
 * Trim surrounding whitespace and collapse internal whitespace runs to a single
 * space. An empty (or whitespace-only) input stays empty.
 */
export function canonicalizeCategoryLabel(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Canonical grouping/hiding key for a raw category label: the canonicalized
 * label, lower-cased, with the conservative alias map applied. Empty stays
 * empty.
 */
export function canonicalCategoryKey(raw: string): string {
    const normalized = canonicalizeCategoryLabel(raw).toLowerCase();
    return CATEGORY_KEY_ALIASES[normalized] ?? normalized;
}

/**
 * Expand a raw M3U `group-title` into its canonical category buckets.
 *
 * Splits on `;` only — the M3U multi-group delimiter — never on comma, which is
 * a legitimate character inside a group name. Each part is canonicalized;
 * empty and placeholder parts are dropped and buckets are de-duplicated by
 * canonical key, keeping the first-seen display label per key. An empty,
 * missing, or placeholder-only title yields no bucket here;
 * `resolveChannelCategories` maps that to the Uncategorized fallback.
 */
export function expandChannelCategories(
    rawGroupTitle: string | undefined
): CanonicalCategory[] {
    const buckets = new Map<string, CanonicalCategory>();

    for (const part of (rawGroupTitle ?? '').split(';')) {
        const label = canonicalizeCategoryLabel(part);
        if (!label) {
            continue;
        }

        const key = canonicalCategoryKey(part);
        if (PLACEHOLDER_CATEGORY_KEYS.has(key)) {
            continue;
        }
        if (!buckets.has(key)) {
            buckets.set(key, { key, label });
        }
    }

    return Array.from(buckets.values());
}

/**
 * Resolve the categories displayed for one channel. The provider's
 * `group-title` is authoritative and is never re-classified from the channel
 * name; only a channel with no usable group title at all lands in the single
 * Uncategorized fallback bucket.
 */
export function resolveChannelCategories(
    channel: Pick<Channel, 'group'>
): CanonicalCategory[] {
    const categories = expandChannelCategories(channel.group?.title);
    return categories.length > 0 ? categories : [UNCATEGORIZED_CATEGORY];
}

function addCountryCodes(target: Set<string>, value: string | undefined): void {
    for (const token of (value ?? '').split(/[;,\s]+/)) {
        const code = token.trim().toLowerCase();
        if (/^[a-z]{2}$/.test(code)) {
            target.add(code);
        }
    }
}

/** Extract country codes from `tvg-country` and the standard `name.us@HD` ID. */
export function getChannelCountryCodes(
    channel: Pick<Channel, 'raw' | 'tvg'>
): string[] {
    const countries = new Set<string>();
    const raw = channel.raw ?? '';
    const countryAttribute =
        /\btvg-country\s*=\s*("([^"]*)"|'([^']*)'|([^\s,]+))/gi;

    for (const match of raw.matchAll(countryAttribute)) {
        addCountryCodes(countries, match[2] ?? match[3] ?? match[4]);
    }

    const tvgId = channel.tvg?.id ?? '';
    const countryFromId = /\.([a-z]{2})(?:@|$)/i.exec(tvgId)?.[1];
    if (countryFromId) {
        countries.add(countryFromId.toLowerCase());
    }

    return Array.from(countries);
}

/** True only when playlist metadata positively identifies a non-U.S. channel. */
export function isExplicitlyNonUsChannel(
    channel: Pick<Channel, 'raw' | 'tvg'>
): boolean {
    const countries = getChannelCountryCodes(channel);
    return countries.length > 0 && !countries.includes('us');
}
