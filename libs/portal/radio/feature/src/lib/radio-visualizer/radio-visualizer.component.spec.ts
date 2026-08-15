import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    MetaballFrame,
    RadioMetaballRenderer,
} from './radio-metaball-renderer';
import { RadioVisualizerComponent } from './radio-visualizer.component';

/**
 * The frame loop decides whether anything is drawn at all, and none of it is
 * reachable from the shader tests. Everything here drives
 * `requestAnimationFrame` and the clock by hand, so a whole idle timeout takes
 * no real time.
 */

interface FakeRenderer {
    render: jest.Mock<void, [MetaballFrame]>;
    dispose: jest.Mock;
}

function fakeRenderer(): FakeRenderer {
    return { render: jest.fn(), dispose: jest.fn() };
}

describe('RadioVisualizerComponent', () => {
    let fixture: ComponentFixture<RadioVisualizerComponent>;
    let renderer: FakeRenderer;
    /**
     * Angular's change-detection scheduler also uses `requestAnimationFrame`
     * and cancels its own handle, so the fake has to honour ids. Clearing the
     * queue instead threw the visualizer's frame away along with Angular's, and
     * the loop looked as though it had never started.
     */
    let scheduled: Map<number, FrameRequestCallback>;
    let nextFrameId: number;
    let now: number;

    /** Runs every callback registered for the next frame, as a browser would. */
    function pump(seconds = 1 / 60): void {
        const due = [...scheduled.values()];
        scheduled.clear();
        now += seconds * 1000;
        for (const callback of due) {
            callback(now);
        }
    }

    function renderCount(): number {
        return renderer.render.mock.calls.length;
    }

    /**
     * Pumps until the visualizer stops drawing, returning how many frames it
     * took. Asserting on drawing rather than on the queue keeps this
     * independent of whatever Angular happens to schedule.
     */
    function pumpUntilQuiet(limit = 3000): number {
        for (let count = 1; count <= limit; count++) {
            const before = renderCount();
            pump();
            if (renderCount() === before) {
                return count;
            }
        }
        throw new Error('the visualizer never stopped drawing');
    }

    function lastFrame(): MetaballFrame {
        const calls = renderer.render.mock.calls;
        return calls[calls.length - 1][0];
    }

    function stubFrameClock(): void {
        jest.spyOn(performance, 'now').mockImplementation(() => now);
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(
            (callback) => {
                const id = nextFrameId++;
                scheduled.set(id, callback);
                return id;
            }
        );
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
            scheduled.delete(id);
        });
    }

    beforeEach(async () => {
        scheduled = new Map();
        nextFrameId = 1;
        now = 0;
        renderer = fakeRenderer();

        stubFrameClock();
        jest.spyOn(RadioMetaballRenderer, 'create').mockImplementation(
            () => renderer as unknown as RadioMetaballRenderer
        );

        await TestBed.configureTestingModule({
            imports: [RadioVisualizerComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RadioVisualizerComponent);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('draws nothing until it is asked to', () => {
        expect(renderCount()).toBe(0);
    });

    it('runs frames while playing', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();

        pump();
        pump();

        expect(renderCount()).toBe(2);
    });

    it('keeps running while playback continues', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();

        for (let count = 0; count < 600; count++) {
            pump();
        }

        expect(renderCount()).toBe(600);
    });

    // An idle dock must cost nothing. Parking used to also require the energy
    // level to drop below a threshold the model can no longer reach.
    it('parks itself once playback stops and the envelope settles', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        pump();

        fixture.componentRef.setInput('isPlaying', false);
        fixture.detectChanges();

        // Not immediate: the envelope has to fall away first.
        expect(pumpUntilQuiet()).toBeGreaterThan(60);

        const parked = renderCount();
        pump();
        pump();
        expect(renderCount()).toBe(parked);
    });

    it('wakes back up when playback resumes', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        pump();
        fixture.componentRef.setInput('isPlaying', false);
        fixture.detectChanges();
        pumpUntilQuiet();
        const parked = renderCount();

        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        pump();

        expect(renderCount()).toBeGreaterThan(parked);
    });

    it('gives each station its own colours and arrangement', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.componentRef.setInput('trackId', 'station-a');
        fixture.detectChanges();
        pump();
        const first = lastFrame();

        fixture.componentRef.setInput('trackId', 'station-b');
        fixture.detectChanges();
        pump();
        const second = lastFrame();

        expect(second.seed).not.toBe(first.seed);
        expect(second.hue).not.toBeCloseTo(first.hue, 3);
    });

    it('gives a station the same arrangement every time it plays', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.componentRef.setInput('trackId', 'station-a');
        fixture.detectChanges();
        pump();
        const first = lastFrame();

        fixture.componentRef.setInput('trackId', 'station-b');
        fixture.detectChanges();
        pump();
        fixture.componentRef.setInput('trackId', 'station-a');
        fixture.detectChanges();
        pump();

        expect(lastFrame().seed).toBe(first.seed);
    });

    it('asks for trails by default', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        pump();

        expect(lastFrame().trails).toBe(true);
    });

    it('hides the canvas when WebGL2 is unavailable', () => {
        jest.spyOn(RadioMetaballRenderer, 'create').mockReturnValue(null);

        const bare = TestBed.createComponent(RadioVisualizerComponent);
        bare.componentRef.setInput('isPlaying', true);
        bare.detectChanges();

        expect(bare.componentInstance.isSupported()).toBe(false);
        expect(
            bare.nativeElement.querySelector('canvas.is-hidden')
        ).not.toBeNull();
    });

    it('releases the GPU resources when it goes away', () => {
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        pump();

        fixture.destroy();
        const atDestroy = renderCount();
        pump();

        expect(renderer.dispose).toHaveBeenCalled();
        // ...and it must not keep drawing into a renderer it has disposed.
        expect(renderCount()).toBe(atDestroy);
    });
});

describe('RadioVisualizerComponent under reduced motion', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete (window as Partial<Window>).matchMedia;
    });

    it('asks for no trails, because smearing is what it is meant to avoid', async () => {
        const scheduled: FrameRequestCallback[] = [];
        const renderer = fakeRenderer();

        // jsdom ships no `matchMedia`, so it has to be defined rather than
        // spied on. Its absence is also why the rest of this file exercises the
        // normal path: the component treats "no matchMedia" as "no preference".
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                matches: query.includes('prefers-reduced-motion'),
            }),
        });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(
            (callback) => scheduled.push(callback)
        );
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
            // Nothing is cancelled in this test; ids do not matter.
        });
        jest.spyOn(RadioMetaballRenderer, 'create').mockImplementation(
            () => renderer as unknown as RadioMetaballRenderer
        );

        await TestBed.configureTestingModule({
            imports: [RadioVisualizerComponent],
        }).compileComponents();

        const fixture = TestBed.createComponent(RadioVisualizerComponent);
        fixture.componentRef.setInput('isPlaying', true);
        fixture.detectChanges();
        for (const callback of [...scheduled]) {
            callback(0);
        }

        expect(renderer.render).toHaveBeenCalled();
        expect(renderer.render.mock.calls[0][0].trails).toBe(false);
    });
});
