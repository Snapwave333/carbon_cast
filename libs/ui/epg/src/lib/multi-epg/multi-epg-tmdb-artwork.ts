import { signal } from '@angular/core';
import type { TmdbEnrichmentService } from '@iptvnator/services';
import { TMDB_IMAGE_BASE_URL } from '@iptvnator/services';
import { isMovieLikeCategory } from '../epg-program.utils';
import { ARTWORK_MIN_CELL_WIDTH } from './multi-epg-artwork';
import { MultiEpgLayoutProgram } from './multi-epg-layout.util';

// Live events and rolling news have no meaningful TMDB entry — looking
// them up only burns the session budget.
const SKIP_CATEGORY_PATTERN = /sport|news|nachricht|noticia|actualit/i;
// Only programmes airing around now are worth a lookup: that is where the
// guide auto-scrolls, so the budget goes to cells the user actually sees.
const LOOKUP_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Last-tier guide-cell artwork: TMDB backdrops for programmes whose feed
 * carries neither programme artwork nor a channel logo. Strictly bounded —
 * lookups are deduped by title, capped per guide session, limited to a
 * window around now, and skipped for categories TMDB can't match. Results
 * (including misses) are memoized; the enrichment service adds its own
 * SQLite cache underneath, so repeat sessions are network-free.
 */
export class MultiEpgTmdbArtwork {
    private readonly urls = signal<ReadonlyMap<string, string | null>>(
        new Map()
    );
    private readonly queued = new Set<string>();
    private readonly queue: Array<{
        key: string;
        title: string;
        movie: boolean;
    }> = [];
    private active = 0;
    private lookupsLeft: number;

    constructor(
        private readonly tmdb: Pick<
            TmdbEnrichmentService,
            'isEnabled' | 'enrichMovie' | 'enrichTv'
        >,
        maxLookups = 48,
        private readonly concurrency = 2,
        private readonly now: () => number = Date.now,
        /** Guide-artwork setting; off = no lookups at all. */
        private readonly enabled: () => boolean = () => true
    ) {
        this.lookupsLeft = maxLookups;
    }

    /** Resolved artwork for a cell, enqueueing a lookup on first ask. */
    cellArtwork(program: MultiEpgLayoutProgram): string | null {
        if (!this.qualifies(program)) return null;

        const title = (program.seriesTitle || program.title)?.trim() ?? '';
        if (!title) return null;
        const movie = isMovieLikeCategory(program.category);
        const key = `${movie ? 'm' : 't'}|${title.toLowerCase()}`;

        const cached = this.urls().get(key);
        if (cached !== undefined) return cached;

        if (!this.queued.has(key) && this.lookupsLeft > 0) {
            this.queued.add(key);
            this.lookupsLeft -= 1;
            this.queue.push({ key, title, movie });
            this.pump();
        }
        return null;
    }

    private qualifies(program: MultiEpgLayoutProgram): boolean {
        if (!this.enabled()) return false;
        if (program.width < ARTWORK_MIN_CELL_WIDTH) return false;
        if (!this.tmdb.isEnabled()) return false;
        const category = program.category?.trim();
        if (!category || SKIP_CATEGORY_PATTERN.test(category)) return false;

        const now = this.now();
        return (
            program.stopDate.getTime() >= now - LOOKUP_WINDOW_MS &&
            program.startDate.getTime() <= now + LOOKUP_WINDOW_MS
        );
    }

    private pump(): void {
        while (this.active < this.concurrency && this.queue.length > 0) {
            const next = this.queue.shift();
            if (!next) return;
            this.active += 1;
            void this.lookup(next).finally(() => {
                this.active -= 1;
                this.pump();
            });
        }
    }

    private async lookup(entry: {
        key: string;
        title: string;
        movie: boolean;
    }): Promise<void> {
        let url: string | null = null;
        try {
            const details = entry.movie
                ? await this.tmdb.enrichMovie({ title: entry.title })
                : await this.tmdb.enrichTv({ title: entry.title });
            const path = details?.backdrop_path || details?.poster_path;
            // w300 keeps the thumbnail payload small for 64x38 cells.
            url = path ? `${TMDB_IMAGE_BASE_URL}/w300${path}` : null;
        } catch {
            url = null;
        }
        this.urls.update((map) => new Map(map).set(entry.key, url));
    }
}
