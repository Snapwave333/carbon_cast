#!/usr/bin/env node
/**
 * Regenerates every app icon from the one vector source of truth.
 *
 * The icon set had drifted: the Windows executable carried the CarbonCast mark
 * while the favicon, PWA, Apple touch and Linux icons still shipped the old
 * IPTVnator artwork, because each was a hand-made file with no link back to the
 * SVG. Deriving all of them here means the next brand change is one edit to
 * `app-icon.svg` plus a re-run.
 *
 *   node tools/branding/generate-icons.mjs [--check]
 *
 * `--check` verifies the committed files match what would be generated, without
 * writing anything, so CI can catch drift.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(HERE, '../../apps/web/src/assets/icons');
const SOURCE_SVG = join(ICON_DIR, 'app-icon.svg');
const CHECK_ONLY = process.argv.includes('--check');

/** Square PNGs rendered straight from the source mark. */
const PNG_TARGETS = [
    ['icon-16.png', 16],
    ['icon-32.png', 32],
    ['icon-48.png', 48],
    ['icon-64.png', 64],
    ['icon-128.png', 128],
    ['icon-1024.png', 1024],
    ['icon.png', 256],
    ['favicon.png', 256],
    ['favicon.256x256.png', 256],
    ['favicon.512x512.png', 512],
    ['carboncast-256.png', 256],
    ['icon-tv-256.png', 256],
    ['apple-touch-icon.png', 180],
    ['android-chrome-192x192.png', 192],
    ['android-chrome-512x512.png', 512],
];

/**
 * Android maskable icons are cropped to an OS-chosen shape, so the artwork must
 * bleed to the edges while the mark itself stays inside the 80% safe circle.
 */
const MASKABLE_TARGETS = [
    ['android-chrome-maskable-192x192.png', 192],
    ['android-chrome-maskable-512x512.png', 512],
];

/** Windows reads all of these out of one .ico; a single size renders soft. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** macOS .icns block types, keyed by the pixel size each one holds. */
const ICNS_BLOCKS = [
    ['ic11', 32],
    ['ic12', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic13', 512],
    ['ic09', 512],
    ['ic14', 1024],
    ['ic10', 1024],
];

/**
 * Small icons get their own artwork.
 *
 * The full mark carries three details that survive at 256px and turn to mush
 * below 64: the 18px orange dot reads as a speck of dirt, the faint outer arc
 * thins to a pixel of noise, and the background is so close to black that the
 * whole icon dissolves into a dark wallpaper. Each tier below drops detail and
 * gains weight instead of relying on one drawing to scale everywhere.
 */
/**
 * Same diamond and monogram, drawn for small sizes: the weave is dropped
 * because it turns to noise below 128px, the diamond is filled flat and a
 * touch larger, and the C strokes are heavier so they survive at 32px.
 */
const SMALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="246" fill="#12151B"/>
  <circle cx="256" cy="256" r="242" fill="none" stroke="#2E3442" stroke-width="8"/>
  <path d="M126.6 216.6 A70 70 0 1 1 126.6 295.4" fill="none" stroke="#E10D1A" stroke-width="42" stroke-linecap="round"/>
  <path d="M385.4 216.6 A70 70 0 1 0 385.4 295.4" fill="none" stroke="#E10D1A" stroke-width="42" stroke-linecap="round"/>
</svg>`;

/** Above this the carbon weave resolves; below it, it is just noise. */
const SIMPLIFIED_MAX = 64;

function artworkFor(size, fullSvg) {
    return size <= SIMPLIFIED_MAX ? SMALL_SVG : fullSvg;
}

/**
 * Rebuilds the source as a full-bleed square: the rounded background is
 * replaced by an edge-to-edge one and the mark is inset into the safe zone.
 */
function buildMaskableSvg(source) {
    // Everything after the defs is artwork; keeping the defs intact preserves
    // the weave pattern the background references. Matching on structure
    // rather than a specific wrapper element means a redrawn mark keeps
    // working without touching this.
    const defs = source.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
    const artwork = source
        .replace(/^[\s\S]*?<svg[^>]*>/, '')
        .replace(/<defs>[\s\S]*?<\/defs>/, '')
        .replace(/<\/svg>\s*$/, '')
        .trim();

    if (!artwork) {
        throw new Error('Could not find any artwork in app-icon.svg');
    }

    const SAFE_SCALE = 0.78;
    const offset = 256 * (1 - SAFE_SCALE);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
  ${defs}
  <rect width="512" height="512" fill="#080A0E"/>
  <g transform="translate(${offset} ${offset}) scale(${SAFE_SCALE})">${artwork}</g>
</svg>`;
}

