import Hls from 'hls.js';
import type { PreferredQuality } from '@iptvnator/shared/interfaces';
import type { PlayerTrack } from '../player-controls/player-controls.model';
import {
    AUTO_QUALITY_ID,
    buildQualityTracks,
    pickPreferredQualityId,
    type PlayerQualityLevel,
} from '../player-controls/player-quality.util';
import type { ShakaPlayerLike } from '../shaka-engine/shaka-module.types';
import type { ShakaVideoSession } from '../shaka-engine/shaka-video-session';

export interface WebVideoQualityControlsConfig {
    preferredQuality: () => PreferredQuality;
    refresh: () => void;
}

type QualitySource =
    | { kind: 'hls'; hls: Hls }
    | { kind: 'shaka'; session: ShakaVideoSession };

/**
 * Applies the preferred-quality setting to the active source engine and maps
 * its rendition ladder onto the shared-controls track contract.
 *
 * Like the caption helpers, this sits below the controls UI so the preference
 * reaches the engine in both shared-controls and vendor-chrome mode. An
 * explicit user choice (`override`) wins for the rest of that source; a new
 * source starts unset so the preference is seeded again.
 */
export class WebVideoQualityControls {
    private source: QualitySource | null = null;
    private hlsListener: (() => void) | null = null;
    private unsubscribeShaka: (() => void) | null = null;
    private override: number | null = null;
    private autoActive = true;

    constructor(private readonly config: WebVideoQualityControlsConfig) {}

    bindHls(hls: Hls): void {
        this.clear();
        this.source = { kind: 'hls', hls };
        const listener = () => {
            this.applyPreference();
            this.config.refresh();
        };
        this.hlsListener = listener;
        for (const event of HLS_QUALITY_EVENTS) {
            hls.on(event, listener);
        }
        this.applyPreference();
    }

    bindShaka(session: ShakaVideoSession): void {
        this.clear();
        this.source = { kind: 'shaka', session };
        this.unsubscribeShaka = session.subscribe(() => {
            this.applyPreference();
            this.config.refresh();
        });
        this.applyPreference();
    }

    clear(): void {
        if (this.source?.kind === 'hls' && this.hlsListener) {
            for (const event of HLS_QUALITY_EVENTS) {
                this.source.hls.off(event, this.hlsListener);
            }
        }
        this.unsubscribeShaka?.();
        this.unsubscribeShaka = null;
        this.hlsListener = null;
        this.source = null;
        this.override = null;
        this.autoActive = true;
    }

    /** Re-seeds the preference after the setting itself changed. */
    refreshInputs(): void {
        this.override = null;
        this.applyPreference();
    }

    /**
     * Menu entries, or an empty list when there is nothing to choose between —
     * a single-rendition stream would otherwise show a menu with one option.
     */
    getQualityLevels(): PlayerTrack[] {
        const levels = this.readLevels();
        if (levels.length < 2) {
            return [];
        }

        return buildQualityTracks({
            levels,
            activeId: this.readActiveId(),
            autoEnabled: this.readAutoEnabled(),
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
            // Re-assert across engine events that reset the ladder (an HLS
            // level refresh clears a pinned level back to auto).
            this.applyLevel(this.override);
            return;
        }

        this.applyLevel(
            pickPreferredQualityId(levels, this.config.preferredQuality())
        );
    }

    private applyLevel(id: number): void {
        const source = this.source;
        if (!source) {
            return;
        }

        this.autoActive = id === AUTO_QUALITY_ID;
        if (source.kind === 'hls') {
            if (source.hls.currentLevel !== id) {
                source.hls.currentLevel = id;
            }
            return;
        }

        const player = source.session.getPlayer();
        if (!player) {
            return;
        }
        if (id === AUTO_QUALITY_ID) {
            player.configure({ abr: { enabled: true } });
            return;
        }
        const variant = player
            .getVariantTracks()
            .find((track) => track.id === id);
        if (!variant) {
            return;
        }
        // Shaka ignores an explicit variant while ABR owns the selection.
        player.configure({ abr: { enabled: false } });
        player.selectVariantTrack(variant, true);
    }

    private readLevels(): PlayerQualityLevel[] {
        const source = this.source;
        if (!source) {
            return [];
        }

        if (source.kind === 'hls') {
            // hls.js only populates `levels` once the manifest is parsed, and
            // the controls adapter refreshes on every media event — including
            // ones that fire before that.
            return (source.hls.levels ?? []).map((level, index) => ({
                id: index,
                height: level.height ?? null,
                bitrateBps: level.bitrate ?? null,
            }));
        }

        return (this.getShakaPlayer()?.getVariantTracks() ?? []).map(
            (track) => ({
                id: track.id,
                height: track.height ?? null,
                bitrateBps: track.bandwidth ?? null,
            })
        );
    }

    private readActiveId(): number {
        const source = this.source;
        if (!source) {
            return AUTO_QUALITY_ID;
        }
        if (source.kind === 'hls') {
            const level = source.hls.currentLevel;
            return level >= 0 ? level : source.hls.loadLevel;
        }
        return (
            this.getShakaPlayer()
                ?.getVariantTracks()
                .find((track) => track.active)?.id ?? AUTO_QUALITY_ID
        );
    }

    private readAutoEnabled(): boolean {
        // Shaka exposes no ABR getter, so the last applied selection is the
        // source of truth there; hls.js reports it directly.
        return this.source?.kind === 'hls'
            ? this.source.hls.autoLevelEnabled
            : this.autoActive;
    }

    private getShakaPlayer(): ShakaPlayerLike | null {
        return this.source?.kind === 'shaka'
            ? this.source.session.getPlayer()
            : null;
    }
}

const HLS_QUALITY_EVENTS = [
    Hls.Events.MANIFEST_PARSED,
    Hls.Events.LEVELS_UPDATED,
    Hls.Events.LEVEL_SWITCHED,
] as const;
