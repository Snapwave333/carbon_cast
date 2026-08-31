import { format } from 'date-fns';
import type { EpgProgram } from '@iptvnator/shared/interfaces';
import { EPG_DATE_KEY_FORMAT } from './epg-date';

/**
 * Epoch seconds are ~1.7e9 today; a value past this is already milliseconds,
 * which some XMLTV exporters emit. Multiplying those by 1000 produced dates
 * tens of thousands of years out, and the timeline sizes its axis from the
 * furthest programme — one such row stretched the ribbon across millennia and
 * locked the tab building ticks for it.
 */
const TIMESTAMP_ALREADY_MS_THRESHOLD = 1e11;
/** Anything outside this window is treated as corrupt rather than plotted. */
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);
const LATEST_PLAUSIBLE_OFFSET_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export function getProgramTimeMs(
    isoValue: string,
    timestampValue?: number | null
): number {
    const candidate =
        Number.isFinite(timestampValue) && Number(timestampValue) > 0
            ? Number(timestampValue) >= TIMESTAMP_ALREADY_MS_THRESHOLD
                ? Number(timestampValue)
                : Number(timestampValue) * 1000
            : Date.parse(isoValue);

    if (!Number.isFinite(candidate)) {
        return Number.NaN;
    }

    const latestPlausibleMs = Date.now() + LATEST_PLAUSIBLE_OFFSET_MS;
    if (candidate < EARLIEST_PLAUSIBLE_MS || candidate > latestPlausibleMs) {
        return Number.NaN;
    }

    return candidate;
}

export function getProgramDateKey(
    isoValue: string,
    timestampValue?: number | null
): string {
    const programTimeMs = getProgramTimeMs(isoValue, timestampValue);

    if (!Number.isFinite(programTimeMs)) {
        return '';
    }

    return format(new Date(programTimeMs), EPG_DATE_KEY_FORMAT);
}

/**
 * Programme artwork (XMLTV `<icon src>`) safe to render in the UI. XMLTV
 * feeds are untrusted input, so anything that is not an absolute http(s)
 * URL — `javascript:`, `data:`, `file:`, relative paths — is dropped.
 */
export function getProgramArtworkUrl(
    program: Pick<EpgProgram, 'iconUrl'>
): string | null {
    const url = program.iconUrl?.trim();
    return url && /^https?:\/\//i.test(url) ? url : null;
}

// Category accent palette — restrained hues that read on the dark grid without
// turning the schedule into a rainbow. Every colour is used as a 3px edge and
// low-opacity wash, never as a full card fill.
const CATEGORY_PALETTE = [
    '#8cb4df', // blue — series / drama / entertainment
    '#d990b0', // rose — movies
    '#d78484', // red — news
    '#78b991', // green — sports
    '#d8b66b', // amber — kids
    '#aa9bdd', // violet — music
    '#76bdb5', // teal — documentary / factual
    '#d6a07a', // orange — lifestyle / misc
    '#d0a666', // gold — comedy
    '#82c6a7', // mint — animation
] as const;

// Keyword buckets cover the common XMLTV category vocabularies (several
// languages); anything else hashes onto the palette so every category gets
// a stable colour rather than only the known ones.
const MOVIE_CATEGORY_PATTERN = /movie|film|cine|kino/i;

/** Whether an XMLTV category describes a film (vs. series/other). Used to
 * pick the TMDB lookup type for artwork fallbacks. */
export function isMovieLikeCategory(
    category: string | null | undefined
): boolean {
    return MOVIE_CATEGORY_PATTERN.test(category ?? '');
}

const CATEGORY_RULES: readonly [RegExp, string][] = [
    [MOVIE_CATEGORY_PATTERN, CATEGORY_PALETTE[1]],
    [/news|report|nachricht|noticia|actualit/i, CATEGORY_PALETTE[2]],
    [/sport|fu[sß]ball|f[uú]tbol|soccer|racing/i, CATEGORY_PALETTE[3]],
    [/comedy|sitcom|humou?r|stand.?up|kabarett/i, CATEGORY_PALETTE[8]],
    [
        /animation|animaci[oó]n|anime|cartoon|zeichentrick|animated/i,
        CATEGORY_PALETTE[9],
    ],
    [/kids|child|kinder|infantil|jeunesse/i, CATEGORY_PALETTE[4]],
    [/music|musik|m[uú]sica|concert/i, CATEGORY_PALETTE[5]],
    [/doc|nature|science|history|wissen|natur/i, CATEGORY_PALETTE[6]],
    [/reality|lifestyle|food|travel|home|garden/i, CATEGORY_PALETTE[7]],
    [/series|serie|drama|show|entertain|talk/i, CATEGORY_PALETTE[0]],
];

