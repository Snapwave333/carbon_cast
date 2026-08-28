/**
 * Maps a canonical category key (lower-cased, trimmed — see
 * category-normalization.util in @iptvnator/shared/m3u-utils) to a glyph from
 * the app's custom SVG icon set. Exact matches first, then keyword hints so
 * arbitrary playlist taxonomies ("us sports hd", "kids & family") still get a
 * sensible icon. Falls back to a folder.
 */
const EXACT: Record<string, string> = {
    '': 'tag',
    animation: 'sparkles',
    anime: 'sparkles',
    auto: 'car',
    business: 'briefcase',
    classic: 'film_strip',
    comedy: 'mask',
    cooking: 'cooking_pot',
    culture: 'palette',
    documentary: 'videocam',
    education: 'grad_cap',
    entertainment: 'ticket',
    family: 'family',
    general: 'grid_view',
    kids: 'balloon',
    legislative: 'landmark',
    lifestyle: 'leaf',
    movies: 'movie',
    music: 'music_note',
    news: 'newspaper',
    outdoor: 'mountains',
    radio: 'radio',
    relax: 'crescent',
    religious: 'church',
    science: 'flask',
    series: 'video_library',
    shop: 'cart',
    sports: 'ball',
    travel: 'plane',
    uncategorized: 'tag',
    undefined: 'tag',
    weather: 'sun_cloud',
};

const KEYWORDS: [string, string][] = [
    ['sport', 'ball'],
    ['news', 'newspaper'],
    ['movie', 'movie'],
    ['film', 'movie'],
    ['cine', 'movie'],
    ['music', 'music_note'],
    ['kid', 'balloon'],
    ['child', 'balloon'],
    ['anim', 'sparkles'],
    ['cartoon', 'sparkles'],
    ['series', 'video_library'],
    ['show', 'video_library'],
    ['doc', 'videocam'],
    ['relig', 'church'],
    ['faith', 'church'],
    ['comedy', 'mask'],
    ['cook', 'cooking_pot'],
    ['food', 'cooking_pot'],
    ['travel', 'plane'],
    ['weather', 'sun_cloud'],
    ['radio', 'radio'],
    ['educat', 'grad_cap'],
    ['school', 'grad_cap'],
    ['science', 'flask'],
    ['tech', 'flask'],
    ['shop', 'cart'],
    ['business', 'briefcase'],
    ['finance', 'briefcase'],
    ['family', 'family'],
    ['lifestyle', 'leaf'],
    ['health', 'leaf'],
    ['outdoor', 'mountains'],
    ['nature', 'mountains'],
    ['auto', 'car'],
    ['car', 'car'],
    ['entertain', 'ticket'],
    ['classic', 'film_strip'],
    ['retro', 'film_strip'],
    ['culture', 'palette'],
    ['art', 'palette'],
    ['gov', 'landmark'],
    ['legis', 'landmark'],
    ['politic', 'landmark'],
];

export function categoryIconFor(key: string | null | undefined): string {
    const k = (key ?? '').trim().toLowerCase();
    const exact = EXACT[k];
    if (exact) {
        return exact;
    }
    for (const [needle, icon] of KEYWORDS) {
        if (k.includes(needle)) {
            return icon;
        }
    }
    return 'folder';
}
