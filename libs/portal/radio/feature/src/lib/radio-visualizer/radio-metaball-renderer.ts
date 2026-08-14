import { ENERGY_BAND_COUNT, EnergyFrame } from './radio-energy-model';

/**
 * Renders the player's liquid-metaball backdrop.
 *
 * Metaballs are an implicit surface: every orb contributes a falloff field,
 * the fields sum, and the surface is wherever the sum crosses a threshold.
 * Neighbouring orbs therefore bulge towards each other and fuse into one body
 * instead of overlapping as discs — the "liquid" read. Evaluating that sum is
 * per-pixel work, so it runs in a fragment shader; at 4K that is a few million
 * field evaluations a frame, which is trivial for a GPU and impossible on the
 * CPU.
 */

const ORB_COUNT = ENERGY_BAND_COUNT;
/** Above 2x the extra pixels are invisible but the fill cost is not. */
const MAX_PIXEL_RATIO = 2;

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

const VERTEX_SHADER = `#version 300 es
// One oversized triangle covers the viewport with no vertex buffer.
void main() {
    vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uHue;
uniform float uLevel;
uniform vec3 uOrbs[${ORB_COUNT}];

out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Inverse-square falloff: unbounded near the centre, so the threshold
// crossing between two orbs snaps together into a neck as they approach.
float field(vec2 p) {
    float sum = 0.0;
    for (int i = 0; i < ${ORB_COUNT}; i++) {
        vec2 delta = p - uOrbs[i].xy;
        float radius = uOrbs[i].z;
        sum += (radius * radius) / (dot(delta, delta) + 0.0004);
    }
    return sum;
}

void main() {
    // Aspect-corrected so orbs stay round in a wide dock.
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = vec2((uv.x - 0.5) * (uResolution.x / uResolution.y), uv.y - 0.5);

    float f = field(p);

    // Central difference on the field stands in for a surface normal, which
    // is what gives the blobs their wet, rounded shading.
    float eps = 1.6 / uResolution.y;
    vec2 gradient = vec2(
        field(p + vec2(eps, 0.0)) - field(p - vec2(eps, 0.0)),
        field(p + vec2(0.0, eps)) - field(p - vec2(0.0, eps))
    );
    vec3 normal = normalize(vec3(gradient * 0.06, 1.0));

    float body = smoothstep(0.85, 1.35, f);
    float halo = smoothstep(0.18, 0.95, f);
    float rim = smoothstep(1.9, 1.05, f) * body;

    // Hue travels with the field, so the fused necks between orbs read as a
    // different colour from their cores and the merge stays legible.
    float hue = fract(uHue + f * 0.045 + normal.x * 0.06);
    vec3 core = hsv2rgb(vec3(hue, 0.62 - uLevel * 0.16, 0.62 + uLevel * 0.38));
    vec3 edge = hsv2rgb(vec3(fract(hue + 0.11), 0.85, 0.95));

    float specular = pow(max(normal.z, 0.0), 18.0) * body * 0.35;
    vec3 color = mix(core, edge, rim * 0.75) + specular;

    float alpha = clamp(halo * 0.35 + body * 0.85, 0.0, 1.0);
    fragColor = vec4(color * alpha, alpha);
}`;

interface OrbPath {
    /** Lissajous rates; incommensurate pairs keep the paths from repeating. */
    rateX: number;
    rateY: number;
    phase: number;
    spreadX: number;
    spreadY: number;
    baseRadius: number;
}

const ORB_PATHS: readonly OrbPath[] = [
    { rateX: 0.21, rateY: 0.29, phase: 0.0, spreadX: 0.34, spreadY: 0.2, baseRadius: 0.15 },
    { rateX: 0.27, rateY: 0.19, phase: 1.3, spreadX: 0.42, spreadY: 0.16, baseRadius: 0.13 },
    { rateX: 0.16, rateY: 0.35, phase: 2.6, spreadX: 0.28, spreadY: 0.24, baseRadius: 0.12 },
    { rateX: 0.33, rateY: 0.23, phase: 3.9, spreadX: 0.46, spreadY: 0.18, baseRadius: 0.11 },
    { rateX: 0.19, rateY: 0.41, phase: 5.1, spreadX: 0.36, spreadY: 0.22, baseRadius: 0.1 },
    { rateX: 0.37, rateY: 0.26, phase: 0.7, spreadX: 0.5, spreadY: 0.14, baseRadius: 0.09 },
    { rateX: 0.13, rateY: 0.31, phase: 4.4, spreadX: 0.22, spreadY: 0.26, baseRadius: 0.14 },
];

