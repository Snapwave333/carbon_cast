#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] || '.');
const manifestPath = join(root, 'manifests', 'asset-manifest.json');
if (!existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let failed = 0;
for (const item of manifest.files) {
  const p = join(root, item.path);
  if (!existsSync(p)) { console.error(`MISSING ${item.path}`); failed++; continue; }
  const digest = createHash('sha256').update(readFileSync(p)).digest('hex');
  if (digest !== item.sha256) { console.error(`CHANGED ${item.path}`); failed++; }
}
console.log(`${manifest.files.length - failed}/${manifest.files.length} assets verified`);
if (failed) process.exitCode = 1;
