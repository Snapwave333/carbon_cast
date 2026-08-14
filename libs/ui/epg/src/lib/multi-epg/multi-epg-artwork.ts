import { signal } from '@angular/core';
import { getProgramArtworkUrl } from '../epg-program.utils';
import { MultiEpgLayoutProgram } from './multi-epg-layout.util';

// Programme cells narrower than this keep a text-only layout — an artwork
// thumbnail would leave no room for the title.
export const ARTWORK_MIN_CELL_WIDTH = 180;
// Cells at least this wide get a second line with the programme times.
const TIME_LABEL_MIN_CELL_WIDTH = 110;

/**
 * Session-scoped programme-artwork state for the guide. Resolves renderable
 * artwork URLs (http(s) only) and remembers URLs that failed to load so a
 * dead artwork host is never retried on re-render (zoom, day switch).
 */
export class MultiEpgArtwork {
    private readonly failedUrls = signal<ReadonlySet<string>>(new Set());

    /** `enabled` reflects the guide-artwork setting; off = text-only grid. */
    constructor(private readonly enabled: () => boolean = () => true) {}

    /**
     * Artwork for a guide cell — only when the cell is wide enough.
     * Programmes without their own artwork fall back to the (already
     * sanitized) channel icon so rows aren't a mix of image and text-only
     * cells; the load-time fit check renders logos uncropped.
     */
    cellArtworkUrl(
        program: MultiEpgLayoutProgram,
        channelIconUrl: string | null = null
    ): string | null {
        if (!this.enabled() || program.width < ARTWORK_MIN_CELL_WIDTH) {
            return null;
        }
        const artwork = this.renderableUrl(program);
        if (artwork) return artwork;
        return channelIconUrl && !this.failedUrls().has(channelIconUrl)
            ? channelIconUrl
            : null;
    }

    /** Artwork for a search-result row (no width constraint). */
    resultArtworkUrl(program: { iconUrl?: string | null }): string | null {
        return this.renderableUrl(program);
    }

    showsTimeLabel(program: MultiEpgLayoutProgram): boolean {
        return program.width >= TIME_LABEL_MIN_CELL_WIDTH;
    }

    /** Sliver cells (a few minutes at low zoom) can't fit readable text —
     * the clipped "Bl…" fragments read as rendering glitches. The rect's
     * tooltip and click-through dialog still carry the title. */
    showsTitle(program: MultiEpgLayoutProgram): boolean {
        return program.width >= 44;
    }

    markFailed(url: string): void {
        this.failedUrls.update((failed) => new Set(failed).add(url));
    }

    private renderableUrl(program: {
        iconUrl?: string | null;
    }): string | null {
        const url = getProgramArtworkUrl(program);
        if (!url || this.failedUrls().has(url)) return null;
        return url;
    }
}
