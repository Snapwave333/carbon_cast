import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { Channel } from '@iptvnator/shared/interfaces';
import { expandChannelCategories } from '@iptvnator/shared/m3u-utils';
import { ChannelGroup } from '../channel-group.model';
import { GroupManagementDialogComponent } from './group-management-dialog/group-management-dialog.component';
import { GroupsViewComponent } from './groups-view.component';

const GROUP_CHANNEL_SORT_STORAGE_KEY = 'm3u-groups-channel-sort-mode';

/**
 * Mirror the container's canonical grouping: treat each record key as a raw
 * M3U group-title, expand it into canonical buckets, and merge channels by
 * canonical key (first-seen label wins).
 */
function toChannelGroups(record: Record<string, Channel[]>): ChannelGroup[] {
    const buckets = new Map<string, { label: string; channels: Channel[] }>();

    for (const [rawTitle, channels] of Object.entries(record)) {
        for (const { key, label } of expandChannelCategories(rawTitle)) {
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { label, channels: [] };
                buckets.set(key, bucket);
            }
            bucket.channels.push(...channels);
        }
    }

    return Array.from(buckets, ([key, { label, channels }]) => ({
        key,
        label,
        channels,
    }));
}

function createChannel(
    id: string,
    name: string,
    url: string,
    groupTitle: string
): Channel {
    return {
        epgParams: '',
        group: {
            title: groupTitle,
        },
        http: {
            origin: '',
            referrer: '',
            'user-agent': '',
        },
        id,
        name,
        radio: 'false',
        tvg: {
            id: `${id}-tvg`,
            logo: '',
            name,
            rec: '',
            url: '',
        },
        url,
    } as Channel;
}

