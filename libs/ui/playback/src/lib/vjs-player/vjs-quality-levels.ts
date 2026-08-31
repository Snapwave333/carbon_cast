import type { PreferredQuality } from '@iptvnator/shared/interfaces';
import type { PlayerTrack } from '../player-controls/player-controls.model';
import {
    AUTO_QUALITY_ID,
    buildQualityTracks,
    pickPreferredQualityId,
    type PlayerQualityLevel,
} from '../player-controls/player-quality.util';
import type {
    VideoJsPlayer,
    VideoJsQualityLevelList,
} from './vjs-player.types';

export interface VjsQualityLevelsConfig {
    player: VideoJsPlayer;
    preferredQuality: () => PreferredQuality;
    refresh: () => void;
}

const LIST_EVENTS = ['addqualitylevel', 'removequalitylevel', 'change'] as const;

/**
 * Applies the preferred-quality setting to Video.js through
 * `videojs-contrib-quality-levels`, and maps the list onto the shared-controls
 * track contract.
 *
 * Unlike hls.js, the list's `enabled` flags are sticky, so the preference is
 * seeded once per source rather than re-asserted on every event — otherwise it
 * would fight the vendor quality menu the preference-off players still show.
 */
export class VjsQualityLevels {
    private levels: VideoJsQualityLevelList | null = null;
    private listener: (() => void) | null = null;
    private override: number | null = null;
    private autoActive = true;
    private seeded = false;

    constructor(private readonly config: VjsQualityLevelsConfig) {}

    bind(): void {
        const levels = this.readList();
        if (!levels || this.levels === levels) {
            this.applyPreference();
            return;
        }

        this.unbindList();
        this.levels = levels;
        const listener = () => {
            this.applyPreference();
            this.config.refresh();
        };
        this.listener = listener;
        for (const event of LIST_EVENTS) {
            levels.on?.(event, listener);
        }
        this.applyPreference();
    }

    /** A new source restarts the ladder, so the preference is seeded again. */
    resetSource(): void {
        this.override = null;
        this.seeded = false;
        this.autoActive = true;
        this.bind();
    }

    refreshInputs(): void {
        this.override = null;
        this.seeded = false;
        this.applyPreference();
    }

    clear(): void {
        this.unbindList();
        this.override = null;
        this.seeded = false;
        this.autoActive = true;
    }

    destroy(): void {
        this.clear();
    }

    getQualityLevels(): PlayerTrack[] {
        const levels = this.readLevels();
        if (levels.length < 2) {
            return [];
        }

        return buildQualityTracks({
            levels,
            activeId: this.levels?.selectedIndex ?? AUTO_QUALITY_ID,
            autoEnabled: this.autoActive,
        });
    }

    setQualityLevel(id: number): void {
        if (!Number.isInteger(id)) {
            return;
        }
        if (id !== AUTO_QUALITY_ID && !this.readLevels().some((l) => l.id === id)) {
            return;
        }

        this.override = id;
        this.applyLevel(id);
    }

    private applyPreference(): void {
        const levels = this.readLevels();
        if (levels.length === 0) {
            return;
        }

        if (this.override !== null) {
            this.applyLevel(this.override);
            return;
        }
        if (this.seeded) {
            return;
        }

        this.seeded = true;
        this.applyLevel(
            pickPreferredQualityId(levels, this.config.preferredQuality())
        );
    }

    private applyLevel(id: number): void {
        const list = this.levels;
        if (!list) {
            return;
        }

        this.autoActive = id === AUTO_QUALITY_ID;
        for (let index = 0; index < list.length; index += 1) {
            list[index].enabled = this.autoActive || index === id;
        }
    }

    private readLevels(): PlayerQualityLevel[] {
        const list = this.levels;
        if (!list) {
            return [];
        }

        const levels: PlayerQualityLevel[] = [];
        for (let index = 0; index < list.length; index += 1) {
            levels.push({
                id: index,
                height: list[index].height ?? null,
                bitrateBps: list[index].bitrate ?? null,
            });
        }
        return levels;
    }

    private readList(): VideoJsQualityLevelList | null {
        try {
            return this.config.player.qualityLevels?.() ?? null;
        } catch {
            return null;
        }
    }

    private unbindList(): void {
        if (this.levels && this.listener) {
            for (const event of LIST_EVENTS) {
                this.levels.off?.(event, this.listener);
            }
        }
        this.levels = null;
        this.listener = null;
    }
}
