import { Component, Directive, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet, provideRouter } from '@angular/router';
import {
    WorkspacePortalContext,
    WorkspaceShellContextPanel,
} from '@iptvnator/workspace/shell/util';
import { WorkspaceShellComponent } from './workspace-shell.component';
import { WorkspaceShellFacade } from './services/workspace-shell.facade';

@Component({
    selector: 'app-workspace-shell-rail',
    template: '',
    standalone: true,
})
class MockWorkspaceShellRailComponent {
    readonly brandLink = input('/workspace/dashboard');
    readonly brandTooltipKey = input('WORKSPACE.SHELL.RAIL_DASHBOARD');
    readonly brandAriaLabelKey = input('WORKSPACE.SHELL.OPEN_DASHBOARD');
    readonly workspaceLinks = input<unknown[]>([]);
    readonly primaryContextLinks = input<unknown[]>([]);
    readonly secondaryContextLinks = input<unknown[]>([]);
    readonly selectedSection = input<string | null>(null);
    readonly railProviderClass = input('');
    readonly isSettingsRoute = input(false);
    readonly isM3uPlaylistRoute = input(false);
}

@Component({
    selector: 'app-workspace-shell-context-sidebar',
    template: '',
    standalone: true,
})
class MockWorkspaceShellContextSidebarComponent {
    readonly variant = input<WorkspaceShellContextPanel>('none');
    readonly context = input<WorkspacePortalContext | null>(null);
    readonly section = input<string | null>(null);
    readonly hasPlaylists = input(false);
}

@Component({
    selector: 'app-external-playback-dock',
    template: '',
    standalone: true,
})
class MockExternalPlaybackDockComponent {
    readonly session = input<unknown>(null);
    readonly closeClicked = output<void>();
}

@Component({
    selector: 'app-playlist-drop-overlay',
    template: '',
    standalone: true,
})
class MockPlaylistDropOverlayComponent {
    readonly state = input<unknown>({ kind: 'idle' });
}

@Directive({
    selector: '[appPlaylistDropZone]',
    exportAs: 'playlistDropZone',
    standalone: true,
})
class MockPlaylistDropZoneDirective {
    readonly overlayState = signal({ kind: 'idle' });
}

@Component({
    selector: 'app-workspace-shell-import-overlay',
    template: '',
    standalone: true,
})
class MockWorkspaceShellImportOverlayComponent {}

class MockWorkspaceShellFacade {
    readonly brandLink = signal('/workspace/dashboard');
    readonly brandTooltipKey = signal('WORKSPACE.SHELL.RAIL_DASHBOARD');
    readonly brandAriaLabelKey = signal('WORKSPACE.SHELL.OPEN_DASHBOARD');
    readonly workspaceLinks = signal([]);
    readonly primaryContextLinks = signal([]);
    readonly secondaryContextLinks = signal([]);
    readonly currentSection = signal<string | null>(null);
    readonly railProviderClass = signal('rail-context-region');
    readonly isSettingsRoute = signal(false);
    readonly searchQuery = signal('');
    readonly hasNoPlaylists = signal(false);
    readonly isM3uPlaylistRoute = signal(false);
    readonly showContextPanel = signal(true);
    readonly contextPanel = signal<WorkspaceShellContextPanel>('settings');
    readonly currentContext = signal<WorkspacePortalContext | null>(null);
    readonly showExternalPlaybackBar = signal(true);
    readonly externalPlaybackSession = signal({ id: 'session-1' });
    readonly showXtreamImportOverlay = signal(false);
    readonly xtreamImportCount = signal(0);
    readonly xtreamItemsToImport = signal(0);
    readonly xtreamActiveImportCount = signal(0);
    readonly xtreamActiveItemsToImport = signal(0);
    readonly xtreamImportTitleLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_TITLE'
    );
    readonly xtreamImportSourceLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_REMOTE_BADGE'
    );
    readonly xtreamImportPhaseLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_LOADING'
    );
    readonly xtreamImportDetailLabel = signal(
        'WORKSPACE.SHELL.XTREAM_IMPORT_DETAIL_REMOTE'
    );
    readonly xtreamImportProgressLabel = signal('');
    readonly xtreamImportPhaseTone = signal<'remote' | 'local' | null>(
        'remote'
    );
    readonly canCancelXtreamImport = signal(false);
    readonly isCancellingXtreamImport = signal(false);
    readonly isMacOS = true;
    readonly isElectron = true;

    openGlobalSearch = jest.fn();
    closeActiveExternalSession = jest.fn();
    cancelXtreamImport = jest.fn();
}

