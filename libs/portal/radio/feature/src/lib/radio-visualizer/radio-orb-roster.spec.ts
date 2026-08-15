import { sampleEnergy } from './radio-energy-model';
import { computeOrbPlacements } from './radio-orb-choreography';

/** The player dock is a wide, short strip; this is its realistic shape. */
const DOCK_ASPECT = 1300 / 86;

function energyAt(time: number) {
    return sampleEnergy({ time, isPlaying: true, volume: 1 }, 1);
}

describe('the temperament rota', () => {
    const CYCLE = 23;

    function partsAt(time: number, seed = 0): string[] {
        return computeOrbPlacements(
            time,
            energyAt(time),
            DOCK_ASPECT,
            seed
        ).map((orb) => orb.temperament);
    }

    it('keeps the full ensemble on stage at every moment', () => {
        // There must always be exactly one anchor, or the satellite has
        // nothing to circle and the mirror nothing to sit opposite.
        for (let step = 0; step < 120; step++) {
            const parts = partsAt(step * 3.7);

            expect(new Set(parts).size).toBe(7);
        }
    });

    it('hands the parts on as the cycle turns', () => {
        expect(partsAt(2)).not.toEqual(partsAt(2 + CYCLE));
    });

    it('returns every orb to its opening part after a full rota', () => {
        expect(partsAt(2 + CYCLE * 7)).toEqual(partsAt(2));
    });

    // A part change that moved an orb in one frame would read as a glitch, so
    // the handover crossfades between the outgoing and incoming arrangements.
    // Asserted against the cluster's own settled motion rather than an absolute
    // number: the orbs surge outward on every beat, so "small" is only
    // meaningful relative to what they do the rest of the time.
    it('makes the handover no more abrupt than ordinary motion', () => {
        const largestStepIn = (from: number, to: number) => {
            let largest = 0;
            for (let frame = from * 60; frame < to * 60; frame++) {
                const before = computeOrbPlacements(
                    frame / 60,
                    energyAt(frame / 60),
                    DOCK_ASPECT
                );
                const after = computeOrbPlacements(
                    (frame + 1) / 60,
                    energyAt((frame + 1) / 60),
                    DOCK_ASPECT
                );
                for (let orb = 0; orb < before.length; orb++) {
                    largest = Math.max(
                        largest,
                        Math.hypot(
                            after[orb].x - before[orb].x,
                            after[orb].y - before[orb].y
                        )
                    );
                }
            }
            return largest;
        };

        // The parts change hands over the last six seconds of each cycle.
        const duringHandover = largestStepIn(CYCLE - 6, CYCLE + 1);
        const settled = largestStepIn(2, CYCLE - 7);

        expect(duringHandover).toBeLessThanOrEqual(settled * 1.2);
    });

    it('opens on a different arrangement for a different station', () => {
        expect(partsAt(2, 3)).not.toEqual(partsAt(2, 0));
    });

    it('gives a station the same arrangement every time it plays', () => {
        expect(partsAt(2, 3)).toEqual(partsAt(2, 3));
    });
});

describe('visual hierarchy', () => {
    it('casts one lead, two supporting and four extras', () => {
        const weights = computeOrbPlacements(0, energyAt(0), DOCK_ASPECT)
            .map((orb) => orb.prominence)
            .sort((a, b) => b - a);

        expect(weights[0]).toBe(1);
        expect(weights.filter((weight) => weight === 0.6)).toHaveLength(2);
        expect(weights.filter((weight) => weight === 0.3)).toHaveLength(4);
    });

    it('keeps the lead the lead however the parts rotate', () => {
        // Prominence belongs to the orb, not to the part it is playing, so the
        // eye keeps landing in the same place while behaviour changes around it.
        for (const time of [0, 30, 90, 200]) {
            const orbs = computeOrbPlacements(time, energyAt(time), DOCK_ASPECT);

            expect(orbs[0].prominence).toBe(1);
        }
    });

    it('makes the lead visibly larger than the extras on the same path', () => {
        // Same energy for every band, so only prominence and depth differ.
        const flat = { bands: new Array(7).fill(0.5), level: 0.5, pulse: 0 };
        const orbs = computeOrbPlacements(0, flat, DOCK_ASPECT);
        const lead = orbs[0];
        const extras = orbs.filter((orb) => orb.prominence === 0.3);

        for (const extra of extras) {
            expect(lead.radius).toBeGreaterThan(extra.radius);
        }
    });
});
