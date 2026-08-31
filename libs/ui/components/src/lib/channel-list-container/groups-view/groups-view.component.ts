import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OutputEmitterRef,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import {
    CdkVirtualScrollViewport,
    ScrollingModule,
} from '@angular/cdk/scrolling';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    Channel,
    ChannelSortMode,
    EpgProgram,
    getChannelSortModeLabelKey,
    persistChannelSortMode,
    restoreChannelSortMode,
    sortChannelItems,
} from '@iptvnator/shared/interfaces';
import { ChannelGroup } from '../channel-group.model';
import { GroupsNavResizeController } from './groups-nav-resize.controller';
import {
    buildGroupKeyByChannelUrl,
    FilteredGroupView,
    filterGroupsByChannelSearch,
    filterGroupsByLabel,
    filterHiddenGroups,
    GroupView,
    toSortedGroupViews,
} from './groups-view.filters';
import {
    resolveGroupSelection,
    scrollGroupIntoView,
} from './groups-view.selection';
import {
    CHANNEL_ROW_COMPACT_HEIGHT_PX,
    CHANNEL_ROW_HEIGHT_PX,
} from '../channel-row-metrics';
import { categoryIconFor } from './category-icon.util';
import { buildChannelEpgMetadataMap } from '../epg-enrichment.util';
import { channelEpgLookupKey } from '../channel-epg-key.util';
import { channelTrackKey } from '../channel-track-key.util';
import { ListboxCursor } from '../listbox-cursor';
import { resolveChannelLogo } from '../channel-logo-fallback.util';
import { ChannelContextMenuComponent } from '../channel-context-menu/channel-context-menu.component';
import { ChannelListItemComponent } from '../channel-list-item/channel-list-item.component';
import { ResizableDirective } from '../../resizable/resizable.directive';
import {
    GroupManagementDialogComponent,
    GroupManagementDialogGroup,
} from './group-management-dialog/group-management-dialog.component';

const GROUP_CHANNEL_SORT_STORAGE_KEY = 'm3u-groups-channel-sort-mode';

interface GroupNavigationSection {
    readonly key: string;
    readonly label: string | null;
    readonly groups: ReadonlyArray<FilteredGroupView>;
}

function getGroupNavigationSectionKey(label: string): string {
    const normalizedLabel = label.replace(/^\d+\s*[|:.-]\s*/, '').trim();
    const firstCharacter = Array.from(normalizedLabel)[0];

    if (
        !firstCharacter ||
        firstCharacter.toLocaleUpperCase() ===
            firstCharacter.toLocaleLowerCase()
    ) {
        return '#';
    }

    return firstCharacter.toLocaleUpperCase();
}

function createGroupNavigationSections(
    groups: readonly FilteredGroupView[]
): ReadonlyArray<GroupNavigationSection> {
    const sections = new Map<string, FilteredGroupView[]>();

    for (const group of groups) {
        const key = getGroupNavigationSectionKey(group.label);
        const sectionGroups = sections.get(key) ?? [];
        sectionGroups.push(group);
        sections.set(key, sectionGroups);
    }

    const showSectionLabels = sections.size > 1 && groups.length > 7;

    return Array.from(sections.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, sectionGroups]) => ({
            key,
            label: showSectionLabels ? key : null,
            groups: sectionGroups,
        }));
}

@Component({
    selector: 'app-groups-view',
    templateUrl: './groups-view.component.html',
    styleUrls: ['./groups-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ChannelContextMenuComponent,
        ChannelListItemComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        ResizableDirective,
        ScrollingModule,
        TranslatePipe,
    ],
})
export class GroupsViewComponent {
    private readonly dialog = inject(MatDialog);
    private readonly hostEl = inject(ElementRef<HTMLElement>);
    private readonly navResize = new GroupsNavResizeController(
        this.hostEl.nativeElement,
        () => this.sidebarWidth()
    );

    readonly groupSearchInput =
        viewChild<ElementRef<HTMLInputElement>>('groupSearchInput');
    private readonly channelsViewport = viewChild(CdkVirtualScrollViewport);

    private readonly cursor = new ListboxCursor({
        count: () => this.selectedGroupChannels().length,
        optionId: (index) => `group-channel-option-${index}`,
        activate: (index) => {
            const channel = this.selectedGroupChannels()[index];
            if (channel) {
                this.channelSelected.emit(channel);
            }
        },
        scrollToIndex: (index) =>
            this.channelsViewport()?.scrollToIndex(index, 'smooth'),
    });

    readonly focusedIndex = this.cursor.focusedIndex;
    readonly activeDescendantId = this.cursor.activeDescendantId;

    /** Merged, canonical category buckets */
    readonly groupedChannels = input.required<readonly ChannelGroup[]>();
    readonly searchTerm = input('');