describe('GroupsViewComponent', () => {
    let fixture: ComponentFixture<GroupsViewComponent>;
    let component: GroupsViewComponent;
    let dialog: { open: jest.Mock };

    const sportsCenter = createChannel(
        'sports-1',
        'Sports Center',
        'http://example.com/sports-center.m3u8',
        'Sports'
    );
    const matchNight = createChannel(
        'sports-2',
        'Match Night',
        'http://example.com/match-night.m3u8',
        'Sports'
    );
    const worldUpdate = createChannel(
        'news-1',
        'World Update',
        'http://example.com/world-update.m3u8',
        'News'
    );
    const dailyBulletin = createChannel(
        'news-2',
        'Daily Bulletin',
        'http://example.com/daily-bulletin.m3u8',
        'News'
    );
    const movieClassic = createChannel(
        'movies-1',
        'Movie Classic',
        'http://example.com/movie-classic.m3u8',
        'Movies'
    );
    const scienceNow = createChannel(
        'science-1',
        'Science Now',
        'http://example.com/science-now.m3u8',
        'Series'
    );

    const groupedChannels: Record<string, Channel[]> = {
        Movies: [movieClassic],
        News: [worldUpdate, dailyBulletin],
        Series: [scienceNow],
        Sports: [sportsCenter, matchNight],
    };

    beforeAll(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            configurable: true,
            value: jest.fn(),
            writable: true,
        });
    });

    beforeEach(async () => {
        localStorage.removeItem(GROUP_CHANNEL_SORT_STORAGE_KEY);

        dialog = {
            open: jest.fn(),
        };

        await TestBed.configureTestingModule({
            imports: [
                GroupsViewComponent,
                NoopAnimationsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                {
                    provide: MatDialog,
                    useValue: dialog,
                },
            ],
        }).compileComponents();

        createComponent();
    });

    afterEach(() => {
        fixture.destroy();
        localStorage.removeItem(GROUP_CHANNEL_SORT_STORAGE_KEY);
    });

    function createComponent(
        overrides: Partial<{
            activeChannelUrl: string | undefined;
            favoriteIds: Set<string>;
            groupedChannels: Record<string, Channel[]>;
            hiddenGroupTitles: string[];
            progressTick: number;
            searchTerm: string;
            sidebarWidth: number | null;
            shouldShowEpg: boolean;
        }> = {}
    ): void {
        fixture = TestBed.createComponent(GroupsViewComponent);
        component = fixture.componentInstance;
        setInputs(overrides);
    }

    function setInputs(
        overrides: Partial<{
            activeChannelUrl: string | undefined;
            favoriteIds: Set<string>;
            groupedChannels: Record<string, Channel[]>;
            hiddenGroupTitles: string[];
            progressTick: number;
            searchTerm: string;
            sidebarWidth: number | null;
            shouldShowEpg: boolean;
        }> = {}
    ): void {
        fixture.componentRef.setInput(
            'groupedChannels',
            toChannelGroups(overrides.groupedChannels ?? groupedChannels)
        );
        fixture.componentRef.setInput('searchTerm', overrides.searchTerm ?? '');
        fixture.componentRef.setInput('channelEpgMap', new Map<string, null>());
        fixture.componentRef.setInput(
            'channelIconMap',
            new Map<string, string>()
        );
        fixture.componentRef.setInput(
            'progressTick',
            overrides.progressTick ?? 0
        );
        fixture.componentRef.setInput(
            'shouldShowEpg',
            overrides.shouldShowEpg ?? true
        );
        fixture.componentRef.setInput(
            'activeChannelUrl',
            overrides.activeChannelUrl
        );
        fixture.componentRef.setInput(
            'favoriteIds',
            overrides.favoriteIds ?? new Set<string>()
        );
        fixture.componentRef.setInput(
            'hiddenGroupTitles',
            overrides.hiddenGroupTitles ?? []
        );
        fixture.componentRef.setInput(
            'sidebarWidth',
            overrides.sidebarWidth ?? 460
        );
        fixture.detectChanges();
    }

    it('sorts numbered groups first, in numeric order', () => {
        setInputs({
            groupedChannels: {
                '10 | Sports': [sportsCenter],
                '2 | Movies': [movieClassic],
                Alpha: [scienceNow],
            },
        });

        expect(component.filteredGroups().map((group) => group.label)).toEqual([
            '2 | Movies',
            '10 | Sports',
            'Alpha',
        ]);
    });

    it('ranks only a leading digit run, so "Sports HD 2" is not a numbered group', () => {
        setInputs({
            groupedChannels: {
                'Sports HD 2': [sportsCenter],
                Action: [movieClassic],
                '1 | Top': [scienceNow],
            },
        });

        // Stripping every non-digit instead ranked "Sports HD 2" as 2 and put
        // it ahead of "Action".
        expect(component.filteredGroups().map((group) => group.label)).toEqual([
            '1 | Top',
            'Action',
            'Sports HD 2',
        ]);
    });

    it('orders same-prefix groups naturally rather than lexically', () => {
        setInputs({
            groupedChannels: {
                'Group 10': [sportsCenter],
                'Group 2': [movieClassic],
            },
        });

        expect(component.filteredGroups().map((group) => group.label)).toEqual([
            'Group 2',
            'Group 10',
        ]);
    });

    it('defaults to playlist order when no saved sort mode exists', () => {
        expect(component.groupChannelSortMode()).toBe('server');
        expect(component.groupChannelSortLabel()).toBe(
            'CHANNELS.SORT_PLAYLIST_ORDER'
        );
    });

    it('restores a saved valid sort mode and ignores invalid stored values', () => {
        fixture.destroy();
        localStorage.setItem(GROUP_CHANNEL_SORT_STORAGE_KEY, 'name-asc');
        createComponent();

        expect(component.groupChannelSortMode()).toBe('name-asc');
        expect(component.groupChannelSortLabel()).toBe('CHANNELS.SORT_NAME_ASC');

        fixture.destroy();
        localStorage.setItem(GROUP_CHANNEL_SORT_STORAGE_KEY, 'invalid');
        createComponent();

        expect(component.groupChannelSortMode()).toBe('server');
    });

    it('falls back to an EPG icon for grouped channels without a playlist logo', () => {
        const channelWithoutLogo = {
            ...sportsCenter,
            tvg: {
                ...sportsCenter.tvg,
                logo: '',
            },
        };

        setInputs({
            groupedChannels: {
                Sports: [channelWithoutLogo],
            },
        });
        fixture.componentRef.setInput(
            'channelIconMap',
            new Map([
                [channelWithoutLogo.tvg.id, 'https://example.com/sports.png'],
            ])
        );
        fixture.detectChanges();

        expect(
            component.getLogoForChannel(component.selectedGroupChannels()[0])
        ).toBe('https://example.com/sports.png');
    });

    it('persists sort mode changes', () => {
        component.setGroupChannelSortMode('name-desc');

        expect(component.groupChannelSortMode()).toBe('name-desc');
        expect(localStorage.getItem(GROUP_CHANNEL_SORT_STORAGE_KEY)).toBe(
            'name-desc'
        );
    });

    it('sorts selected group channels by playlist order, name ascending, and name descending', () => {
        const alphaSignal = createChannel(
            'sort-1',
            'Alpha Signal',
            'http://example.com/alpha-signal.m3u8',
            'Sorted'
        );
        const zuluVision = createChannel(
            'sort-2',
            'Zulu Vision',
            'http://example.com/zulu-vision.m3u8',
            'Sorted'
        );
        const middleNews = createChannel(
            'sort-3',
            'Middle News',
            'http://example.com/middle-news.m3u8',
            'Sorted'
        );

        setInputs({
            groupedChannels: {
                Sorted: [zuluVision, alphaSignal, middleNews],
            },
        });

        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['Zulu Vision', 'Alpha Signal', 'Middle News']);

        component.setGroupChannelSortMode('name-asc');
        fixture.detectChanges();
        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['Alpha Signal', 'Middle News', 'Zulu Vision']);

        component.setGroupChannelSortMode('name-desc');
        fixture.detectChanges();
        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['Zulu Vision', 'Middle News', 'Alpha Signal']);
    });

    it('prefers the active channel group for initial selection', () => {
        setInputs({ activeChannelUrl: worldUpdate.url });

        expect(component.selectedGroupKey()).toBe('news');
        expect(component.selectedGroup()?.key).toBe('news');
        expect(component.selectedGroup()?.label).toBe('News');
    });

    it('keeps the first grouped-channel match for duplicate active channel URLs', () => {
        const movieMirror = createChannel(
            'mirror-1',
            'Movie Mirror',
            'http://example.com/shared-stream.m3u8',
            'Movies'
        );
        const sportsMirror = createChannel(
            'mirror-2',
            'Sports Mirror',
            'http://example.com/shared-stream.m3u8',
            'Sports'
        );

        setInputs({
            activeChannelUrl: 'http://example.com/shared-stream.m3u8',
            groupedChannels: {
                Movies: [movieMirror],
                Sports: [sportsMirror],
            },
        });

        expect(component.activeChannelGroupKey()).toBe('movies');
        expect(component.selectedGroupKey()).toBe('movies');
    });

    it('retains a visible manual selection and falls back to the first visible group', () => {
        component.selectGroup('movies');
        fixture.detectChanges();

        setInputs({
            activeChannelUrl: sportsCenter.url,
            searchTerm: 'movie',
        });
        expect(component.selectedGroupKey()).toBe('movies');

        setInputs({
            activeChannelUrl: sportsCenter.url,
            searchTerm: 'science',
        });
        expect(component.selectedGroupKey()).toBe('series');
    });

    it('switches selection to the active channel group when playback changes', () => {
        component.selectGroup('movies');
        fixture.detectChanges();

        setInputs({ activeChannelUrl: sportsCenter.url });
        expect(component.selectedGroupKey()).toBe('sports');

        setInputs({ activeChannelUrl: scienceNow.url });
        expect(component.selectedGroupKey()).toBe('series');
    });

    it('keeps group selection behavior unchanged when channel sort mode changes', () => {
        component.setGroupChannelSortMode('name-asc');
        component.selectGroup('movies');
        fixture.detectChanges();

        setInputs({ activeChannelUrl: sportsCenter.url });

        expect(component.selectedGroupKey()).toBe('sports');
        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'movies',
            'news',
            'series',
            'sports',
        ]);
    });

    it('matches group titles as full-group results and channel names as filtered results', () => {
        setInputs({ searchTerm: 'news' });

        expect(component.filteredGroups()).toEqual([
            expect.objectContaining({
                count: 2,
                key: 'news',
                label: 'News',
                titleMatches: true,
            }),
        ]);
        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['World Update', 'Daily Bulletin']);

        setInputs({ searchTerm: 'update' });

        expect(component.filteredGroups()).toEqual([
            expect.objectContaining({
                count: 1,
                key: 'news',
                label: 'News',
                titleMatches: false,
            }),
        ]);
        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['World Update']);
    });

    it('filters hidden groups from the rail and selected pane using canonical keys for raw stored titles', () => {
        setInputs({
            activeChannelUrl: worldUpdate.url,
            // Raw, differently-cased stored titles must still match the
            // canonical group keys (read-time back-compat coercion).
            hiddenGroupTitles: ['NEWS', ' Sports '],
        });

        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'movies',
            'series',
        ]);
        expect(component.selectedGroupKey()).toBe('movies');
        expect(
            component.selectedGroupChannels().map((channel) => channel.name)
        ).toEqual(['Movie Classic']);
    });

    it('collapses case, whitespace, alias, and semicolon variants into one canonical row', () => {
        setInputs({
            groupedChannels: {
                Animation: [
                    createChannel('a', 'Anim A', 'http://x/a.m3u8', 'Animation'),
                ],
                ANIMATION: [
                    createChannel('b', 'Anim B', 'http://x/b.m3u8', 'ANIMATION'),
                ],
                ' Animation ': [
                    createChannel(
                        'c',
                        'Anim C',
                        'http://x/c.m3u8',
                        ' Animation '
                    ),
                ],
                Anime: [createChannel('d', 'Anime D', 'http://x/d.m3u8', 'Anime')],
                'Animation;Kids': [
                    createChannel(
                        'e',
                        'Multi E',
                        'http://x/e.m3u8',
                        'Animation;Kids'
                    ),
                ],
            },
        });

        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'animation',
            'kids',
        ]);

        const animation = component
            .filteredGroups()
            .find((group) => group.key === 'animation');
        // key vs label split: canonical lower-cased key, first-seen display label.
        expect(animation?.label).toBe('Animation');
        expect(animation?.count).toBe(5);
    });

    it('hides every variant when a raw variant of the canonical key is stored, keeping other groups of a multi-group channel visible', () => {
        setInputs({
            groupedChannels: {
                Animation: [
                    createChannel('a', 'Anim A', 'http://x/a.m3u8', 'Animation'),
                ],
                ANIMATION: [
                    createChannel('b', 'Anim B', 'http://x/b.m3u8', 'ANIMATION'),
                ],
                'Animation;Kids': [
                    createChannel(
                        'e',
                        'Multi E',
                        'http://x/e.m3u8',
                        'Animation;Kids'
                    ),
                ],
            },
            hiddenGroupTitles: ['anime'],
        });

        // 'anime' → canonical 'animation', so the merged Animation row is hidden.
        // The multi-group channel remains under its still-visible Kids group.
        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'kids',
        ]);
    });

    it('opens the manage-groups dialog with all groups and emits updated hidden titles on save', () => {
        const hiddenGroupTitlesChanged = jest.fn();
        component.hiddenGroupTitlesChanged.subscribe(hiddenGroupTitlesChanged);
        dialog.open.mockReturnValue({
            afterClosed: () => of(['News', 'Sports']),
        });

        component.openGroupManagement();

        expect(dialog.open).toHaveBeenCalledWith(
            GroupManagementDialogComponent,
            expect.objectContaining({
                data: expect.objectContaining({
                    hiddenGroupTitles: [],
                    groups: expect.arrayContaining([
                        { key: 'movies', count: 1, label: 'Movies' },
                        { key: 'news', count: 2, label: 'News' },
                        { key: 'series', count: 1, label: 'Series' },
                        { key: 'sports', count: 2, label: 'Sports' },
                    ]),
                }),
                maxHeight: '90vh',
                width: '500px',
            })
        );
        expect(hiddenGroupTitlesChanged).toHaveBeenCalledWith([
            'News',
            'Sports',
        ]);
    });

    it('toggles the inline group search from the header action and filters the visible groups', () => {
        const searchButton = fixture.nativeElement.querySelector(
            '.groups-nav-action--search'
        ) as HTMLButtonElement;

        searchButton.click();
        fixture.detectChanges();

        const searchInput = fixture.nativeElement.querySelector(
            '.groups-nav-search input'
        ) as HTMLInputElement | null;

        expect(searchInput).not.toBeNull();

        searchInput!.value = 'spo';
        searchInput!.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'sports',
        ]);
        expect(component.selectedGroupKey()).toBe('sports');

        searchButton.click();
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.groups-nav-search input')
        ).toBeNull();
        expect(component.filteredGroups().map((group) => group.key)).toEqual([
            'movies',
            'news',
            'series',
            'sports',
        ]);
    });

    it('emits channel and favorite events from the selected group pane', () => {
        const channelSelected = jest.fn();
        const favoriteToggled = jest.fn();
        const clickEvent = new MouseEvent('click');

        component.channelSelected.subscribe(channelSelected);
        component.favoriteToggled.subscribe(favoriteToggled);

        component.onChannelClick(movieClassic);
        component.onFavoriteToggle(movieClassic, clickEvent);

        expect(channelSelected).toHaveBeenCalledWith(movieClassic);
        expect(favoriteToggled).toHaveBeenCalledWith({
            channel: movieClassic,
            event: clickEvent,
        });
    });


    it('emits total sidebar width requests while resizing the groups rail', () => {
        const requested = jest.fn();
        const committed = jest.fn();
        let contentWidth = 252;

        component.sidebarWidthRequested.subscribe(requested);
        component.sidebarWidthRequestEnded.subscribe(committed);

        const contentPanel = fixture.nativeElement.querySelector(
            '.groups-content-panel'
        ) as HTMLElement;

        jest.spyOn(contentPanel, 'getBoundingClientRect').mockImplementation(
            () =>
                ({
                    bottom: 0,
                    height: 0,
                    left: 0,
                    right: 0,
                    top: 0,
                    width: contentWidth,
                    x: 0,
                    y: 0,
                    toJSON: () => ({}),
                }) as DOMRect
        );

        component.onGroupsNavResizeStart();
        contentWidth = 120;

        component.onGroupsNavWidthChange(260);
        component.onGroupsNavResizeEnd(260);

        expect(requested).toHaveBeenCalledWith(512);
        expect(committed).toHaveBeenCalledWith(512);
    });

    it('keeps the layout visible for searches without matches', () => {
        setInputs({ searchTerm: 'zzz' });

        const layout = fixture.nativeElement.querySelector(
            '.groups-view-layout'
        ) as HTMLElement | null;
        const emptyState = fixture.nativeElement.querySelector(
            '.groups-content-empty-state'
        ) as HTMLElement | null;
        const manageButton = fixture.nativeElement.querySelector(
            '.groups-nav-action--manage'
        ) as HTMLButtonElement | null;

        expect(layout).not.toBeNull();
        expect(emptyState).not.toBeNull();
        expect(emptyState?.textContent).toContain('CHANNELS.NO_SEARCH_RESULTS');
        expect(manageButton).not.toBeNull();
    });

    it('renders the empty-category state when no grouped channels exist', () => {
        setInputs({ groupedChannels: {} });

        const emptyState = fixture.nativeElement.querySelector(
            '.groups-view-empty-state'
        ) as HTMLElement | null;

        expect(emptyState).not.toBeNull();
        expect(emptyState?.textContent).toContain(
            'PORTALS.ERROR_VIEW.EMPTY_CATEGORY.TITLE'
        );
    });

    it('keeps the manage action visible when all groups are hidden', () => {
        setInputs({
            hiddenGroupTitles: ['Movies', 'News', 'Series', 'Sports'],
        });

        const layout = fixture.nativeElement.querySelector(
            '.groups-view-layout'
        ) as HTMLElement | null;
        const emptyState = fixture.nativeElement.querySelector(
            '.groups-content-empty-state'
        ) as HTMLElement | null;
        const manageButton = fixture.nativeElement.querySelector(
            '.groups-nav-action--manage'
        ) as HTMLButtonElement | null;

        expect(layout).not.toBeNull();
        expect(emptyState?.textContent).toContain('CHANNELS.NO_VISIBLE_GROUPS');
        expect(manageButton).not.toBeNull();
    });
});
