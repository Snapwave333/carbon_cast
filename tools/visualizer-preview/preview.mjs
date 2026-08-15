import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Looks at the radio visualizer.
 *
 * It cannot be checked from unit tests — it is a fragment shader — and the
 * in-app browser preview does not composite, so `requestAnimationFrame` never
 * fires there and the frame loop never runs. This bundles the real modules,
 * drives them at fixed times and dock sizes, and renders them headlessly
 * through SwiftShader so the result can be screenshotted and measured.
 *
 * Usage: node tools/visualizer-preview/preview.mjs <shots|coverage|trails|perf>
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve('tmp/visualizer-preview');
const HARNESS = pathToFileURL(resolve(HERE, 'harness.html'));

/** Dock shapes the playback bar actually produces, measured in the app. */
const DOCKS = [
    { name: 'compact', width: 1300, height: 88 },
    { name: 'medium', width: 1048, height: 374 },
    { name: 'large', width: 1048, height: 700 },
];

async function bundle() {
    await mkdir(OUT_DIR, { recursive: true });
    await build({
        entryPoints: [resolve(HERE, 'entry.ts')],
        bundle: true,
        format: 'iife',
        outfile: resolve(HERE, 'bundle.js'),
        logLevel: 'warning',
    });
}

async function openHarness(browser, dock, { time = 7, raw = false } = {}) {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setViewportSize({ width: dock.width, height: dock.height });
    await page.goto(
        `${HARNESS}?w=${dock.width}&h=${dock.height}&t=${time}${raw ? '&raw=1' : ''}`
    );
    await page.waitForFunction(() => document.title !== '');
    if ((await page.title()) !== 'ready') {
        throw new Error(`${dock.name}: ${await page.title()}`);
    }
    return page;
}

/** Screenshots each dock size, as the dock actually presents it. */
async function shots(browser) {
    for (const dock of DOCKS) {
        for (const time of [7, 21]) {
            const page = await openHarness(browser, dock, { time });
            const file = `${OUT_DIR}/${dock.name}-t${time}.png`;
            await page.locator('#dock').screenshot({ path: file });
            await page.close();
            console.log('wrote', file);
        }
    }
}

/**
 * Fraction of the frame covered by solid body. Judging this by eye does not
 * work: past roughly 0.5 the blobs stop reading as separate bodies and the
 * whole thing becomes a flat wash, and that crept in twice unnoticed.
 */
async function coverage(browser) {
    for (const dock of DOCKS) {
        const page = await openHarness(browser, dock, { raw: true });
        const samples = await page.evaluate(({ times }) => {
            const canvas = document.querySelector('canvas');
            const gl = canvas.getContext('webgl2');
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            return times.map((time) => {
                window.Viz.renderFrames(canvas, time, 0.58, {
                    trails: true,
                    window: 0.4,
                });
                gl.readPixels(
                    0, 0, canvas.width, canvas.height,
                    gl.RGBA, gl.UNSIGNED_BYTE, pixels
                );
                let solid = 0;
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] > 160) solid++;
                }
                return solid / (canvas.width * canvas.height);
            });
        }, { times: Array.from({ length: 20 }, (_, i) => i * 3.3) });
        await page.close();

        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        console.log(
            dock.name.padEnd(8),
            'mean', mean.toFixed(3),
            'max', Math.max(...samples).toFixed(3)
        );
    }
}

/**
 * Diffs trails on against trails off. They must leave the *lit pixel count*
 * unchanged: an earlier version composited each frame over the faded buffer,
 * which integrates rather than trails and brightened the whole picture.
 *
 * Separate page loads, because `dispose()` loses the GL context.
 */
async function trails(browser) {
    const dock = DOCKS[2];
    const grab = async (enabled) => {
        const page = await openHarness(browser, dock, { time: 8, raw: true });
        const data = await page.evaluate(({ enabled }) => {
            const canvas = document.querySelector('canvas');
            const gl = canvas.getContext('webgl2');
            window.Viz.renderFrames(canvas, 8, 0.58, { trails: enabled });
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(
                0, 0, canvas.width, canvas.height,
                gl.RGBA, gl.UNSIGNED_BYTE, pixels
            );
            let lit = 0;
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] > 8) lit++;
            }
            return { pixels: Array.from(pixels), lit };
        }, { enabled });
        await page.close();
        return data;
    };

    const on = await grab(true);
    const off = await grab(false);
    let total = 0;
    let changed = 0;
    for (let i = 0; i < on.pixels.length; i++) {
        const delta = Math.abs(on.pixels[i] - off.pixels[i]);
        total += delta;
        if (delta > 4) changed++;
    }

    console.log('lit pixels   on', on.lit, ' off', off.lit,
        on.lit === off.lit ? '(unchanged — good)' : '(CHANGED — trails are integrating)');
    console.log('mean |diff| ', (total / on.pixels.length).toFixed(3),
        ' channels moved', (100 * changed / on.pixels.length).toFixed(2) + '%');
}

/**
 * Per-frame cost with and without trails. SwiftShader is a CPU rasterizer, so
 * the absolute numbers mean nothing — it over-weights the field evaluation
 * relative to the memory-bound fade and blit. Read it as a rough ratio only.
 */
async function perf(browser) {
    for (const dock of [DOCKS[0], DOCKS[2]]) {
        const measure = async (enabled) => {
            const page = await openHarness(browser, dock, { time: 4, raw: true });
            const ms = await page.evaluate(({ enabled }) => {
                const canvas = document.querySelector('canvas');
                const gl = canvas.getContext('webgl2');
                window.Viz.renderFrames(canvas, 4, 0.58, {
                    trails: enabled,
                    window: 0.3,
                });
                const drain = new Uint8Array(4);
                const frames = 120;
                const start = performance.now();
                window.Viz.renderFrames(canvas, 4 + frames / 60, 0.58, {
                    trails: enabled,
                    window: frames / 60,
                });
                // Force the pipeline to drain, or this times queued commands.
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, drain);
                return (performance.now() - start) / frames;
            }, { enabled });
            await page.close();
            return ms;
        };

        const off = await measure(false);
        const on = await measure(true);
        console.log(
            dock.name.padEnd(8),
            'no trails', off.toFixed(2) + 'ms',
            ' trails', on.toFixed(2) + 'ms',
            ' overhead', (((on - off) / off) * 100).toFixed(0) + '%'
        );
    }
}

const COMMANDS = { shots, coverage, trails, perf };

const command = process.argv[2] ?? 'shots';
if (!COMMANDS[command]) {
    console.error(`unknown command "${command}" — expected one of ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
}

await bundle();
const browser = await chromium.launch({
    // The shader needs a real GL implementation; SwiftShader provides one
    // without a GPU, which is what makes this runnable in CI and over SSH.
    args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
    ],
});
try {
    await COMMANDS[command](browser);
} finally {
    await browser.close();
}
