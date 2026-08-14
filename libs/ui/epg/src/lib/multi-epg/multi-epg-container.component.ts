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
    viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { normalizeDateLocale } from '@iptvnator/pipes';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addDays, format, parse, subDays } from 'date-fns';
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
    openMultiEpgProgramDialog,
} from './multi-epg-program-dialog';
import {
    buildProgramAriaLabel,
    getEpgChannelName,
    isSelectedEpgDayToday,
    layoutEpgChannelsForDay,
    MultiEpgLayoutProgram,
} from './multi-epg-layout.util';
import {
    MultiEpgProgramSearch,
    ProgramSearchResult,
} from './multi-epg-program-search';
import { COMPONENT_OVERLAY_REF } from './overlay-ref.token';

@Component({
    imports: [DatePipe, MatButtonModule, MatIcon, MatTooltip, TranslatePipe],
    selector: 'app-multi-epg-container',
    templateUrl: './multi-epg-container.component.html',
    styleUrls: ['./multi-epg-container.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiEpgContainerComponent
    implements OnInit, AfterViewInit, OnDestroy
{
    readonly epgContainer = viewChild.required<ElementRef>('epgContainer');
    readonly timelineContainer =
        viewChild<ElementRef<HTMLElement>>('timelineContainer');

    private readonly dialog = inject(MatDialog);
    private readonly epgBridge = inject(EpgRuntimeBridgeService);
    private readonly settingsStore = inject(SettingsStore);
    readonly programSearch = new MultiEpgProgramSearch(
        (query, limit) => this.epgBridge.searchPrograms(query, limit),
        () => this.epgBridge.supportsProgramSearch
    );
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

    /** "Watch live" / "Watch from start" chosen in a programme dialog. */
    readonly playRequested = output<MultiEpgPlayRequest>();

    readonly hourWidth = signal(150);
    readonly today = signal(format(new Date(), 'yyyyMMdd'));
    readonly originalEpgData = this.browser.data;
    readonly isLoading = this.browser.isLoading;
    readonly loadError = this.browser.loadError;
    readonly isLastPage = this.browser.isLastPage;
    readonly channelFilter = signal('');
    readonly isSearchExpanded = signal(false);
    private readonly clockTick = signal(Date.now());

    readonly isProgramSearchOpen = this.programSearch.isOpen;
    readonly programSearchQuery = this.programSearch.query;
    readonly programSearchResults = this.programSearch.results;
    readonly isSearchingPrograms = this.programSearch.isSearching;
    readonly programSearchError = this.programSearch.error;
    readonly highlightedProgramKey = signal<string | null>(null);
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
    readonly selectedDayDate = computed(() =>
        parse(this.today(), 'yyyyMMdd', new Date())
    );
    readonly isToday = computed(() => {
        this.clockTick();
        return isSelectedEpgDayToday(this.today());
    });

    readonly channels = computed(() =>
        layoutEpgChannelsForDay(
            this.originalEpgData(),
            this.today(),
            this.hourWidth(),
            this.dateCache
        )
    );

    readonly filteredChannels = computed(() => {
        const filter = this.channelFilter().toLowerCase().trim();
        const allChannels = this.channels();

        if (!filter) {
            return allChannels;
        }

        return allChannels.filter((channel) => {
            const name = this.getChannelName(channel).toLowerCase();
            return name.includes(filter);
        });
    });

    readonly currentTimeLine = computed(() => {
        const now = new Date(this.clockTick());
        return (now.getHours() + now.getMinutes() / 60) * this.hourWidth();
    });

    readonly currentTimeLabel = computed(() => {
        const now = new Date(this.clockTick());
        return `${now.getHours().toString().padStart(2, '0')}:${now
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
    });

    readonly timeHeader = Array.from({ length: 24 }, (_, i) => i);
    readonly barHeight = 50;

    private dateCache = new Map<string, Date>();
    private interval?: ReturnType<typeof setInterval>;
    private playlistChannelsSubscription?: Subscription;

    private readonly overlayRef = inject<OverlayRef | null>(
        COMPONENT_OVERLAY_REF,
        { optional: true }
    );
    readonly isOverlay = this.overlayRef !== null;

    ngOnInit() {
        this.interval = setInterval(() => {
            this.clockTick.set(Date.now());
        }, 60000);
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
        if (epgContainer) {
            const containerHeight = epgContainer.nativeElement.offsetHeight;
            const calculatedVisibleChannels = Math.floor(
                (containerHeight - this.barHeight) / this.barHeight
            );

            this.browser.visibleChannels = Math.max(
                10,
                Math.min(calculatedVisibleChannels, 20)
            );
        }
    }

    ngOnDestroy(): void {
        if (this.interval) clearInterval(this.interval);

        if (this.playlistChannelsSubscription) {
            this.playlistChannelsSubscription.unsubscribe();
        }

        this.programSearch.destroy();
        this.browser.invalidate();
        this.dateCache.clear();
    }

    trackByProgram(_: number, program: MultiEpgLayoutProgram): string {
        return `${program.start}|${program?.title?.toString() ?? ''}`;
    }

    isProgramAiringNow(program: MultiEpgLayoutProgram): boolean {
        const nowX = this.currentTimeLine();
        if (!this.isToday()) return false;
        return (
            nowX >= program.startPosition &&
            nowX <= program.startPosition + program.width
        );
    }

    requestPrograms(): Promise<void> {
        return this.browser.requestPrograms();
    }

    onScroll(event: Event): void {
        const target = event.target as HTMLElement;
        const scrollTop = target.scrollTop;
        const scrollHeight = target.scrollHeight;
        const clientHeight = target.clientHeight;

        // Load more when user scrolls to within 200px of the bottom
        if (scrollHeight - scrollTop - clientHeight < 200) {
            void this.requestPrograms();
        }
    }

    readonly getChannelName = getEpgChannelName;
    readonly getProgramAriaLabel = buildProgramAriaLabel;
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

    toggleSearch(): void {
        this.isSearchExpanded.update((v) => !v);
        if (!this.isSearchExpanded()) {
            this.channelFilter.set('');
        }
    }

    switchDay(direction: 'prev' | 'next'): void {
        const currentDate = parse(this.today(), 'yyyyMMdd', new Date());
        this.today.set(
            direction === 'prev'
                ? format(subDays(currentDate, 1), 'yyyyMMdd')
                : format(addDays(currentDate, 1), 'yyyyMMdd')
        );
        this.scrollTimelineTo(0);
    }

    returnToToday(): void {
        this.today.set(format(new Date(), 'yyyyMMdd'));
        this.clockTick.set(Date.now());
        this.scrollToCurrentTime();
    }

    activateProgramFromKeyboard(
        event: KeyboardEvent,
        program: EpgProgram
    ): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.openProgramDialog(program, '600px');
    }

    onProgramSearchInput(event: Event): void {
        this.programSearch.update((event.target as HTMLInputElement).value);
    }

    openProgramDialog(
        program: EpgProgram & { channel_id?: string },
        width: string
    ): void {
        const channelId = program.channel_id || program.channel;
        openMultiEpgProgramDialog({
            dialog: this.dialog,
            program,
            channel: this.channels().find((ch) => ch.id === channelId),
            catchupResolver: this.catchupResolver,
            width,
            onPlay: (request) => this.playRequested.emit(request),
        });
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
