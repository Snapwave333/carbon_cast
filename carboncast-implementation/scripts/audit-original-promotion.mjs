#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const ignored = new Set(['.git','node_modules','dist','build','target','.next','.turbo','coverage','vendor','.venv','venv','carboncast-implementation']);
const textExt = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.json','.jsonc','.html','.htm','.css','.scss','.sass','.less','.md','.mdx','.txt','.xml','.yml','.yaml','.toml','.ini','.env','.properties','.kt','.java','.swift','.rs','.py','.go','.cs','.cpp','.c','.h','.hpp','.vue','.svelte','.dart','.php','.rb','.ps1','.sh','.bat']);
const patterns = [
  ['donation-keyword', /\b(donate|donation|donations|tip jar|support us|buy me a coffee|funding)\b/i],
  ['funding-provider', /(buymeacoffee\.com|ko-fi\.com|patreon\.com|paypal\.me|opencollective\.com|github\.com\/sponsors)/i],
  ['social-url', /(twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|discord\.(gg|com\/invite)|t\.me|telegram\.me|reddit\.com\/r\/|mastodon\.|matrix\.to|youtube\.com\/@)/i],
  ['social-field', /\b(twitter|instagram|facebook|telegram|discord|tiktok|mastodon|socialLinks?|communityLink|donationUrl|sponsorUrl|fundingUrl)\b\s*[:=]/i],
  ['donation-code', /\b(openDonation|showDonation|donationDialog|donationModal|donateButton|sponsorButton|fundingButton|tipButton)\b/i],
];

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { walk(p); continue; }
    if (st.size > 2_000_000) continue;
    const ext = extname(name).toLowerCase();
    if (!textExt.has(ext) && !name.startsWith('.env')) continue;
    let text; try { text = readFileSync(p, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [category, regex] of patterns) {
        if (regex.test(line)) hits.push({ file: relative(root, p), line: i + 1, category, preview: line.trim().slice(0, 300) });
      }
    });
  }
}
walk(root);
const report = {
  generatedAt: new Date().toISOString(),
  root,
  hitCount: hits.length,
  warning: 'Keyword matches require classification. Preserve legal attribution, operational IDs, playable media URLs and normal subscription billing.',
  hits
};
const out = join(root, 'original-promotion-audit.json');
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${out}: ${hits.length} matches`);
for (const hit of hits.slice(0, 80)) console.log(`${hit.file}:${hit.line} [${hit.category}] ${hit.preview}`);
if (hits.length) process.exitCode = 1;
