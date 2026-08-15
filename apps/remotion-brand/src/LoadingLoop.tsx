import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND } from './theme';

const VIEWBOX = 96;
const CENTER = VIEWBOX / 2;

/**
 * Stroke weight carried over from the splash monogram, which draws a 34-unit
 * stroke on a 512 viewBox.
 */
const STROKE_RATIO = 34 / 512;

const OUTER_RADIUS = 34;
const INNER_RADIUS = 22;

/** Visible fraction of each ring, echoing the monogram's open "C" arcs. */
const OUTER_SWEEP = 0.72;
const INNER_SWEEP = 0.52;

/** Glow pulses twice per loop; an integer count keeps the loop seamless. */
const PULSE_CYCLES = 2;

interface RingProps {
    radius: number;
    sweep: number;
    rotation: number;
    color: string;
    opacity: number;
    strokeWidth: number;
}

function Ring({
    radius,
    sweep,
    rotation,
    color,
    opacity,
    strokeWidth,
}: RingProps) {
    const circumference = 2 * Math.PI * radius;
    return (
        <circle
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * sweep} ${circumference}`}
            opacity={opacity}
            transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
        />
    );
}

/**
 * Buffering indicator for the built-in players. Two counter-rotating arcs in
 * the CarbonCast accent, sitting on transparency so the sprite can overlay
 * video directly.
 *
 * Every animated quantity is a whole number of cycles across
 * `durationInFrames`, which is what makes the exported sprite loop without a
 * visible seam.
 */
export const LoadingLoop: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const progress = frame / durationInFrames;

    const strokeWidth = VIEWBOX * STROKE_RATIO;
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * PULSE_CYCLES * progress);

    return (
        <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
            <svg
                viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* The wide bloom behind the arcs is deliberately NOT drawn
                    here: a full-frame soft gradient dominates the sprite's
                    byte cost, and the consumer reproduces it as a scalable CSS
                    radial-gradient on the same 2-cycle rhythm. Only the tight
                    per-stroke glow belongs in the sprite. */}
                <g
                    style={{
                        filter: `drop-shadow(0 0 ${
                            3 + 2 * pulse
                        }px rgba(255, 59, 59, 0.45))`,
                    }}
                >
                    <Ring
                        radius={OUTER_RADIUS}
                        sweep={OUTER_SWEEP}
                        rotation={360 * progress}
                        color={BRAND.accent}
                        opacity={1}
                        strokeWidth={strokeWidth}
                    />
                    <Ring
                        radius={INNER_RADIUS}
                        sweep={INNER_SWEEP}
                        rotation={-360 * progress}
                        color={BRAND.accentWarm}
                        opacity={0.55 + 0.25 * pulse}
                        strokeWidth={strokeWidth * 0.62}
                    />
                </g>
            </svg>
        </AbsoluteFill>
    );
};
