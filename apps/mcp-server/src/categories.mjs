// Canonical category normalization — mirrors the Phase 4 dedup design so that
// "Animation", "ANIMATION", " Animation ", "Anime" and "Animation;Kids" collapse
// into stable canonical buckets instead of many near-duplicate groups.

const ALIASES = {
    anime: 'animation',
    'animation ': 'animation',
    kids: 'kids',
    'kids & family': 'kids',
    docs: 'documentary',
    documentaries: 'documentary',
    sport: 'sports',
    news24: 'news',
};

export function canonicalLabel(raw) {
    return String(raw ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

export function canonicalKey(raw) {
    const label = canonicalLabel(raw).toLowerCase();
    return ALIASES[label] ?? label;
}

// Split a possibly multi-group title ("Animation;Kids") into canonical parts.
export function expandCategories(rawGroupTitle) {
    const label = canonicalLabel(rawGroupTitle);
    if (!label) return [{ key: '', label: 'Uncategorized' }];
    const seen = new Map();
    for (const part of label.split(';')) {
        const l = canonicalLabel(part);
        if (!l) continue;
        const k = canonicalKey(l);
        if (!seen.has(k)) seen.set(k, l);
    }
    if (seen.size === 0) return [{ key: '', label: 'Uncategorized' }];
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
}
