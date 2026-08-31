import { DatePipe } from '@angular/common';
import { OverlayRef } from '@angular/cdk/overlay';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    Input,
    OnDestroy,
    OnInit,
    output,
    signal,
    Signal,
    viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { normalizeDateLocale } from '@iptvnator/pipes';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, Subscription, startWith } from 'rxjs';
import { Channel, EpgProgram } from '@iptvnator/shared/interfaces';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { SettingsStore, TmdbEnrichmentService } from '@iptvnator/services';
import {
    adjustArtworkFit,
    formatEpisodeBadge,
    getEpgCategoryAccent,
} from '../epg-program.utils';
import { MultiEpgArtwork } from './multi-epg-artwork';
import { MultiEpgChannelBrowser } from './multi-epg-channel-browser';
import { MultiEpgTmdbArtwork } from './multi-epg-tmdb-artwork';
import {
    MultiEpgCatchupResolver,
    MultiEpgPlayRequest,
} from './multi-epg-program-dialog';
import {
    MultiEpgChannelAvailabilityResolver,
    MultiEpgProgramActivator,
} from './multi-epg-program-activation';
import {
    buildProgramAriaLabel,
    getEpgChannelName,
    computeVisibleChannelCount,
    filterChannelsByName,
    isProgramUnderPlayhead,
    layoutEpgChannelsForDay,
    MultiEpgLayoutChannel,
    MultiEpgLayoutProgram,
    shouldLoadMoreOnScroll,
} from './multi-epg-layout.util';
import { MultiEpgProgramFocus } from './multi-epg-program-focus';
import {
    MultiEpgProgramSearch,
    ProgramSearchResult,
} from './multi-epg-program-search';
import { MultiEpgSearchFields } from './multi-epg-search-fields';
import { MultiEpgTimeAxis } from './multi-epg-time-axis';
import { COMPONENT_OVERLAY_REF } from './overlay-ref.token';

/** Grid and search results both carry the EPG channel id as `channel_id`. */
type GuideProgram = EpgProgram & { channel_id?: string };

