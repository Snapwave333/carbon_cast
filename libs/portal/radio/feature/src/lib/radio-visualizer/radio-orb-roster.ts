/**
 * Who is playing which part, and when they swap.
 *
 * The seven temperaments are a fixed ensemble: at any moment every one of them
 * is in play, and the orbs rotate through the parts. That keeps the cluster
 * balanced — there is always exactly one anchor for the satellite to circle —
 * while stopping any single blob from behaving the same way for the whole
 * session.
 *
 * Rotation is derived from `time` rather than tracked, so the choreography
 * stays a pure function and survives the frame loop parking and resuming.
 * "How long has this orb been the anchor" would be state; "which rotation does
 * this timestamp fall in" is arithmetic.
 */

/** How each orb behaves towards the others. */
export type OrbTemperament =
    /** Holds the centre and barely drifts. The cluster orbits around it. */
    | 'anchor'
    /** Circles its partner instead of following a path of its own. */
    | 'satellite'
    /** Shoved aside by anything that comes close, and shrinks when crowded. */
    | 'shy'
    /** Drawn towards whichever orb is nearest, swelling as it closes in. */
    | 'clinger'
    /** Bolts on the beat and pops in size with it. */
    | 'skittish'
    /** Sits opposite its partner, mirrored through the centre. */
    | 'mirror'
    /** Ignores everyone. Without one the cluster feels uniformly reactive. */
    | 'drifter';

/**
 * Order matters: rotating this list by one is what reassigns the parts, so
 * neighbouring entries are the roles each orb moves between.
 */
export const ORB_TEMPERAMENTS: readonly OrbTemperament[] = [
    'anchor',
    'satellite',
    'shy',
    'clinger',
    'skittish',
    'drifter',
    'mirror',
];

/**
 * Resolution order, not rotation order. `satellite` reads the resolved anchor
 * and `mirror` reads the resolved satellite, so those two have to come last;
 * everything else works off unresolved base positions and is order-free.
 */
export const TEMPERAMENT_RESOLVE_ORDER: readonly OrbTemperament[] = [
    'anchor',
    'shy',
    'clinger',
    'skittish',
    'drifter',
    'satellite',
    'mirror',
];

/** Long enough that a part reads as that orb's character, not as churn. */
const ROLE_CYCLE_SECONDS = 23;
/** The handover. Long enough that an orb changing part is never seen to jump. */
const ROLE_BLEND_SECONDS = 6;

export interface RosterPhase {
    /** Assignment in force for most of the cycle. */
    rotation: number;
    /** The one being handed over to, equal to `rotation` outside a handover. */
    nextRotation: number;
    /** 0 while settled, easing to 1 across the handover. */
    blend: number;
}

function smoothstep(edge: number): number {
    const t = edge < 0 ? 0 : edge > 1 ? 1 : edge;
    return t * t * (3 - 2 * t);
}

export function rosterAt(time: number): RosterPhase {
    const cycles = time / ROLE_CYCLE_SECONDS;
    const rotation = Math.floor(cycles);
    const elapsed = (cycles - rotation) * ROLE_CYCLE_SECONDS;
    const handoverStarts = ROLE_CYCLE_SECONDS - ROLE_BLEND_SECONDS;

    if (elapsed < handoverStarts) {
        return { rotation, nextRotation: rotation, blend: 0 };
    }

    return {
        rotation,
        nextRotation: rotation + 1,
        blend: smoothstep((elapsed - handoverStarts) / ROLE_BLEND_SECONDS),
    };
}

/**
 * The part orb `index` plays in a given rotation. `seed` is per-station, so two
 * stations open on different arrangements rather than every session starting
 * with the same blob at the centre.
 */
export function temperamentFor(
    index: number,
    rotation: number,
    seed: number
): OrbTemperament {
    const count = ORB_TEMPERAMENTS.length;
    const offset = ((index + rotation + seed) % count + count) % count;
    return ORB_TEMPERAMENTS[offset];
}

/** Index of the orb currently playing `temperament`, or -1. */
export function orbPlaying(
    assignment: readonly OrbTemperament[],
    temperament: OrbTemperament
): number {
    return assignment.indexOf(temperament);
}
