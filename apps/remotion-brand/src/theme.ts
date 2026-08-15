/**
 * Brand tokens duplicated from the inline splash in `apps/web/src/index.html`.
 * They are literals there (the splash paints before any stylesheet loads), so
 * this file is the second copy on purpose — keep the two in step.
 */
export const BRAND = {
    /** Primary accent, same red as the splash monogram. */
    accent: '#ff3b3b',
    /** Warm end of the splash progress sweep. */
    accentWarm: '#ff8c1a',
} as const;

export const LOADING_LOOP = {
    /** Rendered frame size; displayed at half this for a crisp 2x sprite. */
    size: 96,
    fps: 24,
    /** One full rotation per loop, so the last frame joins the first. */
    durationInFrames: 30,
} as const;
