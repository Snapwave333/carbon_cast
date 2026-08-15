import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    Input,
    input,
    OnDestroy,
    OnInit,
    output,
    signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { PlaylistContextFacade } from '@iptvnator/playlist/shared/util';
import {
    isWorkspaceLayoutRoute,
    queryParamSignal,
} from '@iptvnator/portal/shared/util';
import {
    ChannelActions,
    FavoritesActions,
    PlaylistActions,
    selectActive,
    selectFavorites,
} from '@iptvnator/m3u-state';
import { filter, firstValueFrom, map } from 'rxjs';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import {
    Channel,
    isM3uRecentlyViewedItem,
    normalizeStalkerDate,
    PlaylistMeta,
    PlaylistRecentlyViewedItem,
} from '@iptvnator/shared/interfaces';
import {
    expandChannelCategories,
    isSpanishLanguageChannel,
} from '@iptvnator/shared/m3u-utils';
import { ChannelGroup } from './channel-group.model';
import { ChannelListEpgController } from './channel-list-epg.controller';
import {
    CHANNEL_ROW_COMPACT_HEIGHT_PX,
    CHANNEL_ROW_HEIGHT_PX,
} from './channel-row-metrics';
import { AllChannelsViewComponent } from './all-channels-view/all-channels-view.component';
import { GroupsViewComponent } from './groups-view/groups-view.component';
import { ChannelListLoadingStateComponent } from '../channel-list-loading-state/channel-list-loading-state.component';

function groupChannelsByCategory(channels: Channel[]): ChannelGroup[] {
    const buckets = new Map<string, { label: string; channels: Channel[] }>();

    for (const channel of channels) {
        for (const { key, label } of expandChannelCategories(
            channel.group?.title
        )) {
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { label, channels: [] };
                buckets.set(key, bucket);
            }
            bucket.channels.push(channel);
        }
    }

    return Array.from(buckets, ([key, { label, channels: grouped }]) => ({
        key,
        label,
        channels: grouped,
    }));
}

const PROGRESS_TICK_INTERVAL_MS = 30_000;

@Component({
    selector: 'app-channel-list-container',
    templateUrl: './channel-list-container.component.html',
    styleUrls: ['./channel-list-container.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AllChannelsViewComponent,
        ChannelListLoadingStateComponent,
        GroupsViewComponent,
        MatButtonModule,
        MatIconModule,
        TranslatePipe,
    ],
})
export class ChannelListContainerComponent implements OnInit, OnDestroy {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly playlistContext = inject(PlaylistContextFacade);
    private readonly settingsStore = inject(SettingsStore);
    /** Route-aware playlist ID for recent-item mutations */
    private readonly resolvedPlaylistId =
        this.playlistContext.resolvedPlaylistId;
    private readonly activePlaylist = this.playlistContext.activePlaylist;

    /** Channels array */
    _channelList: Channel[] = [];
    private readonly channelListSignal = signal<Channel[]>([]);

    /**
     * EPG side-car state. Declared after `channelListSignal` so the controller
     * receives an initialized signal.
     */
    private readonly epg = new ChannelListEpgController(
        this.channelListSignal
    );
    readonly channelEpgMap = this.epg.channelEpgMap;
    readonly channelIconMap = this.epg.channelIconMap;
    readonly playlistEpgUrls = this.epg.playlistEpgUrls;
    readonly shouldShowEpg = this.epg.shouldShowEpg;

    /** Global progress tick signal - triggers re-computation of progress percentages */
    readonly progressTick = signal(0);

    /** Interval for global progress updates */
    private progressInterval?: number;

    readonly openStreamOnDoubleClick = computed(() =>
        this.settingsStore.openStreamOnDoubleClick()
    );

    /**
     * Item size for virtual scroll - compact when no EPG. Must match the row
     * heights in channel-list-item.component.scss (.channel-list-item and its
     * .compact variant): an undersized value makes the CDK misreport the
     * scrollable height, which across 90k rows leaves the end of the list
     * unreachable.
     */
    readonly itemSize = computed(() =>
        this.shouldShowEpg()
            ? CHANNEL_ROW_HEIGHT_PX
            : CHANNEL_ROW_COMPACT_HEIGHT_PX
    );

