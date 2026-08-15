import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
    DocumentPictureInPictureService,
    PlaybackBarService,
    PopOutRequest,
} from '@iptvnator/portal/shared/util';
import { RadioPlayerStore } from '@iptvnator/portal/radio/data-access';
import { RadioPlayerComponent } from '@iptvnator/portal/radio/feature';
import { WorkspacePlaybackBarComponent } from './workspace-playback-bar.component';

/**
 * The bar owns two pieces of behaviour worth pinning: cycling the three sizes,
 * and the pop-out, whose whole difficulty is that the floating window and the
 * content it holds have separate lifetimes.
 */

/**
 * Stands in for the real player, which has its own suite and its own stack of
 * dependencies. The bar only cares that something occupies the slot.
 */
@Component({ selector: 'app-radio-player', template: '' })
class StubRadioPlayerComponent {}

class FakePictureInPicture {
    supported = true;
    open = jest.fn<Promise<boolean>, [PopOutRequest]>().mockResolvedValue(true);
    close = jest.fn(() => {
        this.opened = false;
    });
    private opened = false;

    get isSupported(): boolean {
        return this.supported;
    }

    get isOpen(): boolean {
        return this.opened;
    }

    /** Mirrors a successful `open()` so `isOpen` reflects reality afterwards. */
    succeed(): void {
        this.open.mockImplementation(async () => {
            this.opened = true;
            return true;
        });
    }

    refuse(): void {
        this.open.mockResolvedValue(false);
    }
}

describe('WorkspacePlaybackBarComponent', () => {
    let fixture: ComponentFixture<WorkspacePlaybackBarComponent>;
    let component: WorkspacePlaybackBarComponent;
    let pip: FakePictureInPicture;
    let bar: PlaybackBarService;
    let player: RadioPlayerStore;

    beforeEach(async () => {
        localStorage.clear();
        pip = new FakePictureInPicture();
        pip.succeed();

        await TestBed.configureTestingModule({
            imports: [
                WorkspacePlaybackBarComponent,
                NoopAnimationsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                { provide: DocumentPictureInPictureService, useValue: pip },
            ],
        })
            .overrideComponent(WorkspacePlaybackBarComponent, {
                remove: { imports: [RadioPlayerComponent] },
                add: { imports: [StubRadioPlayerComponent] },
            })
            .compileComponents();

        bar = TestBed.inject(PlaybackBarService);
        player = TestBed.inject(RadioPlayerStore);
        fixture = TestBed.createComponent(WorkspacePlaybackBarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    /**
     * The bar only exists while something has media — its whole template sits
     * behind that check, including the element the pop-out moves.
     */
    function startPlayback(): void {
        player.play({
            id: 'station-1',
            kind: 'station',
            title: 'Jazz FM',
            streamUrl: 'https://example.invalid/stream',
        });
        fixture.detectChanges();
    }

    afterEach(() => {
        localStorage.clear();
    });

    it('cycles the three sizes and labels the next press, not the current size', () => {
        expect(component.size()).toBe('compact');
        expect(component.sizeLabel()).toBe('PLAYBACK_BAR.EXPAND');

        component.cycleSize();
        expect(component.size()).toBe('medium');
        expect(component.sizeLabel()).toBe('PLAYBACK_BAR.MAXIMIZE');

        component.cycleSize();
        expect(component.size()).toBe('large');
        expect(component.sizeLabel()).toBe('PLAYBACK_BAR.COLLAPSE');

        component.cycleSize();
        expect(component.size()).toBe('compact');
    });

    it('hides the pop-out control where the API is unavailable', async () => {
        pip.supported = false;

        const bare = TestBed.createComponent(WorkspacePlaybackBarComponent);
        bare.detectChanges();

        expect(bare.componentInstance.canPopOut).toBe(false);
    });

    it('hands the content and its placeholder to the pop-out', async () => {
        startPlayback();
        await component.togglePopOut();

        const request = pip.open.mock.calls[0][0];
        expect(request.content).toBeInstanceOf(HTMLElement);
        expect(request.placeholder).toBeInstanceOf(HTMLElement);
        // The content has to be a descendant of the slot it returns to.
        expect(request.placeholder.contains(request.content)).toBe(true);
    });

    it('marks the bar popped out once the window opens', async () => {
        startPlayback();
        await component.togglePopOut();

        expect(bar.isPoppedOut()).toBe(true);
        expect(component.popOutFailed()).toBe(false);
    });

    it('surfaces a refusal instead of pretending it worked', async () => {
        startPlayback();
        pip.refuse();

        await component.togglePopOut();

        expect(bar.isPoppedOut()).toBe(false);
        expect(component.popOutFailed()).toBe(true);
    });

    it('clears a stale failure when the pop-out is dismissed', async () => {
        startPlayback();
        pip.refuse();
        await component.togglePopOut();
        expect(component.popOutFailed()).toBe(true);

        pip.succeed();
        await component.togglePopOut();

        expect(component.popOutFailed()).toBe(false);
    });

    it('closes the window on a second press rather than opening another', async () => {
        startPlayback();
        await component.togglePopOut();
        pip.open.mockClear();

        await component.togglePopOut();

        expect(pip.close).toHaveBeenCalled();
        expect(pip.open).not.toHaveBeenCalled();
    });

    it('returns the bar to normal when the window is closed from outside', async () => {
        startPlayback();
        await component.togglePopOut();
        const request = pip.open.mock.calls[0][0];

        request.onClose?.();

        expect(bar.isPoppedOut()).toBe(false);
    });

    /**
     * The bar is destroyed the moment playback stops. Without this the window
     * would outlive the content that was torn out of it and linger as an empty
     * always-on-top window with no way back.
     */
    it('closes the floating window when the bar goes away', async () => {
        startPlayback();
        await component.togglePopOut();
        pip.close.mockClear();

        fixture.destroy();

        expect(pip.close).toHaveBeenCalled();
    });

    it('shows the bar only while something has media', () => {
        expect(component.hasMedia()).toBe(false);
        expect(
            fixture.nativeElement.querySelector('.playback-bar')
        ).toBeNull();

        startPlayback();

        expect(component.hasMedia()).toBe(true);
        expect(
            fixture.nativeElement.querySelector('.playback-bar')
        ).not.toBeNull();
    });
});
