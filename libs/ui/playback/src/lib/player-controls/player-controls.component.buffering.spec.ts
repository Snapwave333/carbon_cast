import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
    DEFAULT_PLAYER_CAPABILITIES,
    createEmptyControlsState,
} from './player-controls-defaults';
import { PlayerControlsComponent } from './player-controls.component';
import type {
    PlayerControlsCommands,
    PlayerControlsState,
    PlayerController,
} from './player-controls.model';

function createFakeController() {
    const capabilities = signal({ ...DEFAULT_PLAYER_CAPABILITIES });
    const state: WritableSignal<PlayerControlsState> = signal(
        createEmptyControlsState()
    );
    const commands: jest.Mocked<PlayerControlsCommands> = {
        togglePlay: jest.fn(),
        seekTo: jest.fn(),
        seekBy: jest.fn(),
        setVolume: jest.fn(),
        setAudioTrack: jest.fn(),
        setSubtitleTrack: jest.fn(),
        setPlaybackSpeed: jest.fn(),
        setAspectRatio: jest.fn(),
        toggleRecording: jest.fn(),
        togglePictureInPicture: jest.fn(),
    };
    const controller: PlayerController = { capabilities, state, commands };
    return { controller, capabilities, state, commands };
}

describe('PlayerControlsComponent buffering indicator', () => {
    let fixture: ComponentFixture<PlayerControlsComponent>;
    let fake: ReturnType<typeof createFakeController>;

    const setState = (overrides: Partial<PlayerControlsState>) =>
        fake.state.set({ ...createEmptyControlsState(), ...overrides });

    const query = (selector: string) =>
        fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    const buffering = () => query('[data-test-id="player-controls-buffering"]');

    beforeEach(async () => {
        localStorage.removeItem('volume');
        await TestBed.configureTestingModule({
            imports: [PlayerControlsComponent, TranslateModule.forRoot()],
        }).compileComponents();

        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('en', {
            EMBEDDED_MPV: { PLAYER: { LOADING_STREAM: 'Loading stream…' } },
        });
        translate.use('en');

        fake = createFakeController();
        fixture = TestBed.createComponent(PlayerControlsComponent);
        fixture.componentRef.setInput('controller', fake.controller);
        fixture.detectChanges();
    });

    it('shows the branded loop while loading and while stalled', () => {
        setState({ status: 'loading' });
        fixture.detectChanges();
        expect(buffering()).not.toBeNull();
        expect(buffering()?.getAttribute('aria-label')).toBe('Loading stream…');

        setState({ status: 'playing', stalled: true });
        fixture.detectChanges();
        expect(buffering()).not.toBeNull();
    });

    it('stays hidden while playback is healthy', () => {
        setState({ status: 'playing', stalled: false });
        fixture.detectChanges();

        expect(buffering()).toBeNull();
    });

    it('hides with the rest of the controls surface', () => {
        setState({ status: 'loading' });
        fixture.componentRef.setInput('showControls', false);
        fixture.detectChanges();

        expect(buffering()).toBeNull();
    });

    it('points at the rendered sprite strip', () => {
        setState({ status: 'loading' });
        fixture.detectChanges();

        const strip = query(
            '.player-controls__buffering-strip'
        ) as HTMLImageElement | null;
        // Relative on purpose: an absolute /assets path does not resolve under
        // Electron's file:// base href.
        expect(strip?.getAttribute('src')).toBe(
            'assets/animations/loading-loop.webp'
        );
    });
});
