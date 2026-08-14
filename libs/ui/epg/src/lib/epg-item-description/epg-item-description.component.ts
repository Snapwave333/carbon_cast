import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { normalizeDateLocale } from '@iptvnator/pipes';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { differenceInMinutes } from 'date-fns';
import { startWith } from 'rxjs';
import { EpgProgram } from '@iptvnator/shared/interfaces';
import {
    TMDB_IMAGE_BASE_URL,
    TmdbEnrichmentService,
} from '@iptvnator/services';
import {
    adjustArtworkFit,
    formatEpisodeBadge,
    getEpgCategoryAccent,
    getProgramArtworkUrl,
    isMovieLikeCategory,
} from '../epg-program.utils';
import { FollowSeriesButtonComponent } from '../follow-series-button/follow-series-button.component';

export type EpgItemDialogAction = 'live' | 'timeshift';

export type EpgItemDialogData = EpgProgram & {
    channelName?: string | null;
    channel_name?: string | null;
    display_name?: string | null;
    /** Channel logo shown in the hero (falls back to a glyph when absent). */
    channelLogo?: string | null;
    /** State-aware primary action; closes the dialog with this value. */
    primaryAction?: EpgItemDialogAction | null;
    /** Show a "catch-up unavailable" note instead of an action button. */
    archiveUnavailableNote?: boolean;
};

@Component({
    selector: 'app-epg-item-description',
    templateUrl: './epg-item-description.component.html',
    styleUrls: ['./epg-item-description.component.scss'],
    imports: [
        DatePipe,
        FollowSeriesButtonComponent,
        MatDialogModule,
        MatIcon,
        TranslatePipe,
    ],
})
export class EpgItemDescriptionComponent {
    dialogData = inject<EpgItemDialogData>(MAT_DIALOG_DATA);
    private readonly translate = inject(TranslateService);
    private readonly tmdb = inject(TmdbEnrichmentService);
    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );

    epgProgram: EpgProgram;
    channelName: string | null = null;
    channelLogo: string | null = null;
    /** Set when the logo image fails to load → falls back to the glyph. */
    logoFailed = false;
    /** Programme artwork rendered as a full-bleed hero backdrop. */
    programArtwork: string | null = null;
    /** Set when the backdrop fails to load → hero keeps its gradient. */
    artworkFailed = false;
    /** "S2 E13" when episode-num is parseable, otherwise the raw value. */
    episodeLabel: string | null = null;
    readonly onArtworkLoad = adjustArtworkFit;
    /** Category colour shared with the guide's colour coding. */
    categoryAccent: string | null = null;
    duration: string | null = null;
    primaryAction: EpgItemDialogAction | null = null;
    archiveUnavailableNote = false;
    /** ms timestamps for the date pipe (prefer unix timestamp when present). */
    startMs = 0;
    stopMs = 0;
    readonly currentLocale = computed(() => {
        this.languageTick();
        return normalizeDateLocale(
            this.translate.currentLang || this.translate.defaultLang
        );
    });

    constructor() {
        this.epgProgram = this.dialogData;
        // Check multiple possible field names for channel name
        this.channelName =
            this.dialogData.channelName ||
            this.dialogData.channel_name ||
            this.dialogData.display_name ||
            null;
        // The channel logo stays in the centered plate; the programme's own
        // EPG icon becomes a full-bleed backdrop behind it. Playlists
        // without a tvg-logo still show the EPG artwork — as backdrop.
        this.channelLogo = this.dialogData.channelLogo?.trim() || null;
        this.programArtwork = getProgramArtworkUrl(this.epgProgram);
        this.episodeLabel =
            formatEpisodeBadge(this.epgProgram.episodeNum) ??
            this.epgProgram.episodeNum?.trim() ??
            null;
        this.categoryAccent = getEpgCategoryAccent(this.epgProgram.category);
        if (!this.programArtwork) {
            void this.loadTmdbArtworkFallback();
        }
        this.duration = this.calculateDuration();
        this.primaryAction = this.dialogData.primaryAction ?? null;
        this.archiveUnavailableNote =
            this.dialogData.archiveUnavailableNote ?? false;
        this.startMs = toMs(
            this.epgProgram.start,
            this.epgProgram.startTimestamp
        );
        this.stopMs = toMs(this.epgProgram.stop, this.epgProgram.stopTimestamp);
    }

    /**
     * TMDB backdrop for programmes whose EPG feed carries no artwork —
     * one cached lookup per dialog, gated on the TMDB opt-in. Best-effort:
     * no confident match keeps the gradient hero.
     */
    private async loadTmdbArtworkFallback(): Promise<void> {
        if (!this.tmdb.isEnabled()) return;
        const title = (
            this.epgProgram.seriesTitle || this.epgProgram.title
        )?.trim();
        if (!title) return;

        try {
            const details = isMovieLikeCategory(this.epgProgram.category)
                ? await this.tmdb.enrichMovie({ title })
                : await this.tmdb.enrichTv({ title });
            const path = details?.backdrop_path || details?.poster_path;
            if (path && !this.programArtwork) {
                this.programArtwork = `${TMDB_IMAGE_BASE_URL}/w780${path}`;
            }
        } catch {
            // Best-effort enrichment; the hero keeps its gradient.
        }
    }

    private calculateDuration(): string | null {
        if (!this.epgProgram.start || !this.epgProgram.stop) return null;
        try {
            const start = new Date(this.epgProgram.start);
            const stop = new Date(this.epgProgram.stop);
            const mins = differenceInMinutes(stop, start);
            if (mins < 60) {
                return `${mins} min`;
            }
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            return remainingMins > 0
                ? `${hours}h ${remainingMins}m`
                : `${hours}h`;
        } catch {
            return null;
        }
    }
}

function toMs(iso: string, timestamp?: number | null): number {
    if (Number.isFinite(timestamp) && Number(timestamp) > 0) {
        return Number(timestamp) * 1000;
    }
    return Date.parse(iso);
}
