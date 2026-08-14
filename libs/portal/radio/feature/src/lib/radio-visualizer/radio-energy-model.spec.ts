import {
    advanceEnvelope,
    ENERGY_BAND_COUNT,
    sampleEnergy,
} from './radio-energy-model';

const PLAYING = { time: 0, isPlaying: true, volume: 1 };
const PAUSED = { time: 0, isPlaying: false, volume: 1 };

describe('advanceEnvelope', () => {
    it('rises towards full while playing', () => {
        let envelope = 0;
        for (let step = 0; step < 60; step++) {
            envelope = advanceEnvelope(envelope, PLAYING, 1 / 60);
        }

        expect(envelope).toBeGreaterThan(0.75);
        expect(envelope).toBeLessThanOrEqual(1);
    });

    it('settles back towards zero once paused', () => {
        let envelope = 1;
        const decayTo = (seconds: number) => {
            for (let step = 0; step < seconds * 60; step++) {
                envelope = advanceEnvelope(envelope, PAUSED, 1 / 60);
            }
            return envelope;
        };

        expect(decayTo(5)).toBeLessThan(0.05);
        expect(decayTo(5)).toBeLessThan(0.005);
    });

    it('targets a lower ceiling at low volume', () => {
        let loud = 0;
        let quiet = 0;
        for (let step = 0; step < 120; step++) {
            loud = advanceEnvelope(loud, PLAYING, 1 / 60);
            quiet = advanceEnvelope(
                quiet,
                { ...PLAYING, volume: 0 },
                1 / 60
            );
        }

        expect(quiet).toBeLessThan(loud);
    });

    it('never overshoots its target', () => {
        expect(advanceEnvelope(0, PLAYING, 10)).toBeLessThanOrEqual(1);
        expect(advanceEnvelope(1, PAUSED, 10)).toBeGreaterThanOrEqual(0);
    });
});

describe('sampleEnergy', () => {
    it('returns one level per band, all within 0-1', () => {
        for (let step = 0; step < 200; step++) {
            const frame = sampleEnergy(
                { ...PLAYING, time: step * 0.05 },
                1
            );

            expect(frame.bands).toHaveLength(ENERGY_BAND_COUNT);
            for (const band of frame.bands) {
                expect(band).toBeGreaterThanOrEqual(0);
                expect(band).toBeLessThanOrEqual(1);
            }
            expect(frame.level).toBeGreaterThanOrEqual(0);
            expect(frame.level).toBeLessThanOrEqual(1);
        }
    });

    it('is deterministic for a given time', () => {
        const first = sampleEnergy({ ...PLAYING, time: 12.5 }, 0.8);
        const second = sampleEnergy({ ...PLAYING, time: 12.5 }, 0.8);

        expect(first).toEqual(second);
    });

    it('collapses to a faint idle level at zero envelope', () => {
        const frame = sampleEnergy({ ...PAUSED, time: 40 }, 0);

        expect(frame.pulse).toBe(0);
        for (const band of frame.bands) {
            expect(band).toBeCloseTo(0.16, 5);
        }
    });

    it('moves more at full envelope than at rest', () => {
        const spread = (envelope: number) => {
            let min = 1;
            let max = 0;
            for (let step = 0; step < 400; step++) {
                const { level } = sampleEnergy(
                    { ...PLAYING, time: step * 0.07 },
                    envelope
                );
                min = Math.min(min, level);
                max = Math.max(max, level);
            }
            return max - min;
        };

        expect(spread(1)).toBeGreaterThan(spread(0.2));
    });

    it('does not repeat over a long window', () => {
        const first = sampleEnergy({ ...PLAYING, time: 3 }, 1);
        const later = sampleEnergy({ ...PLAYING, time: 3 + 60 }, 1);

        expect(later.bands).not.toEqual(first.bands);
    });

    it('gives the low bands more of the beat than the high bands', () => {
        // Sampled right on a pulse, where the weighting is most visible.
        const frame = sampleEnergy({ ...PLAYING, time: 0 }, 1);

        expect(frame.bands[0]).toBeGreaterThan(
            frame.bands[ENERGY_BAND_COUNT - 1]
        );
        expect(frame.pulse).toBeGreaterThan(0);
    });
});
