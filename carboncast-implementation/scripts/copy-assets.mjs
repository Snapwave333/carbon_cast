#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pack = resolve(here, '..');
const target = resolve(process.argv[2] || '.');
const destination = resolve(target, process.argv[3] || 'public/branding');
if (!existsSync(resolve(pack, 'assets'))) throw new Error('Pack assets directory is missing.');
mkdirSync(destination, { recursive: true });
for (const folder of ['logos','icons','favicons','splash','patterns']) {
  cpSync(resolve(pack, 'assets', folder), resolve(destination, folder), { recursive: true, force: true });
}
console.log(`Copied CarbonCast assets to ${destination}`);
console.log('Now integrate only the files needed by the repository and update package/build configuration manually.');
