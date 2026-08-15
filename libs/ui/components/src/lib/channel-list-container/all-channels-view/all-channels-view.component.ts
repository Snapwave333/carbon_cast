import {
    CdkVirtualScrollViewport,
    ScrollingModule,
} from '@angular/cdk/scrolling';

import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
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
import { resolveChannelLogo } from '../channel-logo-fallback.util';
import { buildChannelEpgMetadataMap } from '../epg-enrichment.util';
import { channelEpgLookupKey } from '../channel-epg-key.util';
import { channelTrackKey } from '../channel-track-key.util';
import { ListboxCursor } from '../listbox-cursor';
import { ChannelContextMenuComponent } from '../channel-context-menu/channel-context-menu.component';
import { ChannelListItemComponent } from '../channel-list-item/channel-list-item.component';

const ALL_CHANNELS_SORT_STORAGE_KEY = 'm3u-all-channels-sort-mode';

export function channelOptionId(index: number): string {
    return `channel-option-${index}`;
}

export type { ChannelEpgMetadata } from '../epg-enrichment.util';

@Component({
    selector: 'app-all-channels-view',
    templateUrl: './all-channels-view.component.html',
    styleUrls: ['./all-channels-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ChannelContextMenuComponent,
        ChannelListItemComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        ScrollingModule,
        TranslatePipe,
    ],
})
export class AllChannelsViewComponent {
    private readonly viewport = viewChild(CdkVirtualScrollViewport);

    constructor() {
        // Reveal the active channel when it is set from outside the list —
        // resume-last-channel, a global-search result or the number-pad
        // shortcut all activate a row that can be tens of thousands of rows
        // away, and the highlight alone is invisible until the user finds it.
        let lastRevealedUrl: string | undefined;
        effect(() => {
            const activeUrl = this.activeChannelUrl();
            const channels = this.filteredChannels();

            if (!activeUrl || activeUrl === lastRevealedUrl) {
                return;
            }

            const index = channels.findIndex(
                (channel) => channel?.url === activeUrl
            );
            if (index < 0) {
                return;
            }

            lastRevealedUrl = activeUrl;
            const viewport = this.viewport();
            if (!viewport) {
                return;
            }

            // Leave the position alone when the row is already on screen, so
            // clicking a visible channel never yanks the list.
            const range = viewport.getRenderedRange();
            if (index >= range.start && index < range.end) {
                return;
            }

            viewport.scrollToIndex(index, 'smooth');
        });
    }

    /** All channels (will be filtered by search) */
    readonly channels = input.required<Channel[]>();
    readonly searchTerm = input('');

    /** EPG map for channel enrichment */
    readonly channelEpgMap = input.required<Map<string, EpgProgram | null>>();
    readonly channelIconMap = input.required<Map<string, string>>();

    /** Progress tick to trigger progress recalculation */
    readonly progressTick = input.required<number>();

    /** Whether to show EPG data */
    readonly shouldShowEpg = input.required<boolean>();
    readonly openOnDoubleClick = input(false);

    /** Item size for virtual scroll */
    readonly itemSize = input.required<number>();

    /** Currently active channel URL */
    readonly activeChannelUrl = input<string | undefined>();

    /** Set of favorite channel URLs */
    readonly favoriteIds = input<Set<string>>(new Set());

    /** Emits when a channel is selected */
    readonly channelSelected = output<Channel>();
    readonly channelPlaybackRequested = output<Channel>();

    /** Emits when favorite is toggled */
    readonly favoriteToggled = output<{
        channel: Channel;
        event: MouseEvent;
    }>();

    /** Emits when the user clicks the inline collapse toggle in the list header */
    readonly sidebarToggleRequested = output<void>();

    private readonly cursor = new ListboxCursor({
        count: () => this.filteredChannels().length,
        optionId: channelOptionId,
        activate: (index) => {
            const channel = this.filteredChannels()[index];
            if (channel) {
                this.channelSelected.emit(channel);
            }
        },
        scrollToIndex: (index) => this.viewport()?.scrollToIndex(index, 'smooth'),
    });

    readonly focusedIndex = this.cursor.focusedIndex;
    readonly activeDescendantId = this.cursor.activeDescendantId;

    readonly allChannelsSortMode = signal<ChannelSortMode>(
        restoreChannelSortMode(ALL_CHANNELS_SORT_STORAGE_KEY)
    );
    readonly allChannelsSortLabel = computed(() =>
        getChannelSortModeLabelKey(this.allChannelsSortMode())
    );

    /**
     * Filtered and sorted channels. Playlist order keeps the original input
     * reference when there is no search term, so large lists avoid cloning.
     */
    readonly filteredChannels = computed(() => {
        const term = this.searchTerm().trim().toLowerCase();
        const channels = this.channels();
        const filteredChannels = term
            ? channels.filter((ch) => ch.name?.toLowerCase().includes(term))
            : channels;

        return sortChannelItems(
            filteredChannels,
            this.allChannelsSortMode(),
            (channel) => channel?.name
        );
    });

    /**
     * Side-car EPG metadata keyed by channel EPG lookup key.
     * Rebuilt every progressTick (~30 s) but only contains entries for channels
     * that actually have EPG data — typically a small fraction of the playlist.
     * Replaces the previous spread-clone-every-channel pattern that allocated
     * ~90K objects per tick on large M3U playlists.
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

    /**
     * Resolves the channel logo. Called per visible row from the template; under
     * OnPush + virtual scroll only ~50 rows check at a time so direct calls are
     * cheaper than rebuilding a separate logo map per channels/iconMap change.
     */
    getLogoForChannel(channel: Channel): string {
        return resolveChannelLogo(channel, this.channelIconMap());
    }

    trackByFn(index: number, channel: Channel): string {
        return channelTrackKey(channel, index);
    }

    onChannelClick(channel: Channel, index?: number): void {
        // Keep the keyboard cursor where the pointer last acted, so arrowing
        // after a click continues from that row instead of the top.
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

    setAllChannelsSortMode(mode: ChannelSortMode): void {
        this.allChannelsSortMode.set(mode);
        persistChannelSortMode(ALL_CHANNELS_SORT_STORAGE_KEY, mode);
    }
}
