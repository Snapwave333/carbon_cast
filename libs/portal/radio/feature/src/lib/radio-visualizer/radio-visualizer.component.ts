import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    input,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import {
    advanceEnvelope,
    EnergyFrame,
    sampleEnergy,
} from './radio-energy-model';
import { RadioMetaballRenderer } from './radio-metaball-renderer';

/** Hue revolutions per second at rest; loud passages push it faster. */
const BASE_HUE_RATE = 0.012;
const HUE_RATE_GAIN = 0.05;
/** Frames keep running this long after the envelope settles, then stop. */
const IDLE_TIMEOUT_SECONDS = 2.5;

@Component({
    selector: 'app-radio-visualizer',
    template: `
        <canvas
            #canvas
            class="radio-visualizer__canvas"
            [class.is-hidden]="!isSupported()"
            aria-hidden="true"
        ></canvas>
    `,
    styleUrl: './radio-visualizer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioVisualizerComponent {
    readonly isPlaying = input(false);
    readonly volume = input(1);
    /** Restarts the hue sweep from a new angle when the track changes. */
    readonly trackId = input<string>('');

    readonly isSupported = signal(true);

    private readonly canvasRef =
        viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
    private readonly destroyRef = inject(DestroyRef);

    private renderer: RadioMetaballRenderer | null = null;
    private frameHandle: number | null = null;
    private startedAt = 0;
    private lastFrameAt = 0;
    private envelope = 0;
    private hue = Math.random();
    private idleFor = 0;
    private readonly prefersReducedMotion = matchesReducedMotion();

    constructor() {
        effect(() => {
            const trackId = this.trackId();
            untracked(() => {
                if (trackId) {
                    this.hue = hashToUnit(trackId);
                }
            });
        });

        // Renderer setup and loop start share one effect so the renderer is
        // guaranteed to exist by the time `start` runs — as separate effects
        // the start could win the race and then never be retried, because
        // playback state has not changed since.
        //
        // Playback state is what wakes the loop; when nothing is playing it
        // parks itself, so an idle dock costs no frames.
        effect(() => {
            const canvas = this.canvasRef().nativeElement;
            this.isPlaying();
            this.volume();

            untracked(() => {
                if (!this.renderer) {
                    this.renderer = RadioMetaballRenderer.create(canvas);
                    this.isSupported.set(this.renderer !== null);
                }
                this.start();
            });
        });

        this.destroyRef.onDestroy(() => {
            this.stop();
            this.renderer?.dispose();
            this.renderer = null;
        });
    }

    private start(): void {
        if (this.frameHandle !== null || !this.renderer) {
            return;
        }

        this.idleFor = 0;
        this.startedAt = performance.now() / 1000;
        this.lastFrameAt = this.startedAt;
        this.frameHandle = requestAnimationFrame(() => this.frame());
    }

    private stop(): void {
        if (this.frameHandle === null) {
            return;
        }
        cancelAnimationFrame(this.frameHandle);
        this.frameHandle = null;
    }

    private frame(): void {
        const renderer = this.renderer;
        if (!renderer) {
            this.frameHandle = null;
            return;
        }

        const now = performance.now() / 1000;
        // Clamped so a backgrounded tab does not resume with a huge jump.
        const delta = Math.min(now - this.lastFrameAt, 0.1);
        this.lastFrameAt = now;

        const input = {
            time: now - this.startedAt,
            isPlaying: this.isPlaying(),
            volume: this.volume(),
        };
        this.envelope = advanceEnvelope(this.envelope, input, delta);
        const energy = sampleEnergy(input, this.envelope);

        this.hue = wrapUnit(
            this.hue +
                delta *
                    (BASE_HUE_RATE + energy.level * HUE_RATE_GAIN) *
                    (this.prefersReducedMotion ? 0.25 : 1)
        );

        renderer.render(
            this.prefersReducedMotion ? input.time * 0.25 : input.time,
            this.hue,
            energy
        );

        if (this.shouldPark(energy, delta)) {
            this.frameHandle = null;
            return;
        }

        this.frameHandle = requestAnimationFrame(() => this.frame());
    }

    private shouldPark(energy: EnergyFrame, delta: number): boolean {
        if (this.isPlaying() || this.envelope > 0.02) {
            this.idleFor = 0;
            return false;
        }

        this.idleFor += delta;
        return this.idleFor > IDLE_TIMEOUT_SECONDS && energy.level <= 0.2;
    }
}

function matchesReducedMotion(): boolean {
    return (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function wrapUnit(value: number): number {
    return value - Math.floor(value);
}

/** Stable per-track starting hue, so each station has its own colour identity. */
function hashToUnit(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 1000;
}
