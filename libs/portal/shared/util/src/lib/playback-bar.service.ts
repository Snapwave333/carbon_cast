import { computed, Injectable, signal } from '@angular/core';

/**
 * Shared state for the workspace playback bar.
 *
 * The bar itself is rendered by the workspace shell so playback survives
 * navigation, but its size has to be readable by the players that render
 * inside it — a station dock lays out very differently at 88px than at 75% of
 * the viewport. This lives in portal-shared rather than workspace so both
 * sides can reach it without crossing a module boundary.
 */

export type PlaybackBarSize = 'compact' | 'medium' | 'large';

export const PLAYBACK_BAR_SIZES: readonly PlaybackBarSize[] = [
    'compact',
    'medium',
    'large',
];

/**
 * Compact is a fixed strip; the other two are viewport fractions so the bar
 * scales with the window instead of pinning to one screen size.
 */
export const PLAYBACK_BAR_HEIGHTS: Record<PlaybackBarSize, string> = {
    compact: '88px',
    medium: '40vh',
    large: '75vh',
};

const SIZE_STORAGE_KEY = 'carboncast.playbackBar.size';

function readStoredSize(): PlaybackBarSize {
    try {
        const stored = localStorage.getItem(SIZE_STORAGE_KEY);
        return PLAYBACK_BAR_SIZES.includes(stored as PlaybackBarSize)
            ? (stored as PlaybackBarSize)
            : 'compact';
    } catch {
        return 'compact';
    }
}

@Injectable({ providedIn: 'root' })
export class PlaybackBarService {
    private readonly sizeState = signal<PlaybackBarSize>(readStoredSize());
    /** True while the player has been detached into its own floating window. */
    private readonly poppedOutState = signal(false);

    readonly size = this.sizeState.asReadonly();
    readonly isPoppedOut = this.poppedOutState.asReadonly();

    /** Collapses to a strip while popped out — the media is no longer here. */
    readonly height = computed(() =>
        this.poppedOutState()
            ? PLAYBACK_BAR_HEIGHTS.compact
            : PLAYBACK_BAR_HEIGHTS[this.sizeState()]
    );

    setSize(size: PlaybackBarSize): void {
        this.sizeState.set(size);

        try {
            localStorage.setItem(SIZE_STORAGE_KEY, size);
        } catch {
            // Size falls back to compact on the next boot; not worth failing on.
        }
    }

    /** Steps compact → medium → large → compact, for the bar's size button. */
    cycleSize(): PlaybackBarSize {
        const next =
            PLAYBACK_BAR_SIZES[
                (PLAYBACK_BAR_SIZES.indexOf(this.sizeState()) + 1) %
                    PLAYBACK_BAR_SIZES.length
            ];
        this.setSize(next);
        return next;
    }

    setPoppedOut(poppedOut: boolean): void {
        this.poppedOutState.set(poppedOut);
    }
}