/**
 * Stable accent colour for an XMLTV programme category, used to colour-code
 * the guide surfaces. Returns null for missing/blank categories.
 */
export function getEpgCategoryAccent(
    category: string | null | undefined
): string | null {
    const value = category?.trim();
    if (!value) return null;

    for (const [pattern, color] of CATEGORY_RULES) {
        if (pattern.test(value)) return color;
    }

    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.toLowerCase().charCodeAt(i)) | 0;
    }
    return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

/**
 * `(load)` handler for artwork `<img>` tags whose CSS uses `object-fit:
 * cover`. Cover crops near-square and portrait images (channel logos,
 * posters) badly, so those get an `art-contain` class the stylesheet maps
 * to `object-fit: contain`. Wide stills (16:9-ish) keep the cover crop.
 */
export function adjustArtworkFit(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img?.naturalWidth || !img.naturalHeight) return;
    if (img.naturalHeight / img.naturalWidth > 0.8) {
        img.classList.add('art-contain');
    }
}

/**
 * Formats an XMLTV `episode-num` value as a compact "S2 E13" badge.
 * Feeds store either `onscreen` values ("S02E13", "2x13", "E5") or
 * `xmltv_ns` values ("1.12." — zero-based season.episode.part where each
 * field may be blank or carry a "/total"). Returns null when unparseable
 * so callers can fall back to the raw value or hide the badge.
 */
export function formatEpisodeBadge(
    episodeNum: string | null | undefined
): string | null {
    const value = episodeNum?.trim().replace(/\s+/g, '');
    if (!value) return null;

    const onscreen = /^s?(\d{1,3})[ex×](\d{1,4})$/i.exec(value);
    if (onscreen) {
        return `S${Number(onscreen[1])} E${Number(onscreen[2])}`;
    }

    const episodeOnly = /^e(?:p)?(\d{1,4})$/i.exec(value);
    if (episodeOnly) {
        return `E${Number(episodeOnly[1])}`;
    }

    const nsParts = value.split('.');
    const nsField = /^(?:(\d+)(?:\/\d+)?)?$/;
    if (nsParts.length === 3 && nsParts.every((part) => nsField.test(part))) {
        const season = nsParts[0] ? Number(nsParts[0].split('/')[0]) + 1 : null;
        const episode = nsParts[1]
            ? Number(nsParts[1].split('/')[0]) + 1
            : null;
        if (season !== null && episode !== null) {
            return `S${season} E${episode}`;
        }
        if (episode !== null) return `E${episode}`;
        if (season !== null) return `S${season}`;
    }

    return null;
}

export function deduplicateProgramsByTimeSlot(
    programs: EpgProgram[]
): EpgProgram[] {
    const programsByTimeSlot = new Map<string, EpgProgram>();

    for (const program of programs) {
        const timeSlotKey = buildProgramTimeSlotKey(program);
        const existingProgram = programsByTimeSlot.get(timeSlotKey);

        programsByTimeSlot.set(
            timeSlotKey,
            existingProgram
                ? selectMoreInformativeProgram(existingProgram, program)
                : program
        );
    }

    return Array.from(programsByTimeSlot.values());
}

export function areProgramsSame(left: EpgProgram, right: EpgProgram): boolean {
    return (
        (left.channel ?? '') === (right.channel ?? '') &&
        getProgramTimeMs(left.start, left.startTimestamp) ===
            getProgramTimeMs(right.start, right.startTimestamp) &&
        getProgramTimeMs(left.stop, left.stopTimestamp) ===
            getProgramTimeMs(right.stop, right.stopTimestamp)
    );
}

function buildProgramTimeSlotKey(program: EpgProgram): string {
    return [
        getProgramTimeMs(program.start, program.startTimestamp),
        getProgramTimeMs(program.stop, program.stopTimestamp),
    ].join('|');
}

function selectMoreInformativeProgram(
    existingProgram: EpgProgram,
    candidateProgram: EpgProgram
): EpgProgram {
    return getProgramMetadataScore(candidateProgram) >
        getProgramMetadataScore(existingProgram)
        ? candidateProgram
        : existingProgram;
}

function getProgramMetadataScore(program: EpgProgram): number {
    return (
        getTextScore(program.desc) * 8 +
        getTextScore(program.category) * 4 +
        getTextScore(program.iconUrl) * 2 +
        getTextScore(program.rating) * 2 +
        getTextScore(program.episodeNum) * 2 +
        getTextScore(program.title)
    );
}

function getTextScore(value: string | null | undefined): number {
    return value?.trim() ? 1 : 0;
}
