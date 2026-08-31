import {
    getPreferredQualityHeight,
    type PreferredQuality,
} from '@iptvnator/shared/interfaces';
import type { PlayerTrack } from './player-controls.model';

/** Engine-neutral description of one selectable video rendition. */
export interface PlayerQualityLevel {
    /** Engine-local identifier passed back to `setQualityLevel`. */
    id: number;
    height: number | null;
    bitrateBps: number | null;
}

/** Reserved id meaning "let the engine's adaptive-bitrate logic decide". */
export const AUTO_QUALITY_ID = -1;

/**
 * Renditions the app names in the menu rather than showing a bare pixel
 * height. Everything else falls back to `<height>p`.
 */
const QUALITY_ALIASES: ReadonlyArray<{ minHeight: number; alias: string }> = [
    { minHeight: 2160, alias: '4K' },
    { minHeight: 1440, alias: '2K' },
];

export function formatQualityLabel(level: PlayerQualityLevel): string {
    if (level.height === null || level.height <= 0) {
        return level.bitrateBps && level.bitrateBps > 0
            ? `${Math.round(level.bitrateBps / 1000)} kbps`
            : 'Unknown';
    }

    const alias = QUALITY_ALIASES.find(
        (entry) => (level.height ?? 0) >= entry.minHeight
    )?.alias;
    return alias ? `${level.height}p (${alias})` : `${level.height}p`;
}

/**
 * Orders renditions highest-first, which is how every player's quality menu
 * presents them. Equal heights fall back to bitrate so a manifest carrying
 * two 1080p ladders still lists its better one first.
 */
export function sortQualityLevelsDescending(
    levels: readonly PlayerQualityLevel[]
): PlayerQualityLevel[] {
    return [...levels].sort(
        (a, b) => (b.height ?? 0) - (a.height ?? 0) ||
            (b.bitrateBps ?? 0) - (a.bitrateBps ?? 0)
    );
}

/**
 * Builds the menu entries, always leading with the adaptive one. Its label is
 * the rendition the ladder settled on (empty until something is playing) —
 * the word "Auto" is added by the controls template, which owns translation.
 */
export function buildQualityTracks(options: {
    levels: readonly PlayerQualityLevel[];
    activeId: number;
    autoEnabled: boolean;
}): PlayerTrack[] {
    const { levels, activeId, autoEnabled } = options;
    const activeLevel = levels.find((level) => level.id === activeId) ?? null;

    return [
        {
            id: AUTO_QUALITY_ID,
            label:
                autoEnabled && activeLevel
                    ? formatQualityLabel(activeLevel)
                    : '',
            selected: autoEnabled,
        },
        ...sortQualityLevelsDescending(levels).map((level) => ({
            id: level.id,
            label: formatQualityLabel(level),
            selected: !autoEnabled && level.id === activeId,
        })),
    ];
}

/**
 * Resolves a stored preference against the renditions a stream actually
 * offers. The target is a ceiling, not a requirement: a 1080p-max stream under
 * the 4K preference plays its 1080p rendition rather than failing to match.
 * Streams whose renditions all exceed the target fall back to the smallest one.
 */
export function pickPreferredQualityId(
    levels: readonly PlayerQualityLevel[],
    preference: PreferredQuality
): number {
    const target = getPreferredQualityHeight(preference);
    if (target === null) {
        return AUTO_QUALITY_ID;
    }

    const measured = levels.filter(
        (level): level is PlayerQualityLevel & { height: number } =>
            typeof level.height === 'number' && level.height > 0
    );
    if (measured.length === 0) {
        return AUTO_QUALITY_ID;
    }

    const withinTarget = measured.filter((level) => level.height <= target);
    const candidates = withinTarget.length > 0 ? withinTarget : measured;
    const best = sortQualityLevelsDescending(candidates);
    return (withinTarget.length > 0 ? best[0] : best[best.length - 1]).id;
}
