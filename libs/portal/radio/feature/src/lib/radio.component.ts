import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    episodeToTrack,
    PodcastDirectoryService,
    PodcastEpisode,
    PodcastFeedService,
    PodcastShow,
    RadioBrowserService,
    RadioFacet,
    RadioLibraryStore,
    RadioPlayerStore,
    RadioStation,
    RadioTrack,
    RemoteTextUnavailableError,
    stationToTrack,
} from '@iptvnator/portal/radio/data-access';
import { AsyncCollection, Debouncer } from './radio-async-collection';
import {
    groupStations,
    SORT_ORDERS,
    STATION_SORTS,
    StationGroup,
    StationSort,
    sortWithinGroups,
} from './radio-station-sort';
import { nextTabIndex, RADIO_TABS } from './radio-tabs';
import { RadioEpisodeListComponent } from './radio-episode-list/radio-episode-list.component';
import { RadioPodcastGridComponent } from './radio-podcast-grid/radio-podcast-grid.component';
import { RadioStationGridComponent } from './radio-station-grid/radio-station-grid.component';

export type RadioTab = 'stations' | 'podcasts' | 'library';

const SEARCH_DEBOUNCE_MS = 450;
const STATION_PAGE_SIZE = 60;

@Component({
    selector: 'app-radio',
    templateUrl: './radio.component.html',
    styleUrl: './radio.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIcon,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatTooltip,
        RadioEpisodeListComponent,
        RadioPodcastGridComponent,
        RadioStationGridComponent,
        TranslatePipe,
    ],
})
export class RadioComponent {
    private readonly radioBrowser = inject(RadioBrowserService);
    private readonly podcastDirectory = inject(PodcastDirectoryService);
    private readonly podcastFeed = inject(PodcastFeedService);
    private readonly library = inject(RadioLibraryStore);
    private readonly player = inject(RadioPlayerStore);

    private readonly stationRequest = new AsyncCollection<RadioStation>();
    private readonly showRequest = new AsyncCollection<PodcastShow>();
    private readonly episodeRequest = new AsyncCollection<PodcastEpisode>();
    private readonly stationDebounce = new Debouncer(SEARCH_DEBOUNCE_MS);
    private readonly podcastDebounce = new Debouncer(SEARCH_DEBOUNCE_MS);

    readonly tab = signal<RadioTab>('stations');
    readonly tabs = RADIO_TABS;
    /** Placeholder cards shown while a catalogue page is still loading. */
    readonly skeletonSlots = Array.from({ length: 12 }, (_, index) => index);

    private readonly tabButtons =
        viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

    readonly stationSearch = signal('');
    readonly stationSort = signal<StationSort>('popular');
    readonly stationSorts = STATION_SORTS;
    readonly countryFilter = signal('');
    readonly tagFilter = signal('');
    readonly countries = signal<RadioFacet[]>([]);
    readonly tags = signal<RadioFacet[]>([]);
    readonly stations = this.stationRequest.state;

    readonly podcastSearch = signal('');
    readonly shows = this.showRequest.state;
    readonly selectedShow = signal<PodcastShow | null>(null);
    readonly episodes = this.episodeRequest.state;
    /** The feed host refused a direct browser request (PWA build only). */
    readonly episodesBlocked = signal(false);

    readonly favoriteStations = this.library.favoriteStations;
    readonly subscribedShows = this.library.subscribedShows;
    readonly recentTracks = this.library.recentTracks;
    readonly currentTrack = this.player.current;

    readonly hasStationFilters = computed(
        () =>
            this.stationSearch().trim().length > 0 ||
            this.countryFilter().length > 0 ||
            this.tagFilter().length > 0
    );
    readonly stationsHeading = computed(() => {
        if (this.hasStationFilters()) {
            return 'RADIO.SEARCH_RESULTS';
        }
        const sort = this.stationSort();
        if (sort === 'trending') {
            return 'RADIO.TRENDING_STATIONS';
        }
        // Country and genre re-order the top list rather than the whole
        // catalogue, so they keep the top-stations heading.
        return sort === 'name' ? 'RADIO.ALL_STATIONS' : 'RADIO.TOP_STATIONS';
    });
    /** Catalogue tags ranked by station count — the genre-snapping vocabulary. */
    private readonly knownGenres = computed(() =>
        this.tags().map((tag) => tag.name.toLowerCase())
    );
    readonly stationGroups = computed<StationGroup[]>(() =>
        groupStations(
            this.stations().items,
            this.stationSort(),
            this.knownGenres()
        )
    );
    readonly podcastsHeading = computed(() =>
        this.podcastSearch().trim()
            ? 'RADIO.SEARCH_RESULTS'
            : 'RADIO.TOP_PODCASTS'
    );
    readonly currentStationId = computed(() => {
        const track = this.currentTrack();
        return track?.kind === 'station' ? track.id : null;
    });
    readonly currentEpisodeId = computed(() => {
        const track = this.currentTrack();
        return track?.kind === 'episode' ? track.id : null;
    });
    readonly isLibraryEmpty = computed(
        () =>
            this.favoriteStations().length === 0 &&
            this.subscribedShows().length === 0 &&
            this.recentTracks().length === 0
    );

