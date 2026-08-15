import { sampleEnergy } from './radio-energy-model';
import {
    computeOrbPlacements,
    OrbPlacement,
} from './radio-orb-choreography';

/** The player dock is a wide, short strip; this is its realistic shape. */
const DOCK_ASPECT = 1300 / 86;

function energyAt(time: number) {
    return sampleEnergy({ time, isPlaying: true, volume: 1 }, 1);
}

function placementsAt(time: number, aspect: number): OrbPlacement[] {
    return computeOrbPlacements(time, energyAt(time), aspect);
}

/** Widest horizontal extent of the cluster, as a fraction of canvas width. */
function widthSpanRatio(orbs: OrbPlacement[], aspect: number): number {
    const left = Math.min(...orbs.map((orb) => orb.x - orb.radius));
    const right = Math.max(...orbs.map((orb) => orb.x + orb.radius));
    return (right - left) / aspect;
}

describe('computeOrbPlacements', () => {
    const SAMPLE_TIMES = [0, 5, 11, 19, 28, 37];

    it('places one orb per energy band', () => {
        const energy = energyAt(0);

        expect(computeOrbPlacements(0, energy, DOCK_ASPECT)).toHaveLength(
            energy.bands.length
        );
    });

    // The visualizer originally sized its orbits for a square-ish canvas, so
    // on the real dock the whole cluster collapsed to a pinprick in the middle
    // — hidden behind the transport controls and effectively invisible. The
    // unscaled orbit spanned ~7% of the dock width, so the floor below is far
    // above that failure while still leaving room for the orbs to gather, which
    // is a thing their temperaments are supposed to make them do.
    it('spreads the cluster across a wide dock instead of bunching centrally', () => {
        const spans = [];
        for (let step = 0; step < 240; step++) {
            spans.push(
                widthSpanRatio(
                    placementsAt(step * 0.37, DOCK_ASPECT),
                    DOCK_ASPECT
                )
            );
        }

        const mean = spans.reduce((a, b) => a + b, 0) / spans.length;
        expect(mean).toBeGreaterThan(0.4);
        expect(Math.min(...spans)).toBeGreaterThan(0.2);
    });

    it('keeps the cluster inside the canvas', () => {
        for (const time of SAMPLE_TIMES) {
            const orbs = placementsAt(time, DOCK_ASPECT);

            for (const orb of orbs) {
                expect(Math.abs(orb.x)).toBeLessThanOrEqual(DOCK_ASPECT / 2);
            }
        }
    });

    it('sizes orbs to read against the dock height', () => {
        // y spans ±0.5, so radius 0.25 is about half the dock tall. At a peak
        // band the largest orb overflows the strip, which is what makes it read
        // as liquid filling the dock rather than a dot. The upper bound allows
        // for the lead orb on the nearest parallax layer — deliberately the
        // biggest thing in the frame. What stops that becoming a wash is the
        // coverage budget, not this cap.
        for (const time of SAMPLE_TIMES) {
            for (const orb of placementsAt(time, DOCK_ASPECT)) {
                expect(orb.radius).toBeGreaterThan(0.15);
                expect(orb.radius).toBeLessThan(1.05);
            }
        }
    });

    it('scales the spread with the aspect ratio', () => {
        const wide = widthSpanRatio(placementsAt(7, 20), 20);
        const narrow = placementsAt(7, 4);
        const square = placementsAt(7, 1);

        // A wide strip still gets a well-distributed cluster...
        expect(wide).toBeGreaterThan(0.4);
        // ...while a square canvas keeps the original compact orbit.
        const squareExtent = Math.max(...square.map((orb) => Math.abs(orb.x)));
        const narrowExtent = Math.max(...narrow.map((orb) => Math.abs(orb.x)));
        expect(squareExtent).toBeLessThan(narrowExtent);
    });

    it('never blows the orbit up for a degenerate aspect', () => {
        for (const aspect of [0, 0.2, 1]) {
            for (const orb of computeOrbPlacements(3, energyAt(3), aspect)) {
                expect(Number.isFinite(orb.x)).toBe(true);
                expect(Math.abs(orb.x)).toBeLessThanOrEqual(1);
            }
        }
    });

    it('keeps vertical travel inside the dock regardless of width', () => {
        for (const time of SAMPLE_TIMES) {
            for (const orb of placementsAt(time, DOCK_ASPECT)) {
                // Orbit centres stay within the ±0.5 band the shader maps.
                expect(Math.abs(orb.y)).toBeLessThan(0.5);
            }
        }
    });

    // The bar's medium and large presets turn the strip into a stage of
    // roughly 3:1 and 1.4:1. Radii sized for the strip cover most of a canvas
    // that tall, and seven of them then fuse into one flat wash of colour.
    it('shrinks the orbs on the taller dock presets', () => {
        for (const aspect of [3, 1.4]) {
            for (const time of SAMPLE_TIMES) {
                const orbs = computeOrbPlacements(time, energyAt(time), aspect);
                const covered = orbs.reduce(
                    (total, orb) => total + Math.PI * orb.radius * orb.radius,
                    0
                );

                for (const orb of orbs) {
                    // y spans ±0.5, so even the nearest parallax layer stays
                    // under four fifths of the canvas height.
                    expect(orb.radius).toBeLessThan(0.40);
                }
                // The canvas is `aspect` wide by 1 tall in this space. Sized
                // for the strip the orbs covered it three times over; staying
                // under it is what leaves gaps for the blobs to read against.
                expect(covered).toBeLessThan(aspect * 0.8);
            }
        }
    });

    // Before this the whole cluster shared one hue and only shifted with the
    // field, so the orbs read as one mass rather than several bodies fusing.
    it('gives every orb its own hue', () => {
        const hues = placementsAt(0, DOCK_ASPECT).map((orb) => orb.hue);
        const sorted = [...hues].sort((a, b) => a - b);

        expect(new Set(hues).size).toBe(hues.length);
        for (const hue of hues) {
            expect(hue).toBeGreaterThanOrEqual(0);
            expect(hue).toBeLessThan(1);
        }
        // Spaced far enough apart to be told apart at a glance.
        for (let index = 1; index < sorted.length; index++) {
            expect(sorted[index] - sorted[index - 1]).toBeGreaterThan(0.04);
        }
    });

    it('keeps each orb on its own hue as the cluster moves', () => {
        expect(placementsAt(31, DOCK_ASPECT).map((orb) => orb.hue)).toEqual(
            placementsAt(0, DOCK_ASPECT).map((orb) => orb.hue)
        );
    });

    // Without depth layers the seven orbs read as stickers on one flat plane.
    it('spreads the orbs across depth layers', () => {
        const layers = placementsAt(0, DOCK_ASPECT).map((orb) => orb.layer);

        expect(Math.min(...layers)).toBeLessThan(0.2);
        expect(Math.max(...layers)).toBeGreaterThan(0.8);
        for (const layer of layers) {
            expect(layer).toBeGreaterThanOrEqual(0);
            expect(layer).toBeLessThanOrEqual(1);
        }
    });

    // The anchor is the fixed point the rest of the cluster works against, so
    // its stillness is load-bearing rather than incidental.
    it('holds the anchor near the centre while the drifter sweeps the frame', () => {
        const extent = (temperament: string) => {
            let furthest = 0;
            for (const time of SAMPLE_TIMES) {
                for (const orb of placementsAt(time, DOCK_ASPECT)) {
                    if (orb.temperament === temperament) {
                        furthest = Math.max(furthest, Math.abs(orb.x));
                    }
                }
            }
            return furthest;
        };

        expect(extent('anchor')).toBeLessThan(extent('drifter'));
    });

    it('moves the cluster over time', () => {
        const first = placementsAt(0, DOCK_ASPECT);
        const later = placementsAt(9, DOCK_ASPECT);

        expect(later.map((orb) => orb.x)).not.toEqual(
            first.map((orb) => orb.x)
        );
    });

    it('is deterministic for a given time and aspect', () => {
        expect(placementsAt(12.5, DOCK_ASPECT)).toEqual(
            placementsAt(12.5, DOCK_ASPECT)
        );
    });
});