    /** Active view (all, groups, favorites, recent) */
    readonly activeView = input<string>('all');
    readonly channelsLoading = input(false);
    readonly recentItems = input<PlaylistRecentlyViewedItem[]>([]);
    readonly sidebarWidth = input<number | null>(null);
    readonly sidebarWidthRequested = output<number>();
    readonly sidebarWidthRequestEnded = output<number>();
    readonly sidebarToggleRequested = output<void>();
    readonly isWorkspaceLayout = isWorkspaceLayoutRoute(this.route);
    private readonly routeSearchTerm = queryParamSignal(
        this.route,
        'q',
        (value) => (value ?? '').trim().toLowerCase()
    );
    readonly workspaceSearchTerm = computed(() =>
        this.isWorkspaceLayout ? this.routeSearchTerm() : ''
    );

    get channelList(): Channel[] {
        return this._channelList;
    }

    @Input()
    set channelList(value: Channel[]) {
        const safeValue = value ?? [];
        this._channelList = safeValue;
        this.channelListSignal.set(safeValue);
        this.epg.refresh();
    }

    readonly hiddenGroupTitles = computed(() => {
        const playlist = this.activePlaylist();

        if (!playlist || playlist.serverUrl || playlist.macAddress) {
            return [];
        }

        return playlist.hiddenGroupTitles ?? [];
    });

    /** Channels the views render, minus the ones the language filter hides. */
    readonly displayedChannels = computed(() => {
        const channels = this.channelListSignal();
        if (!this.settingsStore.hideSpanishChannels?.()) {
            return channels;
        }

        return channels.filter(
            (channel) =>
                !isSpanishLanguageChannel(channel.name, channel.group?.title)
        );
    });

    /** Channels merged into canonical, de-duplicated category buckets */
    readonly groupedChannels = computed<ChannelGroup[]>(() =>
        groupChannelsByCategory(this.displayedChannels())
    );

    /** Selected channel */
    readonly activeChannel = this.store.selectSignal(selectActive);

    /** Active channel URL for highlighting */
    readonly activeChannelUrl = computed(() => this.activeChannel()?.url);

    /** Set of favorite channel URLs for quick lookup */
    private readonly _favorites = this.store.selectSignal(selectFavorites);
    readonly favoriteIds = computed(() => new Set(this._favorites()));

    ngOnInit(): void {
        this.epg.start();

        this.progressInterval = window.setInterval(() => {
            this.progressTick.update((v) => v + 1);
        }, PROGRESS_TICK_INTERVAL_MS);
    }

    ngOnDestroy(): void {
        this.store.dispatch(ChannelActions.resetActiveChannel());

        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.epg.stop();
    }

    /**
     * Handles channel selection from any tab
     */
    onChannelSelected(channel: Channel): void {
        this.store.dispatch(ChannelActions.setActiveChannel({ channel }));
    }

    onChannelPlaybackRequested(channel: Channel): void {
        this.store.dispatch(
            ChannelActions.setActiveChannel({
                channel,
                startPlayback: true,
            })
        );
    }

    /**
     * Handles favorite toggle from favorites tab
     */
    onFavoriteToggled(event: { channel: Channel; event: MouseEvent }): void {
        event.event.stopPropagation();
        this.store.dispatch(
            FavoritesActions.updateFavorites({ channel: event.channel })
        );
    }

    onHiddenGroupTitlesChanged(hiddenGroupTitles: string[]): void {
        const playlist = this.activePlaylist();

        if (!playlist || playlist.serverUrl || playlist.macAddress) {
            return;
        }

        this.store.dispatch(
            PlaylistActions.updatePlaylistMeta({
                playlist: {
                    _id: playlist._id,
                    hiddenGroupTitles,
                } as PlaylistMeta,
            })
        );
    }

    /**
     * Handles favorites reorder from drag-drop
     */
    onSidebarWidthRequested(width: number): void {
        this.sidebarWidthRequested.emit(width);
    }

    onSidebarWidthRequestEnded(width: number): void {
        this.sidebarWidthRequestEnded.emit(width);
    }
}