    /**
     * Template-friendly predicates. Passing bound lookups keeps the grid
     * components free of a dependency on the library store.
     */
    readonly isFavoriteStation = computed(
        () => (stationId: string) => this.library.isFavoriteStation(stationId)
    );
    readonly isSubscribed = computed(
        () => (showId: string) => this.library.isSubscribed(showId)
    );
    readonly episodeResumePercent = computed(() => (episodeId: string) => {
        const progress = this.library.episodeProgress(episodeId);
        if (!progress?.durationSeconds) {
            return 0;
        }
        return Math.min(
            100,
            Math.round(
                (progress.positionSeconds / progress.durationSeconds) * 100
            )
        );
    });

    private hasLoadedPodcasts = false;

    constructor() {
        void this.loadFacets();
        void this.loadStations();

        effect(() => {
            const activeTab = this.tab();
            untracked(() => {
                if (activeTab === 'podcasts' && !this.hasLoadedPodcasts) {
                    this.hasLoadedPodcasts = true;
                    void this.loadPodcasts();
                }
            });
        });
    }

    selectTab(tab: RadioTab): void {
        this.tab.set(tab);
    }

    /**
     * Roving-tabindex keyboard support for the tablist. Activation follows
     * focus, the expected behaviour for a tablist whose panels are preloaded.
     */
    onTabKeydown(event: KeyboardEvent, index: number): void {
        const next = nextTabIndex(event.key, index, this.tabs.length);
        if (next === null) {
            return;
        }

        event.preventDefault();
        this.selectTab(this.tabs[next].id);
        this.tabButtons()[next]?.nativeElement.focus();
    }

    onStationSearchChange(value: string): void {
        this.stationSearch.set(value);
        this.stationDebounce.schedule(() => void this.loadStations());
    }

    onStationFilterChange(): void {
        void this.loadStations();
    }

    setStationSort(sort: StationSort): void {
        this.stationSort.set(sort);
        void this.loadStations();
    }

    clearStationFilters(): void {
        this.stationSearch.set('');
        this.countryFilter.set('');
        this.tagFilter.set('');
        void this.loadStations();
    }

    onPodcastSearchChange(value: string): void {
        this.podcastSearch.set(value);
        this.podcastDebounce.schedule(() => void this.loadPodcasts());
    }

    playStation(station: RadioStation, queue?: readonly RadioStation[]): void {
        this.player.play(
            stationToTrack(station),
            (queue ?? [station]).map(stationToTrack)
        );
    }

    playStationFromResults(station: RadioStation): void {
        this.playStation(station, this.stations().items);
    }

    playStationFromFavorites(station: RadioStation): void {
        this.playStation(station, this.favoriteStations());
    }

    toggleFavoriteStation(station: RadioStation): void {
        this.library.toggleFavoriteStation(station);
    }

    toggleSubscription(show: PodcastShow): void {
        this.library.toggleSubscription(show);
    }

    openShow(show: PodcastShow): void {
        this.selectedShow.set(show);
        void this.loadEpisodes(show);
    }

    closeShow(): void {
        this.selectedShow.set(null);
        this.episodeRequest.reset();
    }

    refreshShow(): void {
        const show = this.selectedShow();
        if (show) {
            void this.loadEpisodes(show, true);
        }
    }

    playEpisode(episode: PodcastEpisode): void {
        this.player.play(
            episodeToTrack(episode),
            this.episodes().items.map(episodeToTrack)
        );
    }

    playRecent(track: RadioTrack): void {
        this.player.play(track, this.recentTracks());
    }

    clearRecent(): void {
        this.library.clearRecent();
    }

    retryStations(): void {
        void this.loadStations();
    }

    retryPodcasts(): void {
        void this.loadPodcasts();
    }

    private async loadFacets(): Promise<void> {
        try {
            const [countries, tags] = await Promise.all([
                this.radioBrowser.countries(),
                this.radioBrowser.tags(),
            ]);
            this.countries.set(countries);
            this.tags.set(tags);
        } catch {
            // Filters simply stay unavailable; browsing still works.
        }
    }

    private loadStations(): Promise<void> {
        const name = this.stationSearch().trim();
        const country = this.countryFilter();
        const tag = this.tagFilter();
        const sort = this.stationSort();
        const { order, reverse } = SORT_ORDERS[sort];

        return this.stationRequest.run(async () => {
            // The dedicated top-lists are richer than an unfiltered search, so
            // they stay the fast path when nothing narrows the results. Only
            // the name sort needs the catalogue-wide alphabetical ordering.
            const useTopList = !name && !country && !tag && sort !== 'name';

            const stations = useTopList
                ? await (sort === 'trending'
                      ? this.radioBrowser.trendingStations(STATION_PAGE_SIZE)
                      : this.radioBrowser.topStations(STATION_PAGE_SIZE))
                : await this.radioBrowser.searchStations({
                      name: name || undefined,
                      countryCode: country || undefined,
                      tag: tag || undefined,
                      order,
                      reverse,
                      limit: STATION_PAGE_SIZE,
                  });

            return sortWithinGroups(stations, sort, this.knownGenres());
        });
    }

    private loadPodcasts(): Promise<void> {
        const term = this.podcastSearch().trim();

        return this.showRequest.run(() =>
            term
                ? this.podcastDirectory.search(term)
                : this.podcastDirectory.topShows()
        );
    }

    private loadEpisodes(show: PodcastShow, forceRefresh = false): Promise<void> {
        this.episodesBlocked.set(false);

        return this.episodeRequest.run(
            async () => (await this.podcastFeed.load(show, forceRefresh)).episodes,
            (error) =>
                this.episodesBlocked.set(
                    error instanceof RemoteTextUnavailableError
                )
        );
    }
}
