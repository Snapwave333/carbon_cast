import { EnergyFrame } from './radio-energy-model';
import {
    ANCHOR_TRAVEL,
    applyTemperament,
    Placed,
} from './radio-orb-behaviours';
import {
    OrbTemperament,
    rosterAt,
    TEMPERAMENT_RESOLVE_ORDER,
    temperamentFor,
} from './radio-orb-roster';

/**
 * Where the orbs go, and how they behave towards one another.
 *
 * Each orb rides its own Lissajous path, but a set of independent curves reads
 * as seven objects that happen to share a canvas. What makes the cluster look
 * alive is that they notice each other: one hangs back as the anchor, two circle
 * it from opposite sides, one keeps its distance from whatever approaches, one
 * chases its nearest neighbour, one bolts on the beat, and one ignores the lot.
 * Which orb plays which part rotates over time — see `radio-orb-roster.ts`.
 *
 * The whole thing stays a pure function of `time`. Interaction is a single
 * relaxation pass — every orb's base path is evaluated first, then each one is
 * displaced according to the others' *base* positions — rather than an
 * integrated simulation. That matters for more than testability: the frame loop
 * parks itself when playback stops and resumes later, and a stateful simulation
 * would either lurch on resume or have to be kept running to stay correct.
 */

/**
 * The player dock is a wide, short strip — around 15:1. The orbit paths below
 * are written in the shader's aspect-corrected space, where y spans ±0.5 and x
 * spans ±aspect/2, so without correction the whole cluster collapses into a
 * pinprick at the centre of the strip and disappears behind the transport
 * controls. Orbit width is therefore biased toward the canvas aspect, and the
 * radii scaled to the short edge, so the blobs read at dock height and travel
 * the full width.
 */
const ORB_SPREAD_ASPECT_BIAS = 0.6;
const ORB_RADIUS_SCALE = 2.8;
/**
 * Radii are expressed against the short edge, so the scale that makes an orb
 * read at strip height turns the same orb into two thirds of the canvas once
 * the bar is expanded to a 40vh or 75vh stage — seven of those merge into one
 * flat wash of colour. The scale therefore ramps with the aspect ratio and only
 * reaches `ORB_RADIUS_SCALE` on a dock-shaped strip.
 */
const ORB_RADIUS_BASE_SCALE = 0.79;
const ORB_RADIUS_ASPECT_BIAS = 0.15;

/**
 * Each orb carries its own hue so the cluster reads as several coloured bodies
 * fusing rather than one mass that changes colour as a whole. The offsets are
 * spaced by the golden ratio instead of evenly, which keeps orbs that happen to
 * drift next to each other far apart on the wheel, and scaled by a spread under
 * a full revolution so the result is a palette rather than a rainbow.
 */
const ORB_HUE_SPREAD = 0.62;
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;

/** Parallax strength. Both ranges are centred on 1 at the middle layer. */
const PARALLAX_TRAVEL_MIN = 0.74;
const PARALLAX_TRAVEL_RANGE = 0.52;
const PARALLAX_BULK_MIN = 0.78;
const PARALLAX_BULK_RANGE = 0.44;

/**
 * Size hierarchy. Seven blobs of equal weight give the eye nowhere to land, so
 * the cast is one lead, two supporting and four extras. The floor is chosen so
 * the mean multiplier lands on 1: the hierarchy redistributes area rather than
 * adding it, which keeps the coverage budget the tall presets depend on.
 */
const PROMINENCE_FLOOR = 0.78;
const PROMINENCE_GAIN = 0.45;

interface OrbPath {
    /** Lissajous rates; incommensurate pairs keep the paths from repeating. */
    rateX: number;
    rateY: number;
    phase: number;
    spreadX: number;
    spreadY: number;
    baseRadius: number;
    /**
     * Where the orb sits in depth, 0 far and 1 near. Near orbs are larger,
     * travel further and are lit more strongly; far ones hang back, desaturated
     * the way distance desaturates anything seen through air. Without this the
     * whole cluster reads as stickers on one flat plane.
     */
    layer: number;
    /**
     * Visual weight, 0 extra and 1 lead. Unlike the temperament this belongs to
     * the orb permanently, so the lead stays the lead while its behaviour
     * changes around it.
     */
    prominence: number;
}

