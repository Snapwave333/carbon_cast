import { linkFadeProgram } from './radio-metaball-program';

/**
 * The offscreen buffer the motion trails live in.
 *
 * They cannot accumulate in the drawing buffer itself: the compositor is free
 * to clear that between frames, so anything meant to persist has to be kept in
 * a texture we own and copied across at the end of each frame.
 */

/**
 * Time for a trail to fade to 1/e. Kept short: the orbs move slowly, so this
 * mostly shows up behind the one that darts on the beat, which is the point.
 */
const TRAIL_FADE_SECONDS = 0.14;
/**
 * A frame gap longer than this means the loop parked and resumed rather than
 * ran slowly, so the trail is dropped instead of smearing across the gap.
 */
const MAX_TRAIL_STEP_SECONDS = 0.2;

export class RadioTrailBuffer {
    private texture: WebGLTexture | null = null;
    private framebuffer: WebGLFramebuffer | null = null;
    private width = 0;
    private height = 0;
    /** Undefined contents until the first frame has been drawn into it. */
    private primed = false;

    private constructor(
        private readonly gl: WebGL2RenderingContext,
        private readonly fadeProgram: WebGLProgram
    ) {}

    /** Returns null when the fade program will not link; trails are then off. */
    static create(gl: WebGL2RenderingContext): RadioTrailBuffer | null {
        const fadeProgram = linkFadeProgram(gl);
        return fadeProgram ? new RadioTrailBuffer(gl, fadeProgram) : null;
    }

    /**
     * Grows the buffer to match the drawing buffer. Returns false when one
     * cannot be had, in which case the caller draws straight to the canvas and
     * simply gets no trails.
     */
    resize(width: number, height: number): boolean {
        if (this.framebuffer && this.width === width && this.height === height) {
            return true;
        }

        const gl = this.gl;
        this.release();

        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer) {
            return false;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0
        );
        const complete =
            gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (!complete) {
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(framebuffer);
            return false;
        }

        this.texture = texture;
        this.framebuffer = framebuffer;
        this.width = width;
        this.height = height;
        this.primed = false;
        return true;
    }

    /**
     * Binds the buffer and ages what is already in it by `elapsed` seconds.
     * Leaves the caller free to draw the current frame on top.
     */
    beginFrame(elapsed: number): void {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

        // A gap that long means the loop parked and resumed, or this is the
        // first frame; either way there is nothing worth smearing forward.
        if (!this.primed || elapsed > MAX_TRAIL_STEP_SECONDS || elapsed < 0) {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.primed = true;
            return;
        }

        // Time-based rather than per-frame, so the trail is the same length
        // whether the loop is running at 60fps or 30. Multiplying in place with
        // `ZERO, CONSTANT_COLOR` avoids a second texture to ping-pong against:
        // the source is discarded and only the destination survives, attenuated.
        const keep = Math.exp(-elapsed / TRAIL_FADE_SECONDS);
        gl.useProgram(this.fadeProgram);
        gl.blendColor(keep, keep, keep, keep);
        gl.blendFunc(gl.ZERO, gl.CONSTANT_COLOR);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /** Copies the accumulated trail to the canvas. */
    present(): void {
        const gl = this.gl;
        // Straight copy — same size and format, so no shader and no sampling.
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(
            0, 0, this.width, this.height,
            0, 0, this.width, this.height,
            gl.COLOR_BUFFER_BIT, gl.NEAREST
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    dispose(): void {
        this.release();
        this.gl.deleteProgram(this.fadeProgram);
    }

    private release(): void {
        if (this.texture) {
            this.gl.deleteTexture(this.texture);
            this.texture = null;
        }
        if (this.framebuffer) {
            this.gl.deleteFramebuffer(this.framebuffer);
            this.framebuffer = null;
        }
        this.width = 0;
        this.height = 0;
        this.primed = false;
    }
}
