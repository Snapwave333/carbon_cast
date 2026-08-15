// Composes the rendered LoadingLoop frames into a single-row sprite sheet.
//
// A single row is deliberate: CSS `steps()` can only walk one axis, so a 1xN
// strip animates with one `background-position` keyframe and no JS. WebP is
// used over PNG because the frames are mostly transparent with soft glows,
// where it compresses several times smaller at the same alpha fidelity.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(projectRoot, '../..');
const framesDir = join(projectRoot, 'out/frames');
const outputFile = resolve(
    repoRoot,
    'apps/web/src/assets/animations/loading-loop.webp'
);

const frameFiles = (await readdir(framesDir))
    .filter((name) => name.endsWith('.png'))
    .sort();

if (frameFiles.length === 0) {
    throw new Error(
        `No frames in ${framesDir}. Run "pnpm run brand:render" first.`
    );
}

const first = await sharp(join(framesDir, frameFiles[0])).metadata();
const { width, height } = first;
if (!width || !height) {
    throw new Error('Could not read frame dimensions.');
}

const composites = frameFiles.map((name, index) => ({
    input: join(framesDir, name),
    left: index * width,
    top: 0,
}));

await mkdir(dirname(outputFile), { recursive: true });
const { size } = await sharp({
    create: {
        width: width * frameFiles.length,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
})
    .composite(composites)
    // Measured against the rendered frames: q/alphaQuality 70 is the knee of
    // the curve here (126 KB at 88/90, 61 KB at 70/70) with no visible
    // banding in the soft stroke glow at display size.
    .webp({ quality: 70, alphaQuality: 70, effort: 6 })
    .toFile(outputFile);

const metaFile = join(projectRoot, 'out/sprite-meta.json');
await writeFile(
    metaFile,
    `${JSON.stringify({ frames: frameFiles.length, width, height }, null, 4)}\n`
);

console.log(
    `loading-loop.webp — ${frameFiles.length} frames, ${width}x${height} each, ` +
        `${(size / 1024).toFixed(1)} KB`
);