    /** EPG map for channel enrichment */
    readonly channelEpgMap = input.required<Map<string, EpgProgram | null>>();
    readonly channelIconMap = input.required<Map<string, string>>();

    /** Progress tick to trigger progress recalculation */
    readonly progressTick = input.required<number>();

    /** Whether to show EPG data */
    readonly shouldShowEpg = input.required<boolean>();
    readonly openOnDoubleClick = input(false);

    /** Currently active channel URL */
    readonly activeChannelUrl = input<string | undefined>();

    /** Set of favorite channel URLs */
    readonly favoriteIds = input<Set<string>>(new Set());
    readonly hiddenGroupTitles = input<string[]>([]);

    /** Current outer sidebar width */
    readonly sidebarWidth = input<number | null>(null);

    /** Emits when a channel is selected */
    readonly channelSelected = output<Channel>();
    readonly channelPlaybackRequested = output<Channel>();

    /** Emits when favorite is toggled */
    readonly favoriteToggled = output<{
        channel: Channel;
        event: MouseEvent;
    }>();

    /** Emits while the groups rail requests a larger total sidebar width */
    readonly sidebarWidthRequested = output<number>();

    /** Emits when the groups rail resize ends */
    readonly sidebarWidthRequestEnded = output<number>();
    readonly hiddenGroupTitlesChanged = output<string[]>();

    /** Emits when the user clicks the inline collapse toggle in the groups header */
    readonly sidebarToggleRequested = output<void>();

    readonly isGroupSearchOpen = signal(false);
    readonly localGroupSearchTerm = signal('');
    readonly selectedGroupKey = signal<string | null>(null);
    readonly groupChannelSortMode = signal<ChannelSortMode>(
        restoreChannelSortMode(GROUP_CHANNEL_SORT_STORAGE_KEY)
    );
    readonly groupChannelSortLabel = computed(() =>
        getChannelSortModeLabelKey(this.groupChannelSortMode())
    );
    readonly hasSearchQuery = computed(
        () =>
            this.searchTerm().trim().length > 0 ||
            this.localGroupSearchTerm().trim().length > 0
    );
    readonly itemSize = computed(() =>
        this.shouldShowEpg()
            ? CHANNEL_ROW_HEIGHT_PX
            : CHANNEL_ROW_COMPACT_HEIGHT_PX
    );

    private previousActiveChannelUrl: string | undefined;

    constructor() {
        effect(() => {
            const filteredGroups = this.filteredGroups();
            const activeChannelUrl = this.activeChannelUrl();
            const currentSelection = this.selectedGroupKey();
            const nextSelection = resolveGroupSelection({
                visibleKeys: filteredGroups.map((group) => group.key),
                currentSelection,
                activeGroupKey: this.activeChannelGroupKey(),
                activeChannelChanged:
                    activeChannelUrl !== this.previousActiveChannelUrl,
            });

            this.previousActiveChannelUrl = activeChannelUrl;

            if (nextSelection !== currentSelection) {
                this.selectedGroupKey.set(nextSelection);
            }
        });

        effect(() => {
            const selectedGroupKey = this.selectedGroupKey();
            if (selectedGroupKey == null) {
                return;
            }

            // Wait for the rail to render the selected row before measuring it.
            queueMicrotask(() => {
                scrollGroupIntoView(
                    this.hostEl.nativeElement,
                    selectedGroupKey
                );
            });
        });

        effect(() => {
            if (!this.isGroupSearchOpen()) {
                return;
            }

            queueMicrotask(() => {
                this.groupSearchInput()?.nativeElement.focus();
            });
        });
    }

    readonly allGroups = computed<GroupView[]>(() =>
        toSortedGroupViews(this.groupedChannels())
    );

    readonly visibleGroups = computed(() =>
        filterHiddenGroups(this.allGroups(), this.hiddenGroupTitles())
    );

    readonly workspaceFilteredGroups = computed<FilteredGroupView[]>(() =>
        filterGroupsByChannelSearch(this.visibleGroups(), this.searchTerm())
    );

    readonly filteredGroups = computed<FilteredGroupView[]>(() =>
        filterGroupsByLabel(
            this.workspaceFilteredGroups(),
            this.localGroupSearchTerm()
        )
    );

    readonly groupNavigationSections = computed(() =>
        createGroupNavigationSections(this.filteredGroups())
    );

    readonly hasAnyGroups = computed(() => this.allGroups().length > 0);

    readonly selectedGroup = computed(() => {
        const selectedGroupKey = this.selectedGroupKey();
        return (
            this.filteredGroups().find(
                (group) => group.key === selectedGroupKey
            ) ?? null
        );
    });

