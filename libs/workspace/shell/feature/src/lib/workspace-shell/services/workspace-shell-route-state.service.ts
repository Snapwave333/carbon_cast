import {
    computed,
    DestroyRef,
    inject,
    Injectable,
    signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { filter, startWith } from 'rxjs';
import { PlaylistContextFacade } from '@iptvnator/playlist/shared/util';
import {
    buildPortalRailLinks,
    PortalRailLink,
} from '@iptvnator/portal/shared/util';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import {
    parseWorkspaceShellRoute,
    WorkspacePortalContext,
    WorkspaceStartupPreferencesService,
} from '@iptvnator/workspace/shell/util';
import { getProviderFromPlaylist } from './helpers/workspace-shell-route-utils';
import { translateRailLinks } from './helpers/workspace-shell-search-labels';

@Injectable()
export class WorkspaceShellRouteStateService {
    private readonly router = inject(Router);
    private readonly store = inject(Store);
    private readonly playlistContext = inject(PlaylistContextFacade);
    private readonly startupPreferences = inject(
        WorkspaceStartupPreferencesService
    );
    private readonly translate = inject(TranslateService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly runtime = inject(RuntimeCapabilitiesService);

    private readonly languageTick = toSignal(
        this.translate.onLangChange.pipe(startWith(null)),
        { initialValue: null }
    );

    readonly activePlaylist = this.playlistContext.activePlaylist;
    readonly playlists = this.store.selectSignal(selectAllPlaylistsMeta);
    readonly hasNoPlaylists = computed(() => this.playlists().length === 0);

    readonly currentUrl = signal(this.router.url);
    readonly currentRoute = computed(() =>
        parseWorkspaceShellRoute(this.currentUrl())
    );
    readonly currentContext = computed(() => this.currentRoute().context);
    readonly currentSection = computed(() => this.currentRoute().section);
    readonly showDashboard = computed(() =>
        this.startupPreferences.showDashboard()
    );
    readonly brandLink = computed(() =>
        this.startupPreferences.getFirstAvailableWorkspacePath(
            this.showDashboard()
        )
    );
    readonly brandTooltipKey = computed(() =>
        this.showDashboard()
            ? 'WORKSPACE.SHELL.RAIL_DASHBOARD'
            : 'WORKSPACE.SHELL.RAIL_SOURCES'
    );
    readonly brandAriaLabelKey = computed(() =>
        this.showDashboard()
            ? 'WORKSPACE.SHELL.OPEN_DASHBOARD'
            : 'WORKSPACE.SHELL.OPEN_SOURCES'
    );
    readonly workspaceLinks = computed<PortalRailLink[]>(() => {
        this.languageTick();

        const links: PortalRailLink[] = [];

        if (this.showDashboard()) {
            links.push({
                icon: 'dashboard',
                tooltip: this.translateText('WORKSPACE.SHELL.RAIL_DASHBOARD'),
                path: ['/workspace/dashboard'],
                exact: true,
            });
        }

        // Keep the dock to direct viewing destinations. Sources and global
        // search remain reachable from the command palette, rather than
        // consuming permanent bottom-dock space.
        links.push({
            icon: 'radio',
            tooltip: this.translateText('WORKSPACE.SHELL.RAIL_RADIO_PODCASTS'),
            path: ['/workspace/radio'],
            exact: true,
        });

        links.push({
            icon: 'calendar_month',
            tooltip: this.translateText('WORKSPACE.SHELL.RAIL_FOLLOWED_SERIES'),
            path: ['/workspace/followed-series'],
            exact: true,
        });

        // The brand logo already navigates home, so drop the nav tile that
        // would send the user to the same place.
        const brandTarget = this.brandLink();
        return links.filter((link) => link.path.join('/') !== brandTarget);
    });
    readonly isDashboardRoute = computed(
        () => this.currentRoute().kind === 'dashboard'
    );
    readonly isSourcesRoute = computed(
        () => this.currentRoute().kind === 'sources'
    );
    readonly isSettingsRoute = computed(
        () => this.currentRoute().kind === 'settings'
    );
    readonly isM3uPlaylistRoute = computed(
        () => this.currentContext()?.provider === 'playlists'
    );
    readonly isGlobalDownloadsRoute = computed(
        () => this.currentRoute().kind === 'downloads'
    );
    readonly railContext = computed<WorkspacePortalContext | null>(() => {
        const routeContext = this.currentContext();
        if (routeContext) {
            return routeContext;
        }

        const currentRoute = this.currentRoute();
        if (
            currentRoute.kind !== 'dashboard' &&
            currentRoute.kind !== 'sources' &&
            currentRoute.kind !== 'settings' &&
            currentRoute.kind !== 'global-favorites' &&
            currentRoute.kind !== 'global-recent' &&
            currentRoute.kind !== 'global-search' &&
            currentRoute.kind !== 'downloads'
        ) {
            return null;
        }

        const activePlaylist = this.activePlaylist();
        if (!activePlaylist?._id) {
            return null;
        }

        return {
            provider: getProviderFromPlaylist(activePlaylist),
            playlistId: activePlaylist._id,
        };
    });
    readonly dashboardXtreamContext = computed<WorkspacePortalContext | null>(
        () => {
            if (!this.isDashboardRoute()) {
                return null;
            }

            const context = this.railContext();
            if (!context || context.provider !== 'xtreams') {
                return null;
            }

            return context;
        }
    );
    readonly contextPanel = computed(() => this.currentRoute().contextPanel);
    readonly showContextPanel = computed(
        () => this.currentRoute().contextPanel !== 'none'
    );
    readonly railProviderClass = computed(() => {
        const context = this.railContext();
        if (!context) {
            return 'rail-context-region';
        }

        return `rail-context-region rail-context-region--${context.provider}`;
    });
    readonly primaryContextLinks = computed<PortalRailLink[]>(() => {
        this.languageTick();

        const context = this.railContext();
        if (!context) {
            return [];
        }

        return translateRailLinks(
            buildPortalRailLinks({
                provider: context.provider,
                playlistId: context.playlistId,
                supportsEpg: this.runtime.supportsEpg,
                workspace: true,
            }).primary,
            context.provider,
            (key, params) => this.translateText(key, params)
        );
    });
    readonly secondaryContextLinks = computed<PortalRailLink[]>(() => {
        this.languageTick();

        const context = this.railContext();
        if (!context) {
            return [];
        }

        return translateRailLinks(
            buildPortalRailLinks({
                provider: context.provider,
                playlistId: context.playlistId,
                supportsEpg: this.runtime.supportsEpg,
                workspace: true,
            }).secondary,
            context.provider,
            (key, params) => this.translateText(key, params)
        );
    });
    constructor() {
        this.router.events
            .pipe(
                filter(
                    (event): event is NavigationEnd =>
                        event instanceof NavigationEnd
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((event) => {
                this.currentUrl.set(event.urlAfterRedirects);
                this.startupPreferences.persistLastRestorablePath(
                    event.urlAfterRedirects
                );
            });
    }

    private translateText(
        key: string,
        params?: Record<string, string | number>
    ): string {
        return this.translate.instant(key, params);
    }
}