@Component({
    imports: [DatePipe, MatButtonModule, MatIcon, MatTooltip, TranslatePipe],
    selector: 'app-multi-epg-container',
    templateUrl: './multi-epg-container.component.html',
    styleUrls: [
        './multi-epg-container.component.scss',
        './multi-epg-grid.component.scss',
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiEpgContainerComponent
    implements OnInit, AfterViewInit, OnDestroy
{
    readonly epgContainer = viewChild.required<ElementRef>('epgContainer');
    readonly timelineContainer =
        viewChild<ElementRef<HTMLElement>>('timelineContainer');
    /** Channel-column filter field; only present while the filter is expanded. */
    readonly channelFilterInput =
        viewChild<ElementRef<HTMLInputElement>>('searchInput');
    /** Programme search field; only present while programme search is open. */
    readonly programSearchInput =
        viewChild<ElementRef<HTMLInputElement>>('programSearchInput');

    private readonly dialog = inject(MatDialog);
    private readonly epgBridge = inject(EpgRuntimeBridgeService);
    private readonly settingsStore = inject(SettingsStore);
    readonly programSearch = new MultiEpgProgramSearch(
        (query, limit) => this.epgBridge.searchPrograms(query, limit),
        () => this.epgBridge.supportsProgramSearch
    );
    /**
     * Channel filter + programme search fields (open/close, focus, Escape).
     * The template drives it directly, as it does `programSearch`.
     */
    readonly searchFields = new MultiEpgSearchFields(this.programSearch, {
        channelFilter: this.channelFilterInput,
        programSearch: this.programSearchInput,
    });
    readonly channelFilter = this.searchFields.channelFilter;
    readonly isSearchExpanded = this.searchFields.isChannelFilterOpen;
    private readonly browser = new MultiEpgChannelBrowser(this.epgBridge);

    @Input() set playlistChannels(value: Observable<Channel[]>) {
        if (this.playlistChannelsSubscription) {
            this.playlistChannelsSubscription.unsubscribe();
        }

        if (value) {
            this.playlistChannelsSubscription = value.subscribe(() => {
                this.resetChannelBrowser();
                this.initializeVisibleChannels();
                void this.requestPrograms();
            });
        }
    }

    @Input() activeChannelId: string | null = null;

    /** Host-supplied per-channel catch-up capability; enables the dialog's
     * "Watch from start" action for past programmes. */
    @Input() catchupResolver: MultiEpgCatchupResolver | null = null;

    /** "Is this EPG channel in the open playlist?"; absent = all playable. */
    @Input()
    channelAvailabilityResolver: MultiEpgChannelAvailabilityResolver | null =
        null;

    /** "Watch live" / "Watch from start" chosen in a programme dialog. */
    readonly playRequested = output<MultiEpgPlayRequest>();

    readonly hourWidth = signal(150);
    /** Selected day, live playhead, and the minute clock behind them. */
    private readonly timeAxis = new MultiEpgTimeAxis(this.hourWidth);
    readonly today = this.timeAxis.today;
    readonly selectedDayDate = this.timeAxis.selectedDayDate;
    readonly isToday = this.timeAxis.isToday;
    readonly currentTimeLine = this.timeAxis.playheadX;
    readonly currentTimeLabel = this.timeAxis.nowLabel;
    readonly originalEpgData = this.browser.data;
    readonly isLoading = this.browser.isLoading;
    readonly loadError = this.browser.loadError;
    readonly isLastPage = this.browser.isLastPage;

    readonly isProgramSearchOpen = this.programSearch.isOpen;
    readonly programSearchQuery = this.programSearch.query;
    readonly programSearchResults = this.programSearch.results;
    readonly isSearchingPrograms = this.programSearch.isSearching;
    readonly programSearchError = this.programSearch.error;
    private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
    /** Roving tabindex + arrow-key navigation across the programme grid. */
    private readonly programFocus = new MultiEpgProgramFocus({
        channels: () => this.filteredChannels(),
        keyOf: (program) => this.getProgramKey(program),
        host: () => this.hostRef.nativeElement,
        activate: (program) => this.activateProgram(program, '600px'),
        openDetails: (program) => this.activator.openDetails(program, '600px'),
    });
    /** Guide-artwork setting; off = denser text-only grid, no TMDB lookups. */
    private readonly artworkEnabled = () =>
        this.settingsStore.guideArtwork?.() ?? true;
    readonly artwork = new MultiEpgArtwork(this.artworkEnabled);
    readonly tmdbArtwork = new MultiEpgTmdbArtwork(
        inject(TmdbEnrichmentService),
        undefined,
        undefined,
        undefined,
        this.artworkEnabled
    );
    private readonly translate = inject(TranslateService);
    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );
    readonly currentLocale = computed(() => {
        this.languageTick();
        return normalizeDateLocale(
            this.translate.currentLang || this.translate.defaultLang
        );
    });
    /**
     * "On now" wording for grid aria-labels, resolved once per language rather
     * than through a `translate.instant` call on every cell on every
     * change-detection pass (scroll, hover, click all trigger one).
     */
    readonly onNowLabel = computed(() => {
        this.languageTick();
        return this.translate.instant('EPG.TIMELINE.ON_NOW') as string;
    });

    // Typed explicitly: `channels` and `activator` reference each other, and
    // TypeScript cannot break that inference cycle on its own.
    readonly channels: Signal<MultiEpgLayoutChannel[]> = computed(() =>
        layoutEpgChannelsForDay(
            this.originalEpgData(),
            this.today(),
            this.hourWidth(),
            this.dateCache,
            (channel) => this.activator.isPlayable(channel)
        )
    );

    private readonly activator = new MultiEpgProgramActivator({
        dialog: this.dialog,
        channels: () => this.channels(),
        catchupResolver: () => this.catchupResolver,
        availabilityResolver: () => this.channelAvailabilityResolver,
        onPlay: (request) => this.playRequested.emit(request),
    });

    readonly filteredChannels = computed(() =>
        filterChannelsByName(this.channels(), this.channelFilter())
    );

    readonly timeHeader = Array.from({ length: 24 }, (_, i) => i);
    readonly barHeight = 50;

    private dateCache = new Map<string, Date>();
    private playlistChannelsSubscription?: Subscription;

    private readonly overlayRef = inject<OverlayRef | null>(
        COMPONENT_OVERLAY_REF,
        { optional: true }
    );
    readonly isOverlay = this.overlayRef !== null;

    ngOnInit() {
        this.timeAxis.start();
    }

    ngAfterViewInit(): void {
        this.initializeVisibleChannels();
        this.scrollToCurrentTime();
    }

    scrollToCurrentTime(): void {
        const scrollPosition = this.currentTimeLine();
        this.scrollTimelineTo(scrollPosition < 1000 ? 0 : scrollPosition - 150);
    }

    private initializeVisibleChannels(): void {
        const epgContainer = this.epgContainer();
        if (!epgContainer) return;
        this.browser.visibleChannels = computeVisibleChannelCount(
            epgContainer.nativeElement.offsetHeight,
            this.barHeight
        );
    }

    ngOnDestroy(): void {
        this.timeAxis.stop();
        this.playlistChannelsSubscription?.unsubscribe();
        this.programSearch.destroy();
        this.browser.invalidate();
        this.dateCache.clear();
    }

    /**
     * Position plus start: keying on the programme alone let a repeated feed
     * entry throw Angular's duplicate-key error and take the grid down.
     */
    trackByProgram(index: number, program: MultiEpgLayoutProgram): string {
        return `${index}|${program.start}`;
    }

    isProgramAiringNow(prog: MultiEpgLayoutProgram): boolean {
        const playhead = this.currentTimeLine();
        return isProgramUnderPlayhead(prog, playhead, this.isToday());
    }

    retryPrograms = (): Promise<void> => this.browser.retry();

    requestPrograms(): Promise<void> {
        return this.browser.requestPrograms();
    }

    onScroll(event: Event): void {
        if (shouldLoadMoreOnScroll(event.target as HTMLElement)) {
            void this.requestPrograms();
        }
    }

    readonly getChannelName = getEpgChannelName;

    getProgramAriaLabel(
        program: MultiEpgLayoutProgram,
        channel?: MultiEpgLayoutChannel
    ): string {
        const onNow = this.isProgramAiringNow(program)
            ? this.onNowLabel()
            : undefined;
        const name = channel ? this.getChannelName(channel) : undefined;
        return buildProgramAriaLabel(program, name, onNow);
    }
    readonly episodeBadge = formatEpisodeBadge;
    readonly onArtworkLoad = adjustArtworkFit;
    readonly categoryAccent = getEpgCategoryAccent;

    zoomIn(): void {
        if (this.hourWidth() >= 800) return;
        this.hourWidth.update((v) => v + 50);
    }

    zoomOut(): void {
        if (this.hourWidth() <= 50) return;
        this.hourWidth.update((v) => v - 50);
    }

    switchDay(direction: 'prev' | 'next'): void {
        this.timeAxis.switchDay(direction);
        this.scrollTimelineTo(0);
    }

    returnToToday(): void {
        this.timeAxis.returnToToday();
        this.scrollToCurrentTime();
    }

    isProgramFocusTarget(
        program: MultiEpgLayoutProgram,
        channelIndex: number,
        programIndex: number
    ): boolean {
        return this.programFocus.isFocusTarget(
            program,
            channelIndex,
            programIndex
        );
    }

    onProgramFocus(program: MultiEpgLayoutProgram): void {
        this.programFocus.onFocus(program);
    }

    onProgramKeydown(
        event: KeyboardEvent,
        program: MultiEpgLayoutProgram,
        channelIndex: number,
        programIndex: number
    ): void {
        this.programFocus.onKeydown(event, program, channelIndex, programIndex);
    }

    onProgramSearchInput(event: Event): void {
        this.programSearch.update((event.target as HTMLInputElement).value);
    }

    /** Programme selected in grid or search results: tune to its channel. */
    activateProgram(program: GuideProgram, width: string): void {
        this.activator.activate(program, width);
    }

    /** Info button on a cell: the description card, opt-in only. */
    openProgramDetails(
        event: Event,
        program: GuideProgram,
        width: string
    ): void {
        event.stopPropagation(); // the cell itself tunes
        this.activator.openDetails(program, width);
    }

    getProgramKey(program: ProgramSearchResult): string {
        const channelId = program.channel_id || program.channel;
        return `${channelId}|${program.start}`;
    }

    close() {
        this.overlayRef?.detach();
    }

    private resetChannelBrowser(): void {
        this.browser.reset();
        this.dateCache.clear();
    }

    private scrollTimelineTo(left: number): void {
        requestAnimationFrame(() => {
            this.timelineContainer()?.nativeElement.scrollTo(left, 0);
        });
    }
}
