#!/usr/bin/env node
// Installs the CarbonCast MCP server and the iptvctl CLI system-wide, so any
// agent (Claude Code, Claude Desktop, Codex, Gemini) and any shell can use them
// without knowing where this repository lives.
//
// Re-run this after moving the repository — every path it writes is derived
// from this file's own location.
//
//   node tools/global/install-global.mjs [--dry-run]
//
// What it writes:
//   1. Command shims in a directory already on PATH (Windows .cmd + POSIX sh)
//   2. An "carboncast" MCP server entry in each agent config that exists
//
// Nothing is overwritten without a timestamped .bak beside it.
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const home = os.homedir();
const dryRun = process.argv.includes('--dry-run');
const isWindows = process.platform === 'win32';

const MCP_ENTRY_NAME = 'carboncast';
const mcpMain = join(repoRoot, 'apps', 'mcp-server', 'src', 'main.mjs');
const ctlMain = join(repoRoot, 'apps', 'iptvctl', 'src', 'main.mjs');

const done = [];
const skipped = [];
const problems = [];

function backup(file) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = `${file}.${stamp}.bak`;
    if (!dryRun) copyFileSync(file, target);
    return target;
}

function write(file, contents) {
    if (dryRun) return;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
}

// ── 1. Command shims ────────────────────────────────────────────────────────
// Prefer a directory that is already on PATH so we never touch the PATH
// variable itself. On Windows the npm global dir is on PATH by default.
function shimDirectory() {
    const candidates = isWindows
        ? [join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'npm'), join(home, '.local', 'bin')]
        : [join(home, '.local', 'bin'), '/usr/local/bin'];
    const onPath = (process.env.PATH ?? '').split(isWindows ? ';' : ':');
    return (
        candidates.find((dir) => existsSync(dir) && onPath.includes(dir)) ??
        candidates.find((dir) => existsSync(dir)) ??
        candidates[0]
    );
}

function installShim(name, scriptPath) {
    const dir = shimDirectory();
    mkdirSync(dir, { recursive: true });

    // POSIX shim — used by Git Bash / WSL / macOS / Linux.
    const posix = join(dir, name);
    write(posix, `#!/bin/sh\nexec node "${scriptPath.replace(/\\/g, '/')}" "$@"\n`);
    done.push(`shim  ${posix}`);

    if (isWindows) {
        const cmd = join(dir, `${name}.cmd`);
        write(cmd, `@echo off\r\nnode "${scriptPath}" %*\r\n`);
        done.push(`shim  ${cmd}`);
    }
}

// ── 2. Agent MCP registration ───────────────────────────────────────────────
const serverEntry = { command: 'node', args: [mcpMain] };

function registerJsonConfig(label, file, { createIfMissing = false } = {}) {
    if (!existsSync(file)) {
        if (!createIfMissing) {
            skipped.push(`${label} — not installed (${file})`);
            return;
        }
        write(file, `${JSON.stringify({ mcpServers: { [MCP_ENTRY_NAME]: serverEntry } }, null, 2)}\n`);
        done.push(`mcp   ${label} (created ${file})`);
        return;
    }

    let parsed;
    try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
        problems.push(`${label} — unreadable JSON, left untouched: ${error.message}`);
        return;
    }

    const existing = parsed.mcpServers?.[MCP_ENTRY_NAME];
    if (existing && existing.args?.[0] === mcpMain) {
        skipped.push(`${label} — already registered`);
        return;
    }

    backup(file);
    parsed.mcpServers = { ...parsed.mcpServers, [MCP_ENTRY_NAME]: serverEntry };
    write(file, `${JSON.stringify(parsed, null, 2)}\n`);
    done.push(`mcp   ${label} (${existing ? 'updated' : 'added'} in ${file})`);
}

// Codex uses TOML rather than JSON.
function registerCodexConfig(file) {
    const label = 'Codex CLI';
    if (!existsSync(file)) {
        skipped.push(`${label} — not installed (${file})`);
        return;
    }
    const current = readFileSync(file, 'utf8');
    const header = `[mcp_servers.${MCP_ENTRY_NAME}]`;
    const block = [
        header,
        'command = "node"',
        `args = [${JSON.stringify(mcpMain)}]`,
        '',
    ].join('\n');

    if (current.includes(header)) {
        const alreadyCorrect = current
            .slice(current.indexOf(header))
            .split(/\r?\n\[/)[0]
            .includes(JSON.stringify(mcpMain));
        if (alreadyCorrect) {
            skipped.push(`${label} — already registered`);
            return;
        }
        problems.push(`${label} — a different [mcp_servers.${MCP_ENTRY_NAME}] block exists; left untouched (${file})`);
        return;
    }

    backup(file);
    const separator = current.endsWith('\n') ? '\n' : '\n\n';
    write(file, `${current}${separator}${block}`);
    done.push(`mcp   ${label} (appended to ${file})`);
}

// ── Run ─────────────────────────────────────────────────────────────────────
for (const entry of [mcpMain, ctlMain]) {
    if (!existsSync(entry)) {
        problems.push(`missing source file: ${entry}`);
    }
}

if (problems.length === 0) {
    installShim('carboncast-mcp', mcpMain);
    installShim('iptvctl', ctlMain);

    registerJsonConfig('Claude Code (user scope)', join(home, '.claude.json'));
    registerJsonConfig(
        'Claude Desktop',
        isWindows
            ? join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
            : join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    );
    registerJsonConfig('Gemini CLI', join(home, '.gemini', 'settings.json'));
    registerCodexConfig(join(home, '.codex', 'config.toml'));
}

const heading = dryRun ? 'DRY RUN — nothing written' : 'CarbonCast global install';
console.log(`\n${heading}\nrepo: ${repoRoot}\n`);
for (const line of done) console.log(`  ✓ ${line}`);
for (const line of skipped) console.log(`  · ${line}`);
for (const line of problems) console.log(`  ! ${line}`);
console.log(
    `\ncommands: carboncast-mcp (MCP stdio server), iptvctl (CLI)\nmcp name: ${MCP_ENTRY_NAME}\n`
);
process.exitCode = problems.length ? 1 : 0;
