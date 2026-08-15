import {
    advanceEnvelope,
    sampleEnergy,
} from '../../libs/portal/radio/feature/src/lib/radio-visualizer/radio-energy-model';
import { RadioMetaballRenderer } from '../../libs/portal/radio/feature/src/lib/radio-visualizer/radio-metaball-renderer';

let renderer: RadioMetaballRenderer | null = null;
let envelope = 0;

/**
 * Drives a real frame sequence rather than one shot: trails only exist across
 * frames, so a single render would never show them.
 */
export function renderFrames(
    canvas: HTMLCanvasElement,
    endTime: number,
    hue: number,
    options: { trails?: boolean; seed?: number; fps?: number; window?: number } = {}
): boolean {
    const fps = options.fps ?? 60;
    if (!renderer) {
        renderer = RadioMetaballRenderer.create(canvas);
        envelope = 0;
        for (let step = 0; step < 400; step++) {
            envelope = advanceEnvelope(
                envelope,
                { time: 0, isPlaying: true, volume: 1 },
                1 / 60
            );
        }
    }
    if (!renderer) {
        return false;
    }

    // Only the tail end needs simulating; the trail has long since faded from
    // anything earlier.
    const start = Math.max(0, endTime - (options.window ?? 1));
    for (let time = start; time <= endTime + 1e-6; time += 1 / fps) {
        const input = { time, isPlaying: true, volume: 1 };
        renderer.render({
            time,
            hue,
            energy: sampleEnergy(input, envelope),
            seed: options.seed ?? 0,
            trails: options.trails !== false,
        });
    }
    return true;
}

export function reset(): void {
    renderer?.dispose();
    renderer = null;
}

(window as unknown as { Viz: unknown }).Viz = { renderFrames, reset };