describe('WorkspaceShellComponent', () => {
    it('creates and renders the shell composition with mocked children', async () => {
        const facade = new MockWorkspaceShellFacade();

        await TestBed.configureTestingModule({
            imports: [WorkspaceShellComponent],
            providers: [provideRouter([])],
        })
            .overrideComponent(WorkspaceShellComponent, {
                set: {
                    imports: [
                        RouterOutlet,
                        MockExternalPlaybackDockComponent,
                        MockPlaylistDropOverlayComponent,
                        MockPlaylistDropZoneDirective,
                        MockWorkspaceShellContextSidebarComponent,
                        MockWorkspaceShellImportOverlayComponent,
                        MockWorkspaceShellRailComponent,
                    ],
                    providers: [
                        {
                            provide: WorkspaceShellFacade,
                            useValue: facade,
                        },
                    ],
                },
            })
            .compileComponents();

        const fixture = TestBed.createComponent(WorkspaceShellComponent);
        fixture.detectChanges();

        expect(fixture.componentInstance).toBeTruthy();
        expect(
            fixture.nativeElement.querySelector('app-workspace-shell-rail')
        ).not.toBeNull();
        expect(
            fixture.nativeElement.querySelector('app-workspace-shell-header')
        ).toBeNull();
        expect(
            fixture.nativeElement.querySelector(
                'app-workspace-shell-context-sidebar'
            )
        ).not.toBeNull();
        expect(
            fixture.nativeElement.querySelector('app-external-playback-dock')
        ).not.toBeNull();
    });

    it('renders the xtream import overlay child only when the facade flag is true', async () => {
        const facade = new MockWorkspaceShellFacade();

        await TestBed.configureTestingModule({
            imports: [WorkspaceShellComponent],
            providers: [provideRouter([])],
        })
            .overrideComponent(WorkspaceShellComponent, {
                set: {
                    imports: [
                        RouterOutlet,
                        MockExternalPlaybackDockComponent,
                        MockPlaylistDropOverlayComponent,
                        MockPlaylistDropZoneDirective,
                        MockWorkspaceShellContextSidebarComponent,
                        MockWorkspaceShellImportOverlayComponent,
                        MockWorkspaceShellRailComponent,
                    ],
                    providers: [
                        {
                            provide: WorkspaceShellFacade,
                            useValue: facade,
                        },
                    ],
                },
            })
            .compileComponents();

        const fixture = TestBed.createComponent(WorkspaceShellComponent);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                'app-workspace-shell-import-overlay'
            )
        ).toBeNull();

        facade.showXtreamImportOverlay.set(true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector(
                'app-workspace-shell-import-overlay'
            )
        ).not.toBeNull();
    });

    it('opens routed global search on Ctrl/Cmd+F without restoring a top search bar', async () => {
        const facade = new MockWorkspaceShellFacade();

        await TestBed.configureTestingModule({
            imports: [WorkspaceShellComponent],
            providers: [provideRouter([])],
        })
            .overrideComponent(WorkspaceShellComponent, {
                set: {
                    imports: [
                        RouterOutlet,
                        MockExternalPlaybackDockComponent,
                        MockPlaylistDropOverlayComponent,
                        MockPlaylistDropZoneDirective,
                        MockWorkspaceShellContextSidebarComponent,
                        MockWorkspaceShellImportOverlayComponent,
                        MockWorkspaceShellRailComponent,
                    ],
                    providers: [
                        {
                            provide: WorkspaceShellFacade,
                            useValue: facade,
                        },
                    ],
                },
            })
            .compileComponents();

        const fixture = TestBed.createComponent(WorkspaceShellComponent);
        fixture.detectChanges();
        const event = new KeyboardEvent('keydown', {
            key: 'f',
            metaKey: true,
            bubbles: true,
            cancelable: true,
        });

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(facade.openGlobalSearch).toHaveBeenCalledWith('');
    });
});
