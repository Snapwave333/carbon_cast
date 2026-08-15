import { EnergyFrame } from './radio-energy-model';
import { computeOrbPlacements } from './radio-orb-choreography';
import { linkMetaballProgram, ORB_COUNT } from './radio-metaball-program';
import { RadioTrailBuffer } from './radio-trail-buffer';

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

/** Above 2x the extra pixels are invisible but the fill cost is not. */
const MAX_PIXEL_RATIO = 2;
/**
 * The shader evaluates the orb field five times per pixel (once for the surface
 * and four more for the gradient), so fill cost scales linearly with area — and
 * the dock's tallest preset is roughly thirty times the area of the compact
 * strip. The canvas is blurred by 7px on the way to the screen, so resolution
 * beyond this budget is spent entirely on detail the blur then destroys.
 */
const MAX_DRAWING_BUFFER_PIXELS = 1_600_000;

export interface MetaballFrame {
    /** Seconds since the visualizer started. Monotonic. */
    time: number;
    /** Base hue in revolutions; the per-orb offsets are added to it. */
    hue: number;
    energy: EnergyFrame;
    /** Station identity, so each one opens on its own arrangement. */
    seed?: number;
    /** Off for reduced motion, and whenever the trail buffer is unavailable. */
    trails?: boolean;
}

export interface DrawingBufferSize {
    width: number;
    height: number;
}

/**
 * Device-pixel size for a canvas of the given CSS size. Split out from the GL
 * calls so the resolution budget can be asserted without a GL context.
 */
export function computeDrawingBufferSize(
    cssWidth: number,
    cssHeight: number,
    devicePixelRatio: number
): DrawingBufferSize {
    const ratio = Math.min(
        Math.max(devicePixelRatio || 1, 0.5),
        MAX_PIXEL_RATIO
    );
    const width = Math.max(1, cssWidth * ratio);
    const height = Math.max(1, cssHeight * ratio);

    const budgetScale = Math.min(
        1,
        Math.sqrt(MAX_DRAWING_BUFFER_PIXELS / (width * height))
    );

    // Floored, not rounded: rounding both axes up can push the result back
    // over the budget the scale was derived from.
    return {
        width: Math.max(1, Math.floor(width * budgetScale)),
        height: Math.max(1, Math.floor(height * budgetScale)),
    };
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
        orbHues: WebGLUniformLocation | null;
    };
    private readonly orbData = new Float32Array(ORB_COUNT * 4);
    private readonly orbHueData = new Float32Array(ORB_COUNT * 2);
    /**
     * CSS size of the canvas, kept up to date by an observer. Reading
     * `clientWidth` inside the frame loop instead would force a synchronous
     * layout on every frame, which is exactly when the bar is mid-transition
     * and layout is most expensive. Without an observer `resize` falls back to
     * measuring per frame, since a frozen size would be worse than the cost.
     */
    private cssWidth: number;
    private cssHeight: number;
    private readonly resizeObserver: ResizeObserver | null;
    /** Null when trails are unavailable; the canvas is then drawn directly. */
    private readonly trail: RadioTrailBuffer | null;
    private lastFrameTime: number | null = null;

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
            orbHues: gl.getUniformLocation(program, 'uOrbHues'),
        };

        this.cssWidth = canvas.clientWidth;
        this.cssHeight = canvas.clientHeight;
        this.resizeObserver =
            typeof ResizeObserver === 'function'
                ? new ResizeObserver(([entry]) => {
                      this.cssWidth = entry.contentRect.width;
                      this.cssHeight = entry.contentRect.height;
                  })
                : null;
        this.resizeObserver?.observe(canvas);

        this.trail = RadioTrailBuffer.create(gl);

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

        const program = linkMetaballProgram(gl);
        return program ? new RadioMetaballRenderer(canvas, gl, program) : null;
    }

    /** Matches the drawing buffer to the element's on-screen pixel size. */
    resize(): void {
        if (!this.resizeObserver) {
            this.cssWidth = this.canvas.clientWidth;
            this.cssHeight = this.canvas.clientHeight;
        }

        const { width, height } = computeDrawingBufferSize(
            this.cssWidth,
            this.cssHeight,
            window.devicePixelRatio
        );

        if (this.canvas.width === width && this.canvas.height === height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    render(frame: MetaballFrame): void {
        const gl = this.gl;
        const { time, hue, energy } = frame;
        this.resize();

        const width = this.canvas.width;
        const height = this.canvas.height;
        const trailing =
            frame.trails !== false &&
            this.trail !== null &&
            this.trail.resize(width, height);

        const placements = computeOrbPlacements(
            time,
            energy,
            width / Math.max(1, height),
            frame.seed ?? 0
        );

        for (let index = 0; index < ORB_COUNT; index++) {
            const orb = placements[index];
            this.orbData[index * 4] = orb.x;
            this.orbData[index * 4 + 1] = orb.y;
            this.orbData[index * 4 + 2] = orb.radius;
            this.orbData[index * 4 + 3] = orb.layer;

            const angle = orb.hue * Math.PI * 2;
            this.orbHueData[index * 2] = Math.cos(angle);
            this.orbHueData[index * 2 + 1] = Math.sin(angle);
        }

        const elapsed =
            this.lastFrameTime === null ? Infinity : time - this.lastFrameTime;
        this.lastFrameTime = time;

        if (trailing) {
            this.trail?.beginFrame(elapsed);
        } else {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
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
        gl.uniform4fv(this.uniforms.orbs, this.orbData);
        gl.uniform2fv(this.uniforms.orbHues, this.orbHueData);

        if (trailing) {
            // Combined with `max`, not composited over. Compositing the frame
            // over the faded buffer integrates it: a *stationary* region keeps
            // adding to its own decayed self and settles far brighter than the
            // frame it came from (a halo at alpha 0.3 lands at 0.79), so the
            // whole picture washes out rather than growing tails. Taking the
            // maximum leaves anything still at exactly its own value and lets
            // only vacated pixels decay.
            gl.blendEquation(gl.MAX);
            gl.blendFunc(gl.ONE, gl.ONE);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 3);

        if (trailing) {
            gl.blendEquation(gl.FUNC_ADD);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            this.trail?.present();
        }
    }

    dispose(): void {
        this.resizeObserver?.disconnect();
        this.trail?.dispose();
        this.gl.deleteProgram(this.program);
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}
