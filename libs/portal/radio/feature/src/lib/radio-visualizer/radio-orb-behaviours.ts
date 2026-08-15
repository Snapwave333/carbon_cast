import { OrbTemperament } from './radio-orb-roster';

/**
 * What each temperament actually does to an orb's placement.
 *
 * Every rule here has to be continuous in time. An orb that jumps between two
 * frames reads as a glitch however good the reason, which rules out anything
 * that switches on a hard comparison — see `weightedNeighbour` below.
 */

/** The anchor's path is scaled right down; it is the thing others move around. */
export const ANCHOR_TRAVEL = 0.3;
/** Orbit of a satellite around its partner, in aspect-corrected units. */
const SATELLITE_ORBIT_X = 0.3;
const SATELLITE_ORBIT_Y = 0.22;
const SATELLITE_RATE = 0.46;
/** Repulsion felt by a `shy` orb, and the range over which it acts. */
const SHY_STRENGTH = 0.35;
const SHY_RANGE = 0.75;
const SHY_MAX_PUSH = 0.34;
/**
 * Softening on the repulsion's denominator. Dividing by the raw distance makes
 * the push steepen without bound as a neighbour closes in, and the orb snaps
 * aside rather than flinching; this caps how fast the push can change.
 */
const SHY_SOFTENING = 0.15;
/** How far a `clinger` closes the gap to the neighbour it is chasing. */
const CLINGER_PULL = 0.42;
/**
 * Sharpness of the clinger's choice of target. Higher is closer to "the single
 * nearest orb"; it must stay finite so the choice stays continuous.
 */
const CLINGER_FOCUS = 4;
/** Displacement a `skittish` orb bolts by, at full pulse. */
const SKITTISH_DART = 0.26;
/** A `mirror` sits this far through the centre from its partner. */
const MIRROR_REFLECTION = 0.9;

export interface Placed {
    x: number;
    y: number;
    radius: number;
}

export interface BehaviourContext {
    index: number;
    time: number;
    /** The orb's own path phase, so its behaviour is offset from its peers'. */
    pathPhase: number;
    pulse: number;
    /** Unresolved paths — read by rules that treat the others as a field. */
    bases: Placed[];
    /** Resolved so far — read by rules that follow a specific partner. */
    placed: Placed[];
    assignment: readonly OrbTemperament[];
    spread: number;
}

function clamp(value: number, limit: number): number {
    return value < -limit ? -limit : value > limit ? limit : value;
}

/**
 * A soft "nearest neighbour": every other orb pulls, weighted steeply by
 * proximity, so the closest one dominates without ever *being* a choice.
 *
 * Picking the single nearest orb outright is the obvious implementation and it
 * teleports the clinger: the moment two candidates are equidistant the target
 * flips to the other side of the frame and the orb jumps with it.
 */
function weightedNeighbour(bases: Placed[], index: number): {
    x: number;
    y: number;
    gap: number;
} {
    let x = 0;
    let y = 0;
    let total = 0;
    let nearest = Infinity;

    for (let other = 0; other < bases.length; other++) {
        if (other === index) {
            continue;
        }
        const distance = Math.hypot(
            bases[other].x - bases[index].x,
            bases[other].y - bases[index].y
        );
        const weight = 1 / (Math.pow(distance, CLINGER_FOCUS) + 1e-4);
        x += bases[other].x * weight;
        y += bases[other].y * weight;
        total += weight;
        nearest = Math.min(nearest, distance);
    }

    return { x: x / total, y: y / total, gap: nearest };
}

/** Net push a `shy` orb feels from everything crowding it. */
function repulsion(
    bases: Placed[],
    index: number
): { x: number; y: number; crowding: number } {
    let x = 0;
    let y = 0;
    let crowding = 0;

    for (let other = 0; other < bases.length; other++) {
        if (other === index) {
            continue;
        }
        const dx = bases[index].x - bases[other].x;
        const dy = bases[index].y - bases[other].y;
        const distance = Math.hypot(dx, dy);
        if (distance >= SHY_RANGE) {
            continue;
        }

        // Smoothstepped so the push eases in as a neighbour enters range
        // instead of switching on at the boundary.
        const approach = (SHY_RANGE - distance) / SHY_RANGE;
        const falloff = approach * approach * (3 - 2 * approach);
        const scale = (SHY_STRENGTH * falloff) / (distance + SHY_SOFTENING);
        x += dx * scale;
        y += dy * scale;
        crowding += approach;
    }

    return { x: clamp(x, SHY_MAX_PUSH), y: clamp(y, SHY_MAX_PUSH), crowding };
}

/** Displaces `context.placed[context.index]` according to the part it plays. */
export function applyTemperament(
    role: OrbTemperament,
    context: BehaviourContext
): void {
    const { index, bases, placed, time } = context;
    const base = bases[index];
    const self = placed[index];

    switch (role) {
        case 'satellite': {
            const partner = placed[context.assignment.indexOf('anchor')];
            const angle = time * SATELLITE_RATE + context.pathPhase;
            self.x =
                partner.x + Math.cos(angle) * SATELLITE_ORBIT_X * context.spread;
            self.y = partner.y + Math.sin(angle) * SATELLITE_ORBIT_Y;
            break;
        }
        case 'mirror': {
            const partner = placed[context.assignment.indexOf('satellite')];
            self.x = -partner.x * MIRROR_REFLECTION;
            self.y = -partner.y * MIRROR_REFLECTION;
            break;
        }
        case 'shy': {
            const push = repulsion(bases, index);
            self.x += push.x;
            self.y += push.y;
            // Pulls itself in when hemmed in, which reads as flinching.
            self.radius *= 1 - Math.min(0.3, push.crowding * 0.22);
            break;
        }
        case 'clinger': {
            const target = weightedNeighbour(bases, index);
            self.x += (target.x - base.x) * CLINGER_PULL;
            self.y += (target.y - base.y) * CLINGER_PULL;
            // Swells as it closes, so the merge is something it does rather
            // than something that happens to it.
            self.radius *= 1 + 0.28 * Math.max(0, 1 - target.gap);
            break;
        }
        case 'skittish': {
            self.x +=
                Math.cos(time * 3.1 + context.pathPhase) *
                SKITTISH_DART *
                context.pulse;
            self.y +=
                Math.sin(time * 2.7 + context.pathPhase) *
                SKITTISH_DART *
                context.pulse;
            self.radius *= 1 + context.pulse * 0.45;
            break;
        }
        case 'anchor':
        case 'drifter':
            break;
    }
}
