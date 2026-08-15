import { computed, effect, inject, Signal, signal, untracked } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import {
    catchError,
    debounceTime,
    filter,
    forkJoin,
    of,
    Subject,
    Subscription,
    switchMap,
} from 'rxjs';
import { EpgService } from '@iptvnator/epg/data-access';
import { PlaylistContextFacade } from '@iptvnator/playlist/shared/util';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import {
    Channel,
    EpgProgram,
    Settings,
    STORE_KEY,
} from '@iptvnator/shared/interfaces';
import { normalizeEpgUrls } from '@iptvnator/shared/m3u-utils';
import { channelEpgLookupKey } from './channel-epg-key.util';

const EPG_AVAILABILITY_REFRESH_DEBOUNCE_MS = 2000;
const EPG_REFRESH_INTERVAL_MS = 60_000;

/**
 * Owns the channel list's EPG side-car state: which sources are configured,
 * when a lookup is due, and the two maps the rows read from.
 *
 * Construct it from a component field initializer — it uses `inject()` and
 * `effect()`, so it needs the owner's injection context.
 */
export class ChannelListEpgController {
    private readonly epgService = inject(EpgService);
    private readonly playlistContext = inject(PlaylistContextFacade);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly storage = inject(StorageMap);

    /** Current programme per EPG lookup key. */
    readonly channelEpgMap = signal(new Map<string, EpgProgram | null>());
    /** Guide-provided icon per EPG lookup key. */
    readonly channelIconMap = signal(new Map<string, string>());

    private readonly globalEpgUrls = signal<string[]>([]);

    readonly playlistEpgUrls = computed(() => {
        const playlist = this.playlistContext.activePlaylist();
        if (!playlist || playlist.serverUrl || playlist.macAddress) {
            return [];
        }

        return normalizeEpgUrls(playlist.epgUrls ?? []);
    });

    readonly shouldShowEpg = computed(
        () =>
            this.runtime.supportsEpg &&
            (this.globalEpgUrls().length > 0 ||
                this.playlistEpgUrls().length > 0)
    );

    private readonly epgSourceRefreshKey = computed(() => {
        if (!this.runtime.supportsEpg) {
            return '';
        }

        const globalUrls = this.globalEpgUrls();
        const playlistUrls = this.playlistEpgUrls();
        if (globalUrls.length === 0 && playlistUrls.length === 0) {
            return '';
        }

        return JSON.stringify({
            globalUrls: Array.from(new Set(globalUrls)).sort(),
            playlistUrls: Array.from(new Set(playlistUrls)).sort(),
        });
    });

    /**
     * The distinct EPG lookup keys of the current playlist.
     *
     * Resolving a key normalizes strings, so doing it for all 90,000 channels
     * on every refresh tick was pure repeat work: the answer only changes when
     * the playlist does.
     */
    private readonly epgLookupIds = computed(() =>
        Array.from(
            new Set(
                this.channels()
                    .map((channel) => channelEpgLookupKey(channel))
                    .filter((id) => !!id)
            )
        )
    );

    /**
     * Requests are switched rather than merged: the playlist input, the
     * refresh interval, the availability push and the EPG-source effect can all
     * fire within the same tick, and a slower earlier lookup landing last would
     * publish stale programmes.
     */
    private readonly fetchRequests = new Subject<{
        channelIds: string[];
        lookupOptions: { sourceUrls: string[] } | undefined;
    }>();

    private readonly fetchSubscription = this.fetchRequests
        .pipe(
            switchMap(({ channelIds, lookupOptions }) =>
                forkJoin({
                    epgMap: this.epgService.getCurrentProgramsForChannels(
                        channelIds,
                        lookupOptions
                    ),
                    metadataMap: this.epgService.getChannelMetadataForChannels(
                        channelIds,
                        lookupOptions
                    ),
                }).pipe(
                    // Keep the stream alive: a failed lookup must not stop the
                    // periodic refresh from recovering later.
                    catchError(() => of(null))
                )
            )
        )
        .subscribe((result) => {
            if (!result) {
                return;
            }

            this.channelEpgMap.set(result.epgMap);
            this.channelIconMap.set(
                new Map(
                    Array.from(
                        result.metadataMap.entries(),
                        ([channelId, metadata]) => [
                            channelId,
                            metadata?.iconUrl?.trim() || '',
                        ]
                    )
                )
            );
        });

    private lastEpgSourceRefreshKey = '';
    private availabilitySubscription?: Subscription;
    private refreshInterval?: number;

    constructor(private readonly channels: Signal<Channel[]>) {
        effect(() => {
            const refreshKey = this.epgSourceRefreshKey();
            if (refreshKey === this.lastEpgSourceRefreshKey) {
                return;
            }

            this.lastEpgSourceRefreshKey = refreshKey;
            if (!refreshKey || untracked(this.channels).length === 0) {
                return;
            }

            untracked(() => {
                this.refresh();
            });
        });
    }

    /** Starts source discovery and the periodic refresh. */
    start(): void {
        if (this.runtime.supportsEpg) {
            this.storage
                .get(STORE_KEY.Settings)
                .subscribe((settings: unknown) => {
                    if (
                        settings &&
                        Object.keys(settings as Settings).length > 0
                    ) {
                        this.globalEpgUrls.set(
                            normalizeEpgUrls((settings as Settings).epgUrl)
                        );
                    }
                });
        } else {
            this.globalEpgUrls.set([]);
        }

        this.availabilitySubscription = this.epgService.epgAvailable$
            .pipe(
                filter((available) => available),
                debounceTime(EPG_AVAILABILITY_REFRESH_DEBOUNCE_MS)
            )
            .subscribe(() => {
                this.refresh();
            });

        this.refreshInterval = window.setInterval(() => {
            this.refresh();
        }, EPG_REFRESH_INTERVAL_MS);
    }

    stop(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.availabilitySubscription?.unsubscribe();
        this.fetchSubscription.unsubscribe();
        this.fetchRequests.complete();
    }

    /** Requests EPG data for the current playlist's channels. */
    refresh(): void {
        // Gate on the capability, not on shouldShowEpg(): with no EPG URL
        // configured the database can still hold programmes from a source
        // loaded earlier. Where there is no EPG bridge at all (the PWA), the
        // batched lookup and the two maps it builds are pure waste.
        if (!this.runtime.supportsEpg) {
            this.clearMaps();
            return;
        }

        const channelIds = this.epgLookupIds();
        if (channelIds.length === 0) {
            this.clearMaps();
            return;
        }

        const sourceUrls = this.playlistEpgUrls();
        this.fetchRequests.next({
            channelIds,
            lookupOptions: sourceUrls.length > 0 ? { sourceUrls } : undefined,
        });
    }

    private clearMaps(): void {
        this.channelEpgMap.set(new Map());
        this.channelIconMap.set(new Map());
    }
}
