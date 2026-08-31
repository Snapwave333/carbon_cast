import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import {
    ChannelActions,
    selectActive,
    selectChannels,
} from '@iptvnator/m3u-state';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Channel } from '@iptvnator/shared/interfaces';
import { WorkspaceShellRailComponent } from './workspace-shell-rail.component';

@Component({
    selector: 'mat-icon',
    template: '',
    standalone: true,
})
class MockMatIconComponent {
    readonly svgIcon = input<string>('');
}

@Component({
    selector: 'app-workspace-shell-rail-links',
    template: '',
    standalone: true,
})
class MockWorkspaceShellRailLinksComponent {
    readonly links = input<unknown[]>([]);
    readonly selectedSection = input<string | null>(null);
    readonly activeClass = input('active');
    readonly showLabels = input(false);
    readonly tooltipPosition = input('below');
}

describe('WorkspaceShellRailComponent', () => {
    let fixture: ComponentFixture<WorkspaceShellRailComponent>;
    let store: MockStore;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [WorkspaceShellRailComponent],
            providers: [
                provideRouter([]),
                provideMockStore({
                    selectors: [
                        { selector: selectActive, value: null },
                        { selector: selectChannels, value: [] },
                    ],
                }),
                {
                    provide: TranslateService,
                    useValue: {
                        instant: (key: string) => key,
                        get: (key: string) => of(key),
                        stream: (key: string) => of(key),
                        onLangChange: of(null),
                        onTranslationChange: of(null),
                        onDefaultLangChange: of(null),
                        currentLang: 'en',
                        defaultLang: 'en',
                    },
                },
            ],
        })
            .overrideComponent(WorkspaceShellRailComponent, {
                set: {
                    imports: [
                        MockMatIconComponent,
                        MatIconButton,
                        MatTooltip,
                        MockWorkspaceShellRailLinksComponent,
                        RouterLink,
                        TranslatePipe,
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(WorkspaceShellRailComponent);
        store = TestBed.inject(MockStore);
    });

    it('renders provider and workspace links in one labelled bottom dock', () => {
        fixture.componentRef.setInput('brandLink', '/workspace/sources');
        fixture.componentRef.setInput(
            'brandAriaLabelKey',
            'WORKSPACE.SHELL.OPEN_SOURCES'
        );
        fixture.componentRef.setInput('primaryContextLinks', [
            {
                icon: 'movie',
                tooltip: 'Movies',
                path: ['/workspace', 'xtreams', 'pl-1', 'vod'],
                section: 'vod',
            },
        ]);
        fixture.componentRef.setInput(
            'railProviderClass',
            'rail-context-region rail-context-region--xtreams'
        );
        fixture.componentRef.setInput('isSettingsRoute', true);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.app-nav-dock')
        ).not.toBeNull();
        expect(
            fixture.nativeElement.querySelector('.rail-context-region--xtreams')
        ).not.toBeNull();
        expect(
            fixture.nativeElement.querySelectorAll('.nav-primary-row').length
        ).toBe(1);
        expect(
            fixture.nativeElement.querySelector('.nav-context-cluster')
                ?.parentElement
        ).toBe(fixture.nativeElement.querySelector('.nav-destinations-scroll'));
        const contextCluster = fixture.nativeElement.querySelector(
            '.nav-context-cluster'
        ) as HTMLElement;
        expect(
            fixture.nativeElement.querySelector('.nav-context-row')
        ).toBeNull();
        expect(
            fixture.nativeElement.querySelector('.nav-settings.is-active')
        ).not.toBeNull();
        expect(fixture.nativeElement.querySelector('.rail-toggle')).toBeNull();
        expect(
            fixture.nativeElement.querySelector('.brand')?.getAttribute('href')
        ).toContain('/workspace/sources');
        expect(
            fixture.nativeElement
                .querySelector('.brand')
                ?.getAttribute('aria-label')
        ).toBe('WORKSPACE.SHELL.OPEN_SOURCES');
    });

    it('switches through the active M3U playlist from the bottom dock', () => {
        const channels = [
            { id: 'one', name: 'One', url: 'https://example.invalid/one' },
            { id: 'two', name: 'Two', url: 'https://example.invalid/two' },
        ] as Channel[];
        const dispatch = jest.spyOn(store, 'dispatch');

        store.overrideSelector(selectChannels, channels);
        store.overrideSelector(selectActive, channels[0]);
        store.refreshState();
        fixture.componentRef.setInput('isM3uPlaylistRoute', true);
        fixture.detectChanges();

        const up = fixture.nativeElement.querySelector(
            '[data-test-id="workspace-channel-up"]'
        ) as HTMLButtonElement;
        const down = fixture.nativeElement.querySelector(
            '[data-test-id="workspace-channel-down"]'
        ) as HTMLButtonElement;

        up.click();
        down.click();

        expect(dispatch).toHaveBeenNthCalledWith(
            1,
            ChannelActions.setActiveChannel({
                channel: channels[1],
                startPlayback: true,
            })
        );
        expect(dispatch).toHaveBeenNthCalledWith(
            2,
            ChannelActions.setActiveChannel({
                channel: channels[1],
                startPlayback: true,
            })
        );
    });
});
