import { ENERGY_BAND_COUNT } from './radio-energy-model';

/**
 * The GLSL half of the metaball visualizer, plus the boilerplate that turns it
 * into a linked program. Split from the renderer so the geometry and lifecycle
 * code stays readable next to the shader it drives.
 */

export const ORB_COUNT = ENERGY_BAND_COUNT;

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
// xy centre, z radius, w depth layer (0 far, 1 near).
uniform vec4 uOrbs[${ORB_COUNT}];
// Each orb's hue as a unit vector on the colour wheel. Passed pre-resolved
// because hues are angles: averaging them as plain numbers sends a blend of
// 0.95 and 0.05 to 0.5, the opposite colour, instead of back through red.
uniform vec2 uOrbHues[${ORB_COUNT}];

out vec4 fragColor;

const float TAU = 6.283185307179586;

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

// The field again, but also accumulating the orb hues weighted by how much
// each orb contributes here. Near a core that orb dominates and the pixel takes
// its colour; in the neck between two orbs the two hues mix. Kept separate from
// field() because only the centre sample needs the colour — the four gradient
// samples would pay for it and throw it away.
vec4 fieldWithHue(vec2 p) {
    float sum = 0.0;
    vec2 hue = vec2(0.0);
    float layer = 0.0;
    float layerWeight = 0.0;
    for (int i = 0; i < ${ORB_COUNT}; i++) {
        vec2 delta = p - uOrbs[i].xy;
        float radius = uOrbs[i].z;
        float contribution = (radius * radius) / (dot(delta, delta) + 0.0004);
        sum += contribution;
        hue += uOrbHues[i] * contribution;

        // Depth is blended on a *saturating* weight, not the raw contribution.
        // The raw one is unbounded at an orb's centre, so a far orb's own depth
        // won there outright while its surroundings averaged toward its nearer
        // neighbours — the aerial dimming then punched a dark hole through the
        // middle of every receding blob.
        float weight = contribution / (1.0 + contribution);
        layer += uOrbs[i].w * weight;
        layerWeight += weight;
    }
    return vec4(sum, hue, layer / max(layerWeight, 1e-6));
}

// Cheap per-pixel hash, used as dither. The body is one enormous smooth
// gradient, and at the tall presets an 8-bit surface bands visibly across it;
// a sub-quantum of noise breaks the bands up and reads as film grain.
float grain(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}

void main() {
    // Aspect-corrected so orbs stay round in a wide dock.
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = vec2((uv.x - 0.5) * (uResolution.x / uResolution.y), uv.y - 0.5);

    vec4 sampled = fieldWithHue(p);
    float f = sampled.x;
    // Opposing hues can cancel to nothing, and atan(0.0, 0.0) is undefined.
    float orbHue = dot(sampled.yz, sampled.yz) > 1e-8
        ? atan(sampled.z, sampled.y) / TAU
        : 0.0;
    float layer = sampled.w;

    // Central difference on the field stands in for a surface normal, which
    // is what gives the blobs their wet, rounded shading.
    float eps = 1.6 / uResolution.y;
    vec2 gradient = vec2(
        field(p + vec2(eps, 0.0)) - field(p - vec2(eps, 0.0)),
        field(p + vec2(0.0, eps)) - field(p - vec2(0.0, eps))
    );
    vec3 normal = normalize(vec3(gradient * 0.06, 1.0));

    // A wide surface band: the narrower it is, the more the blobs read as
    // hard plastic discs that the downstream blur then has to rescue.
    float body = smoothstep(0.70, 1.55, f);
    float halo = smoothstep(0.16, 0.95, f);
    float rim = smoothstep(1.9, 1.15, f) * body;

    // Each orb's own hue, drifting a little with depth into the body so the
    // fused necks read as a different colour from their cores. The depth term
    // has to saturate: the field is unbounded at an orb's centre, so feeding it
    // in raw spun the hue through whole revolutions across a couple of pixels
    // and the blur averaged every core to grey.
    float density = f / (1.0 + f);
    // The normal is unstable at an orb's exact centre — the gradient passes
    // through zero and flips — so its tint is faded out with density, or it
    // leaves a hard dot in the middle of every blob.
    float hue = fract(
        uHue + orbHue + density * 0.05 + normal.x * 0.05 * (1.0 - density)
    );
    // Brightness rides density rather than being flat across the body, which is
    // what makes the blobs read as volumes lit from within instead of discs.
    // Aerial perspective on top: whatever is further back is washed out, which
    // is what separates the layers into depth. It leans on desaturation rather
    // than dimming — brightness is the one channel where the depth blend's dip
    // at an orb's own centre is plainly visible as a dark spot.
    float distance = 1.0 - layer;
    // The core has to end up brighter than the rim shell around it. When the
    // rim won, every blob rendered as a ring with a dark hole punched in it.
    vec3 core = hsv2rgb(vec3(
        hue,
        (0.88 - density * 0.12 - uLevel * 0.08) * (1.0 - distance * 0.38),
        mix(0.32, 1.18, density) * (0.74 + uLevel * 0.26) * (1.0 - distance * 0.12)
    ));
    vec3 edge = hsv2rgb(vec3(fract(hue + 0.06), 0.94, 0.92));

    // Only the near layers catch a highlight; a far orb picking one up would
    // pull itself straight back to the front of the frame.
    float specular = pow(max(normal.z, 0.0), 24.0) * body * 0.22 * layer;
    vec3 color = mix(core, edge, rim * 0.3) + specular;

    // Alpha describes the silhouette only. Depth deliberately does not appear
    // here: inside the body every other term has saturated, so a depth factor
    // would be the sole thing varying across it, and because each orb's own
    // depth dominates at its own centre that showed up as a dip in the middle
    // of every blob. On the colour terms above it is outweighed by density,
    // which peaks at exactly the same place.
    float alpha = clamp(halo * 0.38 + body * 0.85, 0.0, 1.0);
    // Dither before the 8-bit write, not after: this has to land on the value
    // being quantised or it does nothing about the banding.
    color += grain(gl_FragCoord.xy) * 0.012;
    fragColor = vec4(color * alpha, alpha);
}`;

/**
 * Writes nothing. Drawn over the trail buffer with a blend function that keeps
 * only a fraction of the destination, which is how the trail fades: the source
 * is multiplied by zero, so its colour is irrelevant and only the blend matters.
 */
const FADE_FRAGMENT_SHADER = `#version 300 es
precision lowp float;
out vec4 fragColor;
void main() {
    fragColor = vec4(0.0);
}`;

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

/** Returns null on any compile or link failure; the caller then hides the canvas. */
export function linkMetaballProgram(
    gl: WebGL2RenderingContext
): WebGLProgram | null {
    return linkProgram(gl, FRAGMENT_SHADER);
}

/** Returns null on failure; the caller then renders without trails. */
export function linkFadeProgram(
    gl: WebGL2RenderingContext
): WebGLProgram | null {
    return linkProgram(gl, FADE_FRAGMENT_SHADER);
}

function linkProgram(
    gl: WebGL2RenderingContext,
    fragmentSource: string
): WebGLProgram | null {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
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
