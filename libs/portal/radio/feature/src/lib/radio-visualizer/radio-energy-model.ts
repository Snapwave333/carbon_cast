/**
 * The signal that drives the radio visualizer.
 *
 * It is synthesized rather than measured, and that is a platform constraint,
 * not a shortcut: reading a stream's real spectrum needs a
 * `MediaElementAudioSourceNode`, and the Web Audio spec makes such a node emit
 * silence for any cross-origin resource that did not opt in via CORS. Internet
 * radio streams almost never send those headers, so tapping the element would
 * mute the very audio it is meant to visualize.
 *
 * What is modelled instead is the *shape* of music: several bands drifting at
 * incommensurate rates so the motion never visibly loops, a pulse train that
 * gives the low bands their punch, and an envelope that swells on play and
 * settles on pause.
 */

export const ENERGY_BAND_COUNT = 7;

/** Layered per band so no two bands ever line up for long. */
const BAND_RATES: readonly number[] = [
    0.11, 0.17, 0.23, 0.31, 0.41, 0.53, 0.67,
];
const BAND_OFFSETS: readonly number[] = [
    0.0, 1.7, 3.1, 4.6, 0.9, 2.4, 5.2,
];
/** Beats per second of the synthetic pulse train. */
const PULSE_RATE = 1.9;
const PULSE_DECAY = 7.5;
/** Seconds for the envelope to travel most of the way to its target. */
const ENVELOPE_RISE = 0.6;
const ENVELOPE_FALL = 1.4;
const IDLE_LEVEL = 0.16;

export interface EnergyInput {
    /** Seconds since the visualizer started. */
    time: number;
    isPlaying: boolean;
    /** 0-1 output level; a muted player still drifts, just faintly. */
    volume: number;
}

export interface EnergyFrame {
    /** Per-band levels in 0-1, low frequencies first. */
    bands: number[];
    /** Mean level across the bands, in 0-1. */
    level: number;
    /** 0-1 impulse that spikes on each synthetic beat. */
    pulse: number;
}

/**
 * A smooth, seeded oscillation in -1..1. Three incommensurate sines beat
 * against each other, which reads as organic without needing a noise table.
 */
function drift(time: number, rate: number, offset: number): number {
    return (
        (Math.sin(time * rate + offset) +
            Math.sin(time * rate * 1.618 + offset * 2.1) * 0.6 +
            Math.sin(time * rate * 2.71 + offset * 0.7) * 0.35) /
        1.95
    );
}

/** Sawtooth-decayed impulse train: a sharp attack, an exponential tail. */
function pulseAt(time: number): number {
    const phase = time * PULSE_RATE - Math.floor(time * PULSE_RATE);
    return Math.exp(-phase * PULSE_DECAY / PULSE_RATE);
}

function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Advances the envelope towards its target. Exposed separately so the caller
 * owns the state and the model itself stays a pure function.
 */
export function advanceEnvelope(
    current: number,
    input: EnergyInput,
    deltaSeconds: number
): number {
    const target = input.isPlaying ? 0.45 + 0.55 * clamp01(input.volume) : 0;
    const timeConstant = target > current ? ENVELOPE_RISE : ENVELOPE_FALL;
    const step = 1 - Math.exp(-deltaSeconds / timeConstant);
    return current + (target - current) * step;
}

export function sampleEnergy(
    input: EnergyInput,
    envelope: number
): EnergyFrame {
    const pulse = input.isPlaying ? pulseAt(input.time) : 0;
    const bands: number[] = [];
    let total = 0;

    for (let index = 0; index < ENERGY_BAND_COUNT; index++) {
        const wander = drift(
            input.time,
            BAND_RATES[index],
            BAND_OFFSETS[index]
        );
        // Low bands carry the beat; high bands shimmer instead.
        const beatWeight = 1 - index / ENERGY_BAND_COUNT;
        const shaped =
            0.5 +
            wander * 0.42 +
            pulse * beatWeight * 0.45 -
            (index / ENERGY_BAND_COUNT) * 0.18;

        const band = clamp01(IDLE_LEVEL + (shaped - IDLE_LEVEL) * envelope);
        bands.push(band);
        total += band;
    }

    return {
        bands,
        level: total / ENERGY_BAND_COUNT,
        pulse: pulse * envelope,
    };
}
