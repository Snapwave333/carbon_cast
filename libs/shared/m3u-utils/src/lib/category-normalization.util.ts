/**
 * Canonical category derivation for M3U `group-title` values.
 *
 * M3U group titles arrive in inconsistent casing and spacing ("Animation",
 * "ANIMATION", " Animation ") and a single channel can declare several groups
 * joined by `;` ("Animation;Kids"). Using the raw string as the grouping key
 * splits all of these into separate categories. These helpers derive a stable
 * canonical key for grouping and hidden-group matching while keeping a clean,
 * human-readable first-seen display label.
 */

/**
 * Conservative alias map, applied after lower-casing, that folds well-known
 * synonyms onto one canonical key. Keep this tiny — every entry silently merges
 * two labels for every user.
 */
const CATEGORY_KEY_ALIASES: Readonly<Record<string, string>> = {
    anime: 'animation',
};

/** Display label for the bucket that collects channels without a group. */
const UNCATEGORIZED_LABEL = 'Uncategorized';

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
 * empties are dropped and buckets are de-duplicated by canonical key, keeping
 * the first-seen display label per key. An empty or missing title yields a
 * single `{ key: '', label: 'Uncategorized' }` bucket, matching the app's
 * existing empty-group (`''`) behavior.
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
        if (!buckets.has(key)) {
            buckets.set(key, { key, label });
        }
    }

    if (buckets.size === 0) {
        return [{ key: '', label: UNCATEGORIZED_LABEL }];
    }

    return Array.from(buckets.values());
}