    /**
     * Channels for the currently selected group, sorted but NOT cloned.
     * Recomputes only when the selected group or sort mode changes — no longer
     * tied to progressTick, so we don't re-sort/re-allocate every 30 s.
     */
    readonly selectedGroupChannels = computed<readonly Channel[]>(() => {
        const group = this.selectedGroup();
        const sortMode = this.groupChannelSortMode();

        if (!group) {
            return [];
        }

        return sortChannelItems(
            group.channels,
            sortMode,
            (channel) => channel?.name
        );
    });

    /**
     * Side-car EPG metadata keyed by channel EPG lookup key. Rebuilt every
     * progressTick (~30 s) but only contains entries for channels with EPG
     * data — typically a small fraction of the playlist. Replaces the previous
     * spread-clone-every-channel pattern.
     */
    readonly epgMetadataMap = computed(() => {
        // Read progressTick to create a dependency for the ~30s progress refresh.
        this.progressTick();
        return buildChannelEpgMetadataMap(this.channelEpgMap());
    });

    /** Resolves the EPG lookup key the side-car map is keyed by. */
    getChannelEpgKey(channel: Channel): string {
        return channelEpgLookupKey(channel);
    }

    /** Resolves the channel logo. Called per visible row from the template. */
    getLogoForChannel(channel: Channel): string {
        return resolveChannelLogo(channel, this.channelIconMap());
    }

    private readonly groupKeyByChannelUrl = computed(() =>
        buildGroupKeyByChannelUrl(this.groupedChannels())
    );

    readonly activeChannelGroupKey = computed(() => {
        const activeChannelUrl = this.activeChannelUrl();
        if (!activeChannelUrl) {
            return null;
        }

        return this.groupKeyByChannelUrl().get(activeChannelUrl) ?? null;
    });

    selectGroup(groupKey: string): void {
        this.selectedGroupKey.set(groupKey);
    }

    closeGroupSearch(): void {
        this.localGroupSearchTerm.set('');
        this.isGroupSearchOpen.set(false);
    }

    toggleGroupSearch(): void {
        if (this.isGroupSearchOpen()) {
            this.closeGroupSearch();
            return;
        }

        this.isGroupSearchOpen.set(true);
    }

    updateGroupSearchTerm(value: string): void {
        this.localGroupSearchTerm.set(value);
    }

    openGroupManagement(): void {
        const groups = this.allGroups().map<GroupManagementDialogGroup>(
            ({ key, count, label }) => ({
                key,
                count,
                label,
            })
        );
        const dialogRef = this.dialog.open(GroupManagementDialogComponent, {
            data: {
                groups,
                hiddenGroupTitles: this.hiddenGroupTitles(),
            },
            width: '500px',
            maxHeight: '90vh',
        });

        dialogRef.afterClosed().subscribe((hiddenGroupTitles) => {
            if (hiddenGroupTitles === undefined) {
                return;
            }

            this.hiddenGroupTitlesChanged.emit(hiddenGroupTitles);
        });
    }

    setGroupChannelSortMode(mode: ChannelSortMode): void {
        this.groupChannelSortMode.set(mode);
        persistChannelSortMode(GROUP_CHANNEL_SORT_STORAGE_KEY, mode);
    }

    onGroupsNavResizeStart(): void {
        this.navResize.start();
    }

    onGroupsNavWidthChange(width: number): void {
        this.emitSidebarWidthRequest(width, this.sidebarWidthRequested);
    }

    onGroupsNavResizeEnd(width: number): void {
        this.emitSidebarWidthRequest(width, this.sidebarWidthRequestEnded);
        this.navResize.end();
    }

    trackByChannel(index: number, channel: Channel): string {
        return channelTrackKey(channel, index);
    }

    trackByGroupKey(_: number, group: FilteredGroupView): string {
        return group.key;
    }

    categoryIcon(key: string): string {
        return categoryIconFor(key);
    }

    onChannelClick(channel: Channel, index?: number): void {
        if (index !== undefined) {
            this.cursor.focus(index);
        }

        this.channelSelected.emit(channel);
    }

    onListKeydown(event: KeyboardEvent): void {
        this.cursor.handleKeydown(event);
    }

    onChannelActivate(channel: Channel): void {
        if (this.openOnDoubleClick()) {
            this.channelPlaybackRequested.emit(channel);
        }
    }

    onFavoriteToggle(channel: Channel, event: MouseEvent): void {
        this.favoriteToggled.emit({ channel, event });
    }

    private emitSidebarWidthRequest(
        navWidth: number,
        emitter: OutputEmitterRef<number>
    ): void {
        const requestedWidth = this.navResize.requestedWidthFor(navWidth);

        if (requestedWidth > 0) {
            emitter.emit(requestedWidth);
        }
    }
}
