import { FollowedSeries } from '@iptvnator/shared/interfaces';

const YEAR_SUFFIX = /(?:\s*[([{]\s*(?:19|20)\d{2}\s*[)\]}])\s*$/u;
const CHANNEL_PREFIX = /^(?:[\p{Lu}\d]{2,8}(?:\s*[|:]\s*|\s+-\s+))/u;
const EPISODE_PATTERNS = [
    /\bS(\d{1,3})\s*E(\d{1,4})\b/i,
    /\b(\d{1,3})x(\d{1,4})\b/i,
    /\bseason\s*(\d{1,3})\D+episode\s*(\d{1,4})\b/i,
] as const;

export function normalizeFollowedSeriesTitle(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(CHANNEL_PREFIX, '')
        .replace(YEAR_SUFFIX, '')
        .toLocaleLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function buildFollowedSeriesQueryHints(
    series: readonly FollowedSeries[]
): string[] {
    const hints = new Set<string>();
    for (const item of series) {
        for (const value of [item.title, ...item.aliases]) {
            const normalized = normalizeFollowedSeriesTitle(value);
            if (!normalized) continue;
            hints.add(value.trim());
            const usefulTokens = normalized
                .split(' ')
                .filter((token) => token.length >= 3);
            if (usefulTokens.length > 1) {
                hints.add(usefulTokens.slice(0, 2).join(' '));
            } else if (usefulTokens[0]) {
                hints.add(usefulTokens[0]);
            }
        }
    }
    return Array.from(hints).slice(0, 2_000);
}

export function parseSeasonEpisode(
    episodeNum?: string | null,
    title = ''
): { seasonNumber: number | null; episodeNumber: number | null } {
    const raw = episodeNum?.trim() ?? '';
    if (raw) {
        const xmltv = raw.match(/^(\d+)\.(\d+)(?:\.|$)/);
        if (xmltv) {
            return {
                seasonNumber: Number(xmltv[1]) + 1,
                episodeNumber: Number(xmltv[2]) + 1,
            };
        }
    }
    for (const pattern of EPISODE_PATTERNS) {
        const match = `${raw} ${title}`.match(pattern);
        if (match) {
            return {
                seasonNumber: Number(match[1]),
                episodeNumber: Number(match[2]),
            };
        }
    }
    return { seasonNumber: null, episodeNumber: null };
}

export function descriptionSimilarity(
    left?: string | null,
    right?: string | null
): number {
    const leftTokens = tokenSet(left);
    const rightTokens = tokenSet(right);
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) intersection += 1;
    }
    return intersection / Math.min(leftTokens.size, rightTokens.size);
}

export function followedSeriesTokenSimilarity(
    left: string,
    right: string
): number {
    const leftTokens = tokenSet(left);
    const rightTokens = tokenSet(right);
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) intersection += 1;
    }
    return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

export function descriptionFingerprint(value?: string | null): string {
    return Array.from(tokenSet(value)).sort().slice(0, 12).join('-');
}

export function normalizeOptionalId(
    value?: string | number | null
): string | undefined {
    if (value == null) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
}

export function stableHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function tokenSet(value?: string | null): Set<string> {
    return new Set(
        normalizeFollowedSeriesTitle(value ?? '')
            .split(' ')
            .filter((token) => token.length >= 3)
    );
}
