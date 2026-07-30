#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] || '.');
const run = (args) => {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return ''; }
};

const candidates = [];
const add = (url, source, confidence, notes='') => {
  if (!url || !/^((https?|ssh):\/\/|git@|[^ ]+\/[^ ]+\.git)/i.test(url)) return;
  if (!candidates.some((x) => x.url === url && x.source === source)) candidates.push({ url, source, confidence, notes });
};

const remoteLines = run(['remote', '-v']).split(/\r?\n/).filter(Boolean);
for (const line of remoteLines) {
  const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
  if (!match || match[3] !== 'fetch') continue;
  const [, name, url] = match;
  add(url, `git remote ${name}`, name === 'upstream' ? 'high' : 'medium', name === 'origin' ? 'Origin may be the fork; verify before crediting.' : 'Preferred upstream remote.');
}

for (const file of ['package.json', 'pyproject.toml', 'Cargo.toml', 'pubspec.yaml', 'composer.json']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  const urls = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const url of urls) if (/github|gitlab|codeberg|bitbucket/i.test(url)) add(url.replace(/[),.;]+$/, ''), file, 'medium', 'Manifest candidate; corroborate with license or README.');
}

for (const file of ['README.md', 'README', 'LICENSE', 'LICENSE.md', 'NOTICE', 'NOTICE.md']) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  const urls = text.match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
  for (const url of urls) if (/github|gitlab|codeberg|bitbucket/i.test(url)) add(url.replace(/[),.;]+$/, ''), file, /forked from|upstream|original project/i.test(text) ? 'high' : 'low', 'Documentation candidate; inspect surrounding text.');
}

const earliest = run(['log', '--reverse', '--format=%H|%an|%ae|%ad|%s', '--date=iso-strict', '-n', '10']).split(/\r?\n/).filter(Boolean);
const report = {
  generatedAt: new Date().toISOString(),
  repositoryRoot: root,
  currentBranch: run(['branch', '--show-current']),
  candidates,
  earliestCommits: earliest,
  decision: null,
  instructions: 'Prefer a verified upstream remote. Corroborate other candidates. Never invent a URL or assume origin is upstream.'
};
const out = join(root, 'upstream-detection.json');
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${out}`);
for (const c of candidates) console.log(`[${c.confidence}] ${c.source}: ${c.url}`);
if (!candidates.length) process.exitCode = 2;