const ORB_PATHS: readonly OrbPath[] = [
    { rateX: 0.21, rateY: 0.29, phase: 0.0, spreadX: 0.34, spreadY: 0.2, baseRadius: 0.15, layer: 1.0, prominence: 1 },
    { rateX: 0.27, rateY: 0.19, phase: 1.3, spreadX: 0.42, spreadY: 0.16, baseRadius: 0.13, layer: 0.45, prominence: 0.3 },
    { rateX: 0.16, rateY: 0.35, phase: 2.6, spreadX: 0.28, spreadY: 0.24, baseRadius: 0.12, layer: 0.75, prominence: 0.6 },
    { rateX: 0.33, rateY: 0.23, phase: 3.9, spreadX: 0.46, spreadY: 0.18, baseRadius: 0.11, layer: 0.15, prominence: 0.3 },
    { rateX: 0.19, rateY: 0.41, phase: 5.1, spreadX: 0.36, spreadY: 0.22, baseRadius: 0.1, layer: 0.6, prominence: 0.3 },
    { rateX: 0.37, rateY: 0.26, phase: 0.7, spreadX: 0.5, spreadY: 0.14, baseRadius: 0.09, layer: 0.0, prominence: 0.3 },
    { rateX: 0.13, rateY: 0.31, phase: 4.4, spreadX: 0.22, spreadY: 0.26, baseRadius: 0.14, layer: 0.85, prominence: 0.6 },
];

export interface OrbPlacement {
    /** Centre in the shader's aspect-corrected space (y spans ±0.5). */
    x: number;
    y: number;
    radius: number;
    /** Hue offset in 0-1 revolutions, added to the visualizer's base hue. */
    hue: number;
    /** Depth layer, 0 far and 1 near. Drives the shader's lighting falloff. */
    layer: number;
    /** Visual weight, 0 extra and 1 lead. */
    prominence: number;
    /** The part this orb is playing, once any handover has settled. */
    temperament: OrbTemperament;
}

interface StageMetrics {
    spread: number;
    radiusScale: number;
    boundX: number;
}

function fractional(value: number): number {
    return value - Math.floor(value);
}

function clamp(value: number, limit: number): number {
    return value < -limit ? -limit : value > limit ? limit : value;
}

function orbHue(index: number): number {
    return fractional(index * GOLDEN_RATIO_CONJUGATE) * ORB_HUE_SPREAD;
}

/** The orb's own path, before it has taken any notice of its neighbours. */
function basePlacement(
    path: OrbPath,
    time: number,
    band: number,
    pulse: number,
    isAnchor: boolean,
    stage: StageMetrics
): Placed {
    // Louder bands push their orb outward, so the cluster breathes apart and
    // fuses back together instead of just pulsing in place.
    const reach = 1 + band * 0.45;
    // Parallax: a near orb sweeps further across the frame than a far one on
    // the same path. Both multipliers average to 1 over the layers, so the
    // cluster keeps the extent it was tuned to.
    const travel =
        (PARALLAX_TRAVEL_MIN + path.layer * PARALLAX_TRAVEL_RANGE) *
        (isAnchor ? ANCHOR_TRAVEL : 1);
    const bulk = PARALLAX_BULK_MIN + path.layer * PARALLAX_BULK_RANGE;

    return {
        x:
            Math.cos(time * path.rateX + path.phase) *
            path.spreadX *
            reach *
            stage.spread *
            travel,
        y:
            Math.sin(time * path.rateY + path.phase * 1.7) *
            path.spreadY *
            reach *
            travel,
        radius:
            path.baseRadius *
            (0.68 + band * 0.7 + pulse * 0.22) *
            stage.radiusScale *
            bulk *
            (PROMINENCE_FLOOR + path.prominence * PROMINENCE_GAIN),
    };
}

