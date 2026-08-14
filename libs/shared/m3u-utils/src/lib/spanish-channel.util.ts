/**
 * M3U playlists carry no language metadata, so Spanish-language channels can
 * only be recognised from the channel name and its group label. Two signals
 * are reliable enough to filter on:
 *
 *   - an explicit language marker ("en español", "Latino", "telenovelas")
 *   - a network that only ever broadcasts in Spanish (Telemundo, Univision,
 *     ESPN Deportes)
 *
 * Markers are matched on word boundaries so English titles that merely contain
 * the letters ("Latin Jazz", "Deportivo FC") are left alone, and accents are
 * folded first because playlists spell "español" and "espanol" interchangeably.
 */
const SPANISH_MARKERS = [
    /\ben espanol\b/,
    /\bespanol\b/,
    /\blatino\b/,
    /\blatina\b/,
    /\btelenovelas?\b/,
    /\bdeportes\b/,
    /\ben vivo\b/,
];

const SPANISH_NETWORKS = [/\btelemundo\b/, /\bunivision\b/, /\bunimas\b/];

function fold(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();
}

/**
 * Whether a channel broadcasts in Spanish, judged from its name and group.
 *
 * Examples:
 *   "Comedy Central en español"  → true
 *   "ESPN Deportes (720p)"       → true
 *   "Telemundo West (720p)"      → true
 *   "MTV Classic (720p)"         → false
 *   "Latin Music Hits"           → false  (no whole-word marker)
 */
export function isSpanishLanguageChannel(
    name: string | null | undefined,
    group?: string | null
): boolean {
    const haystack = fold(`${name ?? ''} ${group ?? ''}`);
    if (!haystack.trim()) return false;

    return [...SPANISH_MARKERS, ...SPANISH_NETWORKS].some((pattern) =>
        pattern.test(haystack)
    );
}
