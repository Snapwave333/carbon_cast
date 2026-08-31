import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PlaylistsService, SettingsStore } from '@iptvnator/services';
import {
    DefaultWorkspacePage,
    StartupBehavior,
} from '@iptvnator/shared/interfaces';
import { WorkspaceStartupPreferencesService } from './workspace-startup-preferences.service';

describe('WorkspaceStartupPreferencesService', () => {
    let service: WorkspaceStartupPreferencesService;
    let playlistsService: { getAllPlaylists: jest.Mock };
    let settingsStore: {
        loadSettings: jest.Mock;
        showDashboard: ReturnType<typeof signal<boolean>>;
        startupBehavior: ReturnType<typeof signal<StartupBehavior>>;
        defaultWorkspacePage: ReturnType<typeof signal<DefaultWorkspacePage>>;
    };

    beforeEach(() => {
        localStorage.clear();

        playlistsService = {
            getAllPlaylists: jest
                .fn()
                .mockReturnValue(of([{ _id: 'playlist-1' }])),
        };
        settingsStore = {
            loadSettings: jest.fn().mockResolvedValue(undefined),
            showDashboard: signal(true),
            startupBehavior: signal(StartupBehavior.FirstView),
            defaultWorkspacePage: signal<DefaultWorkspacePage>('dashboard'),
        };
        TestBed.configureTestingModule({
            providers: [
                WorkspaceStartupPreferencesService,
                {
                    provide: PlaylistsService,
                    useValue: playlistsService,
                },
                {
                    provide: SettingsStore,
                    useValue: settingsStore,
                },
            ],
        });

        service = TestBed.inject(WorkspaceStartupPreferencesService);
    });

    it('resolves the first view to dashboard when dashboard is enabled', async () => {
        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/dashboard'
        );
    });

    it('resolves the first view to sources when dashboard is hidden', async () => {
        settingsStore.showDashboard.set(false);

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/sources'
        );
    });

    it('opens the most recently used M3U playlist on the TV guide by default', async () => {
        settingsStore.defaultWorkspacePage.set('tv-guide');
        playlistsService.getAllPlaylists.mockReturnValue(
            of([
                {
                    _id: 'older',
                    lastUsage: '2026-08-10T10:00:00Z',
                },
                {
                    _id: 'newer',
                    lastUsage: '2026-08-12T10:00:00Z',
                },
                {
                    _id: 'xtream',
                    lastUsage: '2026-08-13T10:00:00Z',
                    serverUrl: 'https://example.invalid',
                },
            ])
        );

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/playlists/newer/guide'
        );
    });

    it('falls back safely when a removed startup page remains in storage', async () => {
        settingsStore.defaultWorkspacePage.set(
            'removed-page' as DefaultWorkspacePage
        );

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/dashboard'
        );
    });

    it('restores the last route when restore-last-view is enabled', async () => {
        settingsStore.startupBehavior.set(StartupBehavior.RestoreLastView);
        service.persistLastRestorablePath('/workspace/global-recent?q=matrix');

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/global-recent'
        );
    });

    it('restores the followed-series workspace', async () => {
        settingsStore.startupBehavior.set(StartupBehavior.RestoreLastView);
        service.persistLastRestorablePath('/workspace/followed-series');

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/followed-series'
        );
    });

    it('falls back to sources when the stored dashboard route is hidden', async () => {
        settingsStore.showDashboard.set(false);
        settingsStore.startupBehavior.set(StartupBehavior.RestoreLastView);
        service.persistLastRestorablePath('/workspace/dashboard');

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/sources'
        );
    });

    it('canonicalizes detail routes to their section root', () => {
        expect(
            service.getRestorablePath(
                '/workspace/xtreams/playlist-1/vod/123/456?q=matrix'
            )
        ).toBe('/workspace/xtreams/playlist-1/vod');
    });

    it('ignores non-restorable routes', () => {
        expect(service.getRestorablePath('/workspace/settings')).toBeNull();
        expect(service.getRestorablePath('/workspace')).toBeNull();
        expect(service.getRestorablePath('/unknown')).toBeNull();
    });

    it('falls back to the first available view when the stored playlist no longer exists', async () => {
        settingsStore.startupBehavior.set(StartupBehavior.RestoreLastView);
        playlistsService.getAllPlaylists.mockReturnValue(of([]));
        service.persistLastRestorablePath('/workspace/xtreams/missing/live');

        await expect(service.resolveInitialWorkspacePath()).resolves.toBe(
            '/workspace/dashboard'
        );
    });
});