function renderPng(svg, size) {
    return sharp(Buffer.from(svg))
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

/** PNG-encoded ICO — what electron-builder emits too, and what browsers read. */
function buildIco(images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);

    const directory = Buffer.alloc(images.length * 16);
    let offset = header.length + directory.length;

    images.forEach(({ size, data }, index) => {
        const entry = index * 16;
        // 256 is stored as 0 — the field is a single byte.
        directory[entry] = size >= 256 ? 0 : size;
        directory[entry + 1] = size >= 256 ? 0 : size;
        directory.writeUInt16LE(1, entry + 4);
        directory.writeUInt16LE(32, entry + 6);
        directory.writeUInt32LE(data.length, entry + 8);
        directory.writeUInt32LE(offset, entry + 12);
        offset += data.length;
    });

    return Buffer.concat([
        header,
        directory,
        ...images.map((image) => image.data),
    ]);
}

function buildIcns(blocks) {
    const chunks = blocks.map(({ type, data }) => {
        const header = Buffer.alloc(8);
        header.write(type, 0, 4, 'ascii');
        header.writeUInt32BE(data.length + 8, 4);
        return Buffer.concat([header, data]);
    });

    const body = Buffer.concat(chunks);
    const header = Buffer.alloc(8);
    header.write('icns', 0, 4, 'ascii');
    header.writeUInt32BE(body.length + 8, 4);
    return Buffer.concat([header, body]);
}

function digest(buffer) {
    return createHash('sha256').update(buffer).digest('hex').slice(0, 12);
}

async function main() {
    const source = readFileSync(SOURCE_SVG, 'utf8');
    const maskable = buildMaskableSvg(source);
    const outputs = new Map();

    for (const [name, size] of PNG_TARGETS) {
        outputs.set(name, await renderPng(artworkFor(size, source), size));
    }
    for (const [name, size] of MASKABLE_TARGETS) {
        outputs.set(name, await renderPng(maskable, size));
    }

    const icoImages = [];
    for (const size of ICO_SIZES) {
        icoImages.push({
            size,
            data: await renderPng(artworkFor(size, source), size),
        });
    }
    outputs.set('favicon.ico', buildIco(icoImages));

    const icnsBlocks = [];
    for (const [type, size] of ICNS_BLOCKS) {
        icnsBlocks.push({
            type,
            data: await renderPng(artworkFor(size, source), size),
        });
    }
    outputs.set('favicon.icns', buildIcns(icnsBlocks));

    let drifted = 0;
    for (const [name, data] of outputs) {
        const target = join(ICON_DIR, name);
        let existing = null;
        try {
            existing = readFileSync(target);
        } catch {
            // New file.
        }

        const changed = !existing || !existing.equals(data);
        if (changed) {
            drifted++;
        }

        if (CHECK_ONLY) {
            if (changed) {
                console.log(`drift  ${name}`);
            }
            continue;
        }

        if (changed) {
            writeFileSync(target, data);
        }
        console.log(
            `${changed ? 'write ' : 'same  '} ${name.padEnd(34)} ${String(
                Math.round(data.length / 1024) + 'KB'
            ).padStart(8)}  ${digest(data)}`
        );
    }

    if (CHECK_ONLY) {
        if (drifted > 0) {
            console.error(
                `\n${drifted} icon(s) differ from the source mark. Run: node tools/branding/generate-icons.mjs`
            );
            process.exit(1);
        }
        console.log('All icons match the source mark.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