/** Places every orb for one rotation of the roster. */
function placeRoster(
    time: number,
    energy: EnergyFrame,
    stage: StageMetrics,
    assignment: readonly OrbTemperament[]
): Placed[] {
    const bases = ORB_PATHS.map((path, index) =>
        basePlacement(
            path,
            time,
            energy.bands[index] ?? 0,
            energy.pulse,
            assignment[index] === 'anchor',
            stage
        )
    );

    const placed: Placed[] = bases.map((base) => ({ ...base }));

    // Resolved in role order, not index order: a satellite reads the anchor's
    // resolved position and a mirror reads the satellite's, so a mirror sits
    // opposite where the satellite actually is rather than opposite the path it
    // abandoned. The order is acyclic, so one pass suffices.
    for (const role of TEMPERAMENT_RESOLVE_ORDER) {
        for (let index = 0; index < ORB_PATHS.length; index++) {
            if (assignment[index] !== role) {
                continue;
            }

            applyTemperament(role, {
                index,
                time,
                pathPhase: ORB_PATHS[index].phase,
                pulse: energy.pulse,
                bases,
                placed,
                assignment,
                spread: stage.spread,
            });
        }
    }

    return placed.map((orb) => ({
        x: clamp(orb.x, stage.boundX),
        y: clamp(orb.y, 0.48),
        radius: orb.radius,
    }));
}

function assignmentFor(
    rotation: number,
    seed: number
): readonly OrbTemperament[] {
    return ORB_PATHS.map((_, index) => temperamentFor(index, rotation, seed));
}

/**
 * Places the orbs for one frame. Split out from the GL calls so the geometry
 * that decides whether the blobs are visible at all can be asserted directly.
 *
 * `seed` is the station's identity, so two stations open on different
 * arrangements instead of every session starting the same way.
 */
export function computeOrbPlacements(
    time: number,
    energy: EnergyFrame,
    aspect: number,
    seed = 0
): OrbPlacement[] {
    const wideness = Math.max(1, aspect) - 1;
    const stage: StageMetrics = {
        spread: 1 + wideness * ORB_SPREAD_ASPECT_BIAS,
        radiusScale: Math.min(
            ORB_RADIUS_SCALE,
            ORB_RADIUS_BASE_SCALE + wideness * ORB_RADIUS_ASPECT_BIAS
        ),
        // Nothing may travel so far that it leaves the canvas. The lower bound
        // keeps a near-square canvas — which has no width to spare — from
        // letting an interaction push an orb off the side.
        boundX: Math.max(0.9, aspect / 2),
    };

    const phase = rosterAt(time);
    const assignment = assignmentFor(phase.rotation, seed);
    const current = placeRoster(time, energy, stage, assignment);

    // Outside a handover the second roster is the same as the first, so it is
    // only paid for while the parts are actually changing hands.
    const handingOver = phase.blend > 0;
    const nextAssignment = handingOver
        ? assignmentFor(phase.nextRotation, seed)
        : assignment;
    const next = handingOver
        ? placeRoster(time, energy, stage, nextAssignment)
        : current;

    return ORB_PATHS.map((path, index) => ({
        x: mix(current[index].x, next[index].x, phase.blend),
        y: mix(current[index].y, next[index].y, phase.blend),
        radius: mix(current[index].radius, next[index].radius, phase.blend),
        hue: orbHue(index),
        layer: path.layer,
        prominence: path.prominence,
        // Reported as the part being handed to once the handover is more than
        // half done, so callers never see a role the orb has already left.
        temperament:
            phase.blend > 0.5 ? nextAssignment[index] : assignment[index],
    }));
}

function mix(from: number, to: number, amount: number): number {
    return from + (to - from) * amount;
}