describe('orb temperaments', () => {
    const SWEEP = Array.from({ length: 200 }, (_, step) => step * 0.29);

    function find(orbs: OrbPlacement[], temperament: string): OrbPlacement {
        const orb = orbs.find((candidate) => candidate.temperament === temperament);
        if (!orb) {
            throw new Error(`no ${temperament} orb`);
        }
        return orb;
    }

    function distance(a: OrbPlacement, b: OrbPlacement): number {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /** Closest other orb to the named one, averaged over the sweep. */
    function meanNearestGap(temperament: string): number {
        let total = 0;
        for (const time of SWEEP) {
            const orbs = placementsAt(time, DOCK_ASPECT);
            const self = find(orbs, temperament);
            total += Math.min(
                ...orbs
                    .filter((other) => other !== self)
                    .map((other) => distance(self, other))
            );
        }
        return total / SWEEP.length;
    }

    it('keeps the satellite in orbit around its partner', () => {
        const gaps = SWEEP.map((time) => {
            const orbs = placementsAt(time, DOCK_ASPECT);
            return distance(find(orbs, 'satellite'), find(orbs, 'anchor'));
        });

        // It stays tethered — never wanders off, never lands on top of it.
        expect(Math.max(...gaps)).toBeLessThan(4);
        expect(Math.min(...gaps)).toBeGreaterThan(0.1);
        // ...and it does circle, rather than sitting at a fixed offset.
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.5);
    });

    it('holds the mirror opposite its partner', () => {
        for (const time of SWEEP.slice(0, 40)) {
            const orbs = placementsAt(time, DOCK_ASPECT);
            const mirror = find(orbs, 'mirror');
            const satellite = find(orbs, 'satellite');

            // Reflected through the centre, so the two are never on the same
            // side of the frame at once.
            if (Math.abs(satellite.x) > 0.5) {
                expect(Math.sign(mirror.x)).toBe(-Math.sign(satellite.x));
            }
        }
    });

    it('gives the shy orb more personal space than the clinger', () => {
        expect(meanNearestGap('shy')).toBeGreaterThan(meanNearestGap('clinger'));
    });

    it('pulls the clinger closer than an orb that ignores everyone', () => {
        expect(meanNearestGap('clinger')).toBeLessThan(meanNearestGap('drifter'));
    });

    it('moves only the skittish orb on the beat', () => {
        const bands = energyAt(9).bands;
        const still = computeOrbPlacements(
            9,
            { bands, level: 0.5, pulse: 0 },
            DOCK_ASPECT
        );
        const beat = computeOrbPlacements(
            9,
            { bands, level: 0.5, pulse: 1 },
            DOCK_ASPECT
        );

        const shift = (temperament: string) =>
            distance(find(still, temperament), find(beat, temperament));

        expect(shift('skittish')).toBeGreaterThan(0.15);
        expect(shift('drifter')).toBeLessThan(0.01);
        expect(shift('anchor')).toBeLessThan(0.01);
        // The beat still swells it, on top of the dart.
        expect(find(beat, 'skittish').radius).toBeGreaterThan(
            find(still, 'skittish').radius
        );
    });

    it('gives every orb a temperament and uses each one', () => {
        const used = new Set(
            placementsAt(0, DOCK_ASPECT).map((orb) => orb.temperament)
        );

        expect(used.size).toBe(7);
    });
});