export interface OrbPlacement {
    /** Centre in the shader's aspect-corrected space (y spans ±0.5). */
    x: number;
    y: number;
    radius: number;
}

/**
 * Places the orbs for one frame. Split out from the GL calls so the geometry
 * that decides whether the blobs are visible at all can be asserted directly.
 */
export function computeOrbPlacements(
    time: number,
    energy: EnergyFrame,
    aspect: number
): OrbPlacement[] {
    const spread = 1 + (Math.max(1, aspect) - 1) * ORB_SPREAD_ASPECT_BIAS;

    return ORB_PATHS.map((path, index) => {
        const band = energy.bands[index] ?? 0;
        // Louder bands push their orb outward, so the cluster breathes apart
        // and fuses back together instead of just pulsing in place.
        const reach = 1 + band * 0.45;

        return {
            x:
                Math.cos(time * path.rateX + path.phase) *
                path.spreadX *
                reach *
                spread,
            y:
                Math.sin(time * path.rateY + path.phase * 1.7) *
                path.spreadY *
                reach,
            radius:
                path.baseRadius *
                (0.68 + band * 0.7 + energy.pulse * 0.22) *
                ORB_RADIUS_SCALE,
        };
    });
}

export class RadioMetaballRenderer {
    private readonly gl: WebGL2RenderingContext;
    private readonly program: WebGLProgram;
    private readonly uniforms: {
        resolution: WebGLUniformLocation | null;
        time: WebGLUniformLocation | null;
        hue: WebGLUniformLocation | null;
        level: WebGLUniformLocation | null;
        orbs: WebGLUniformLocation | null;
    };
    private readonly orbData = new Float32Array(ORB_COUNT * 3);

    private constructor(
        private readonly canvas: HTMLCanvasElement,
        gl: WebGL2RenderingContext,
        program: WebGLProgram
    ) {
        this.gl = gl;
        this.program = program;
        this.uniforms = {
            resolution: gl.getUniformLocation(program, 'uResolution'),
            time: gl.getUniformLocation(program, 'uTime'),
            hue: gl.getUniformLocation(program, 'uHue'),
            level: gl.getUniformLocation(program, 'uLevel'),
            orbs: gl.getUniformLocation(program, 'uOrbs'),
        };

        gl.useProgram(program);
        gl.enable(gl.BLEND);
        // Premultiplied alpha: the shader already scales colour by alpha, so
        // the blobs composite over the dock without a dark fringe.
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** Returns null when WebGL2 is unavailable; the caller then hides the canvas. */
    static create(canvas: HTMLCanvasElement): RadioMetaballRenderer | null {
        const gl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
            powerPreference: 'low-power',
        });
        if (!gl) {
            return null;
        }

        const program = linkProgram(gl);
        return program ? new RadioMetaballRenderer(canvas, gl, program) : null;
    }

    /** Matches the drawing buffer to the element's on-screen pixel size. */
    resize(): void {
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const width = Math.max(
            1,
            Math.round(this.canvas.clientWidth * ratio)
        );
        const height = Math.max(
            1,
            Math.round(this.canvas.clientHeight * ratio)
        );

        if (this.canvas.width === width && this.canvas.height === height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    render(time: number, hue: number, energy: EnergyFrame): void {
        const gl = this.gl;
        this.resize();

        const placements = computeOrbPlacements(
            time,
            energy,
            this.canvas.width / Math.max(1, this.canvas.height)
        );

        for (let index = 0; index < ORB_COUNT; index++) {
            const orb = placements[index];
            this.orbData[index * 3] = orb.x;
            this.orbData[index * 3 + 1] = orb.y;
            this.orbData[index * 3 + 2] = orb.radius;
        }

        gl.useProgram(this.program);
        gl.uniform2f(
            this.uniforms.resolution,
            this.canvas.width,
            this.canvas.height
        );
        gl.uniform1f(this.uniforms.time, time);
        gl.uniform1f(this.uniforms.hue, hue);
        gl.uniform1f(this.uniforms.level, energy.level);
        gl.uniform3fv(this.uniforms.orbs, this.orbData);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    dispose(): void {
        this.gl.deleteProgram(this.program);
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}

function compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
        return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn(
            '[RadioVisualizer] shader compile failed:',
            gl.getShaderInfoLog(shader)
        );
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) {
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        return null;
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn(
            '[RadioVisualizer] program link failed:',
            gl.getProgramInfoLog(program)
        );
        gl.deleteProgram(program);
        return null;
    }

    return program;
}
