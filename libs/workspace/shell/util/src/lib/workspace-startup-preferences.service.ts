import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    PlaylistsService,
    RuntimeCapabilitiesService,
    SettingsStore,
} from '@iptvnator/services';
import {
    DefaultWorkspacePage,
    Playlist,
    StartupBehavior,
} from '@iptvnator/shared/interfaces';
import { parseWorkspaceShellRoute } from './navigation/workspace-shell-route.utils';

const LAST_RESTORABLE_ROUTE_STORAGE_KEY = 'workspace-last-restorable-route-v1';

@Injectable({ providedIn: 'root' })
export class WorkspaceStartupPreferencesService {
    private readonly settingsStore = inject(SettingsStore);
    private readonly playlistsService = inject(PlaylistsService);
    private readonly runtime = inject(RuntimeCapabilitiesService);

    async resolveInitialWorkspacePath(): Promise<string> {
        await this.settingsStore.loadSettings();

        const showDashboard = this.showDashboard();
        const firstViewPath =
            await this.resolveDefaultWorkspacePath(showDashboard);

        if (this.startupBehavior() !== StartupBehavior.RestoreLastView) {
            return firstViewPath;
        }

        return (
            (await this.getValidatedLastRestorablePath(
                showDashboard,
                firstViewPath
            )) ?? firstViewPath
        );
    }

    async resolveDashboardPath(): Promise<string> {
        await this.settingsStore.loadSettings();

        return this.showDashboard()
            ? '/workspace/dashboard'
            : '/workspace/sources';
    }

    getFirstAvailableWorkspacePath(
        showDashboard = this.showDashboard()
    ): string {
        return showDashboard ? '/workspace/dashboard' : '/workspace/sources';
    }

    showDashboard(): boolean {
        return this.settingsStore.showDashboard?.() ?? true;
    }

    startupBehavior(): StartupBehavior {
        return (
            this.settingsStore.startupBehavior?.() ?? StartupBehavior.FirstView
        );
    }

    defaultWorkspacePage(): DefaultWorkspacePage {
        return this.settingsStore.defaultWorkspacePage?.() ?? 'tv-guide';
    }

    async resolveDefaultWorkspacePath(
        showDashboard = this.showDashboard()
    ): Promise<string> {
        const fallback = this.getFirstAvailableWorkspacePath(showDashboard);

        switch (this.defaultWorkspacePage()) {
            case 'tv-guide':
                return (await this.resolveTvGuidePath()) ?? fallback;
            case 'dashboard':
                return showDashboard ? '/workspace/dashboard' : fallback;
            case 'sources':
                return '/workspace/sources';
            case 'followed-series':
                return '/workspace/followed-series';
            case 'radio':
                return '/workspace/radio';
            case 'global-favorites':
                return '/workspace/global-favorites';
            case 'global-recent':
                return '/workspace/global-recent';
            case 'downloads':
                return this.runtime.supportsDownloads
                    ? '/workspace/downloads'
                    : fallback;
            default:
                return fallback;
        }
    }

    persistLastRestorablePath(url: string): void {
        const canonicalPath = this.getRestorablePath(url);
        if (!canonicalPath) {
            return;
        }

        try {
            localStorage.setItem(
                LAST_RESTORABLE_ROUTE_STORAGE_KEY,
                canonicalPath
            );
        } catch {
            // Ignore storage write failures.
        }
    }

    getRestorablePath(url: string): string | null {
        const [path] = url.split('?');
        if (path === '/workspace' || path === '/workspace/') {
            return null;
        }

        const route = parseWorkspaceShellRoute(url);

        switch (route.kind) {
            case 'dashboard':
                return '/workspace/dashboard';
            case 'downloads':
                return '/workspace/downloads';
            case 'followed-series':
                return '/workspace/followed-series';
            case 'global-favorites':
                return '/workspace/global-favorites';
            case 'global-recent':
                return '/workspace/global-recent';
            case 'sources':
                return '/workspace/sources';
            case 'portal':
                if (!route.context || !route.section) {
                    return null;
                }

                return [
                    '/workspace',
                    route.context.provider,
                    route.context.playlistId,
                    route.section,
                ].join('/');
            default:
                return null;
        }
    }

    async getValidatedLastRestorablePath(
        showDashboard = this.showDashboard(),
        fallbackPath = this.getFirstAvailableWorkspacePath(showDashboard)
    ): Promise<string | null> {
        const storedPath = this.readLastRestorablePath();
        if (!storedPath) {
            return null;
        }

        const canonicalPath = this.getRestorablePath(storedPath);
        if (!canonicalPath) {
            return null;
        }

        if (!showDashboard && canonicalPath === '/workspace/dashboard') {
            return this.getFirstAvailableWorkspacePath(false);
        }

        const route = parseWorkspaceShellRoute(canonicalPath);
        if (route.kind !== 'portal' || !route.context) {
            return canonicalPath;
        }

        try {
            const playlists = await firstValueFrom(
                this.playlistsService.getAllPlaylists()
            );

            return playlists.some(
                (playlist) => playlist._id === route.context?.playlistId
            )
                ? canonicalPath
                : fallbackPath;
        } catch {
            return fallbackPath;
        }
    }

    private async resolveTvGuidePath(): Promise<string | null> {
        try {
            const playlists = await firstValueFrom(
                this.playlistsService.getAllPlaylists()
            );
            const m3uPlaylists = playlists
                .filter(isM3uPlaylist)
                .sort(comparePlaylistUsage);
            const playlist = m3uPlaylists[0];
            return playlist?._id
                ? `/workspace/playlists/${playlist._id}/guide`
                : null;
        } catch {
            return null;
        }
    }

    private readLastRestorablePath(): string | null {
        try {
            const value = localStorage.getItem(
                LAST_RESTORABLE_ROUTE_STORAGE_KEY
            );
            return value && value.trim().length > 0 ? value : null;
        } catch {
            return null;
        }
    }
}

function isM3uPlaylist(playlist: Playlist): boolean {
    return !playlist.serverUrl && !playlist.macAddress && !playlist.portalUrl;
}

function comparePlaylistUsage(left: Playlist, right: Playlist): number {
    const leftUsage = Date.parse(left.lastUsage ?? left.importDate ?? '') || 0;
    const rightUsage =
        Date.parse(right.lastUsage ?? right.importDate ?? '') || 0;
    return rightUsage - leftUsage;
}
