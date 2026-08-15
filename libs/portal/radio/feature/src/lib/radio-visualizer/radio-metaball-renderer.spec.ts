import { computeDrawingBufferSize } from './radio-metaball-renderer';

describe('computeDrawingBufferSize', () => {
    const BUDGET = 1_600_000;

    it('renders the compact strip at full device resolution', () => {
        expect(computeDrawingBufferSize(1300, 86, 2)).toEqual({
            width: 2600,
            height: 172,
        });
    });

    it('never exceeds 2x, however dense the display', () => {
        const { width } = computeDrawingBufferSize(400, 100, 4);

        expect(width).toBe(800);
    });

    // The tall presets are ~30x the area of the strip, and every pixel costs
    // five evaluations of a seven-orb field. Without a budget the large dock
    // fills several million pixels a frame for detail the 7px blur removes.
    it('caps the tall presets to the fill budget', () => {
        const large = computeDrawingBufferSize(2560, 1200, 2);

        expect(large.width * large.height).toBeLessThanOrEqual(BUDGET);
        // The aspect ratio has to survive the downscale, or the orbits — which
        // are laid out in aspect-corrected space — would be placed wrongly.
        expect(large.width / large.height).toBeCloseTo(2560 / 1200, 2);
    });

    it('stays at least one pixel for a collapsed canvas', () => {
        expect(computeDrawingBufferSize(0, 0, 2)).toEqual({
            width: 1,
            height: 1,
        });
    });
});
