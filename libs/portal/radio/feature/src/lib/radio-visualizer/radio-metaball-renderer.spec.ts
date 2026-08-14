import { sampleEnergy } from './radio-energy-model';
import { computeOrbPlacements, OrbPlacement } from './radio-metaball-renderer';

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
    // — hidden behind the transport controls and effectively invisible.
    it('spreads the cluster across a wide dock instead of bunching centrally', () => {
        for (const time of SAMPLE_TIMES) {
            const orbs = placementsAt(time, DOCK_ASPECT);

            // The unscaled orbit spanned ~7% of the dock width; anything in
            // this range is unambiguously the distributed cluster.
            expect(widthSpanRatio(orbs, DOCK_ASPECT)).toBeGreaterThan(0.35);
        }
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
        // band the largest orb reaches ~0.67 and overflows the strip, which is
        // what makes it read as liquid filling the dock rather than a dot.
        for (const time of SAMPLE_TIMES) {
            for (const orb of placementsAt(time, DOCK_ASPECT)) {
                expect(orb.radius).toBeGreaterThan(0.15);
                expect(orb.radius).toBeLessThan(0.75);
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
