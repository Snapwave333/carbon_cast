#!/usr/bin/env node
import { createAgentControlClient, EXIT_CODES, resultExitCode } from '../../agent-control/src/client.mjs';

const raw = process.argv.slice(2);
const { flags, positionals } = parseArgs(raw);
const output = createOutput(flags);
const client = createAgentControlClient({ baseUrl: flags.url, token: flags.token });

if (!positionals.length || flags.help) {
    output.text(usage());
    process.exitCode = positionals.length ? EXIT_CODES.OK : EXIT_CODES.USAGE;
} else if (positionals[0] === 'events') {
    const result = await client.subscribeEvents((event) => output.result(event));
    process.exitCode = resultExitCode(result);
} else {
    const command = parseCommand(positionals);
    if (!command) {
        output.text(usage());
        process.exitCode = EXIT_CODES.USAGE;
    } else if (flags.dryRun && command.write) {
        output.result({ dryRun: true, operation: command.operation, params: command.params });
        process.exitCode = EXIT_CODES.OK;
    } else {
        const result = await command.run(client);
        output.result(result);
        process.exitCode = resultExitCode(result);
    }
}

function parseCommand(args) {
    const [area, action, ...rest] = args;
    const command = (operation, params = {}, write = true) => ({
        operation,
        params: { ...params, ...(write && flags.confirm ? { confirm: true } : {}) },
        write,
        run: (control) => control.command(operation, { ...params, ...(write && flags.confirm ? { confirm: true } : {}) }),
    });
    if (area === 'player') {
        if (action === 'state') return { write: false, run: (control) => control.getState() };
        if (['play', 'pause', 'stop'].includes(action)) return command(`player.${action}`);
        if (action === 'volume') return command('player.setVolume', { volume: number(rest[0]) });
        if (action === 'mute') return command('player.setMuted', { muted: boolean(rest[0]) });
        if (action === 'seek') return command('player.seek', { seconds: number(rest[0]) });
        if (action === 'fullscreen') return command('player.setFullscreen', { fullscreen: boolean(rest[0]) });
        if (action === 'pip') return command('player.togglePictureInPicture');
    }
    if (area === 'channels') {
        if (action === 'list') return command('channel.list', pick(flags, ['query', 'limit']), false);
        if (action === 'next') return command('channel.next');
        if (action === 'previous') return command('channel.previous');
        if (action === 'switch') return command('channel.switch', flags.number ? { number: number(flags.number) } : { channelId: rest[0] });
    }
    if (area === 'epg') {
        if (action === 'now') return command('epg.getNowNext', {}, false);
        if (action === 'refresh') return command('epg.refresh');
    }
    if (area === 'favorites') {
        if (action === 'list') return command('favorite.list', {}, false);
        if (action === 'set') return command('favorite.set', { channelId: rest[0], favorite: boolean(rest[1]) });
    }
    if (area === 'follows') {
        if (action === 'list') return command('follow.list', {}, false);
        if (action === 'follow') return command('follow.set', { source: rest[0], title: rest.slice(1).join(' ') });
        if (action === 'unfollow') return command('follow.set', { seriesId: rest[0], followed: false });
        if (action === 'auto-switch') return command('follow.setAutoSwitch', { broadcastId: rest[0], enabled: boolean(rest[1]) });
    }
    if (area === 'recording' && ['start', 'stop'].includes(action)) return command(`recording.${action}`);
    if (area === 'settings') {
        if (action === 'get') return command('settings.get', {}, false);
        if (action === 'set') return command('settings.update', { [rest[0]]: value(rest.slice(1).join(' ')) });
    }
    if (area === 'diagnostics' && action === 'get') return command('diagnostics.get', {}, false);
    // Read-only: the main process captures the window and writes the file, so
    // it still answers when the renderer is wedged.
    if (area === 'diagnostics' && action === 'screenshot') return command('diagnostics.screenshot', {}, false);
    if (area === 'navigate') return command('app.navigate', { route: action });
    if (area === 'tokens') {
        if (action === 'list') return { write: false, run: (control) => control.listTokens() };
        if (action === 'create') return { write: true, run: (control) => control.createToken({ label: flags.label || 'iptvctl token', scopes: String(flags.scopes || '').split(',').filter(Boolean), ...(flags.expiresAt ? { expiresAt: flags.expiresAt } : {}) }) };
        if (action === 'revoke') return { write: true, run: (control) => control.revokeToken(rest[0]) };
        if (action === 'rotate') return { write: true, run: (control) => control.rotateToken(rest[0]) };
    }
    return null;
}

function parseArgs(args) {
    const flags = {};
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const [key, inline] = arg.slice(2).split('=', 2);
        if (['json', 'jsonl', 'quiet', 'verbose', 'dry-run', 'confirm', 'help'].includes(key)) {
            flags[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
        } else {
            flags[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = inline ?? args[++index];
        }
    }
    return { flags, positionals };
}

function createOutput(flags) {
    return {
        result(value) {
            if (flags.quiet) return;
            if (flags.json || flags.jsonl) return process.stdout.write(`${JSON.stringify(value)}\n`);
            process.stdout.write(`${plain(value)}\n`);
        },
        text(value) {
            if (!flags.quiet) process.stdout.write(`${value}\n`);
        },
    };
}

function plain(value) {
    if (value?.success === false) return `${value.error?.code || 'failed'}: ${value.error?.message || 'Operation failed.'}`;
    if (value?.success === true) return `${value.operation || 'operation'}: success`;
    return JSON.stringify(value, null, 2);
}

function number(input) {
    const result = Number(input);
    return Number.isFinite(result) ? result : input;
}

function boolean(input) {
    return input === true || input === 'true' || input === '1' || input === 'on';
}

function value(input) {
    if (input === 'true' || input === 'false') return input === 'true';
    const numeric = Number(input);
    if (input.trim() && Number.isFinite(numeric)) return numeric;
    try { return JSON.parse(input); } catch { return input; }
}

function pick(source, keys) {
    return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, key === 'limit' ? number(source[key]) : source[key]]));
}

function usage() {
    return `iptvctl <group> <command> [options]\n\nGroups: player, channels, epg, favorites, follows, recording, settings, diagnostics, navigate, tokens, events\n\nGlobal options: --url URL --token TOKEN --json --jsonl --quiet --verbose --dry-run --confirm\nExamples: iptvctl player state --json | iptvctl channels switch --number 12 | iptvctl diagnostics screenshot | iptvctl follows follow epg "The Office"`;
}
