#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createAgentControlClient, EXIT_CODES, resultExitCode } from '../../agent-control/src/client.mjs';

const BOOLEAN_FLAGS = new Set(['json', 'jsonl', 'quiet', 'verbose', 'dry-run', 'confirm', 'help', 'next']);
const VALUE_FLAGS = new Set(['url', 'token', 'timeout-ms', 'correlation-id', 'number', 'query', 'limit', 'label', 'scopes', 'expires-at', 'index', 'app-path']);
const DEFAULT_APP_PATH = path.resolve(
    process.env.CARBONCAST_HOME?.trim() || process.cwd(),
    'dist',
    'executables',
    'win-unpacked',
    'CarbonCast IPTV.exe'
);
const APP_LAUNCH_READY_TIMEOUT_MS = 60_000;
const APP_LAUNCH_POLL_MS = 500;

async function main() {
    let flags;
    let positionals;
    let output;
    try {
        ({ flags, positionals } = parseArgs(process.argv.slice(2)));
        output = createOutput(flags);

        if (!positionals.length || flags.help) {
            output.text(usage());
            process.exitCode = positionals.length ? EXIT_CODES.OK : EXIT_CODES.USAGE;
            return;
        }

        const timeoutMs = flags.timeoutMs === undefined
            ? undefined
            : positiveInteger(flags.timeoutMs, '--timeout-ms');
        const client = createAgentControlClient({ baseUrl: flags.url, token: flags.token, timeoutMs });

        if (positionals[0] === 'events') {
            ensure(positionals.length === 1, 'events does not accept a subcommand.');
            // Events are structured output; make the safe streaming format the default.
            if (!flags.json && !flags.jsonl && !flags.quiet) flags.jsonl = true;
            // Ctrl-C on a long-lived stream is a normal way to stop, not a
            // failure: close the reader and exit 0 instead of tearing down mid-frame.
            const stop = new AbortController();
            const interrupt = () => stop.abort();
            process.once('SIGINT', interrupt);
            process.once('SIGTERM', interrupt);
            output.debug(`streaming events from ${flags.url || 'the default bridge URL'}`);
            const result = await client.subscribeEvents((event) => output.result(event), { signal: stop.signal });
            process.off('SIGINT', interrupt);
            process.off('SIGTERM', interrupt);
            process.exitCode = resultExitCode(result);
            return;
        }

        const command = parseCommand(positionals, flags);
        if (flags.dryRun && command.write) {
            output.result({ dryRun: true, operation: command.operation, params: command.params });
            process.exitCode = EXIT_CODES.OK;
            return;
        }

        output.debug(`${command.operation} ${JSON.stringify(command.params)}`);
        const result = await command.run(client);
        output.result(result);
        process.exitCode = resultExitCode(result);
    } catch (error) {
        const reporter = output || createOutput({});
        if (error instanceof UsageError) {
            reporter.error(`Usage error: ${error.message}\n\n${usage()}`);
            process.exitCode = EXIT_CODES.USAGE;
            return;
        }
        // Anything else is a fault in iptvctl itself. Reporting it as a usage
        // error sent operators hunting for a typo that was never there.
        reporter.error(`iptvctl failed: ${error instanceof Error ? error.message : String(error)}`);
        if (flags?.verbose && error instanceof Error) reporter.error(error.stack ?? '');
        process.exitCode = EXIT_CODES.INTERNAL;
    }
}

function parseCommand(args, flags) {
    const [area, action, ...rest] = args;
    const routed = (operation, params, write, run) => ({ operation, params, write, run });
    const command = (operation, params = {}, write = true) => {
        const confirmed = { ...params, ...(write && flags.confirm ? { confirm: true } : {}) };
        return routed(operation, confirmed, write, (control) => control.command(operation, confirmed, flags.correlationId));
    };
    const read = (operation, run) => routed(operation, {}, false, run);
    const noArguments = () => ensure(rest.length === 0, `${area} ${action} does not accept arguments.`);

    if (area === 'health') {
        ensure(action === undefined, 'health does not accept a subcommand.');
        return read('health', (control) => control.health());
    }
    if (area === 'player') {
        if (action === 'state') { noArguments(); return read('player.state', (control) => control.getState()); }
        if (['play', 'pause', 'stop', 'pip'].includes(action)) { noArguments(); return command(action === 'pip' ? 'player.togglePictureInPicture' : `player.${action}`); }
        if (action === 'volume') return command('player.setVolume', { volume: boundedNumber(rest, 'volume', 0, 1) });
        if (action === 'mute') return command('player.setMuted', { muted: strictBoolean(one(rest, 'muted')) });
        if (action === 'seek') return command('player.seek', { seconds: boundedNumber(rest, 'seconds', 0) });
        if (action === 'fullscreen') return command('player.setFullscreen', { fullscreen: strictBoolean(one(rest, 'fullscreen')) });
    }
    if (area === 'channels') {
        if (action === 'list') {
            noArguments();
            const params = {};
            if (flags.query !== undefined) params.query = String(flags.query);
            if (flags.limit !== undefined) params.limit = positiveInteger(flags.limit, '--limit', 200);
            return command('channel.list', params, false);
        }
        if (action === 'next' || action === 'previous') { noArguments(); return command(`channel.${action}`); }
        if (action === 'switch') {
            ensure(!(flags.number !== undefined && rest.length > 0), 'channels switch accepts either CHANNEL_ID or --number N, not both.');
            if (flags.number !== undefined) return command('channel.switch', { number: positiveInteger(flags.number, '--number') });
            return command('channel.switch', { channelId: one(rest, 'channel ID') });
        }
    }
    if (area === 'epg') {
        if (action === 'now') { noArguments(); return command('epg.getNowNext', {}, false); }
        if (action === 'refresh') { noArguments(); return command('epg.refresh'); }
    }
    if (area === 'favorites') {
        if (action === 'list') { noArguments(); return command('favorite.list', {}, false); }
        if (action === 'set') {
            ensure(rest.length === 2, 'favorites set requires CHANNEL_ID and a boolean value.');
            return command('favorite.set', { channelId: required(rest[0], 'channel ID'), favorite: strictBoolean(rest[1]) });
        }
    }
    if (area === 'follows') {
        if (action === 'list') { noArguments(); return command('follow.list', {}, false); }
        if (action === 'follow') {
            ensure(rest.length >= 2, 'follows follow requires SOURCE and TITLE.');
            return command('follow.set', { source: required(rest[0], 'source'), title: required(rest.slice(1).join(' '), 'title') });
        }
        if (action === 'unfollow') return command('follow.set', { seriesId: one(rest, 'series ID'), followed: false });
        if (action === 'auto-switch') {
            ensure(rest.length === 2, 'follows auto-switch requires BROADCAST_ID and a boolean value.');
            return command('follow.setAutoSwitch', { broadcastId: required(rest[0], 'broadcast ID'), enabled: strictBoolean(rest[1]) });
        }
    }
    if (area === 'recording' && ['start', 'stop'].includes(action)) { noArguments(); return command(`recording.${action}`); }
    if (area === 'settings') {
        if (action === 'get') { noArguments(); return command('settings.get', {}, false); }
        if (action === 'set') {
            ensure(rest.length >= 2, 'settings set requires a key and value.');
            const key = required(rest[0], 'setting key');
            ensure(['mirrorLayout', 'showCaptions', 'webPlayerSharedControls', 'playerControls'].includes(key), `Unsupported setting: ${key}.`);
            return command('settings.update', { [key]: value(rest.slice(1).join(' ')) });
        }
    }
    if (area === 'diagnostics' && action === 'get') { noArguments(); return command('diagnostics.get', {}, false); }
    // Read-only: the main process captures the window and writes the file, so
    // it still answers when the renderer is wedged.
    if (area === 'diagnostics' && action === 'screenshot') { noArguments(); return command('diagnostics.screenshot', {}, false); }
    if (area === 'navigate') {
        ensure(rest.length === 0, 'navigate accepts one internal absolute route.');
        const route = required(action, 'route');
        ensure(
            route.startsWith('/') && !route.startsWith('//') && !/^\/[\\]/.test(route) && !route.includes('://'),
            'route must be an internal absolute route such as /workspace/dashboard.'
        );
        return command('app.navigate', { route });
    }
    if (area === 'app') {
        if (action === 'launch') {
            ensure(rest.length === 0, 'app launch does not accept positional arguments.');
            const appPath = flags.appPath || process.env.CARBONCAST_APP_PATH || DEFAULT_APP_PATH;
            ensure(appPath, 'app launch could not resolve the desktop app path. Pass --app-path or set CARBONCAST_APP_PATH.');
            const params = { appPath, ...(flags.confirm ? { confirm: true } : {}) };
            return routed('app.launch', params, true, async (control) => {
                const initial = await control.health();
                if (initial?.ready) {
                    return { success: true, operation: 'app.launch', state: { launched: false, alreadyRunning: true, ready: true } };
                }

                // A bridge that answers `ready:false` is already booting the
                // desktop renderer. Starting again risks a second process and
                // splits state, so wait for the same bridge instead.
                if (!bridgeIsUnreachable(initial)) {
                    const ready = await waitForBridgeReady(control);
                    if (ready) {
                        return { success: true, operation: 'app.launch', state: { launched: false, alreadyRunning: true, ready: true } };
                    }
                    return {
                        success: false,
                        operation: 'app.launch',
                        state: { launched: false, ready: false },
                        error: {
                            code: 'renderer-unavailable',
                            message: 'The bridge is reachable but the renderer did not become ready within 60s.',
                            retryable: true,
                        },
                    };
                }

                let pid;
                try {
                    pid = await launchDesktopApp(appPath);
                } catch (error) {
                    return {
                        success: false,
                        operation: 'app.launch',
                        state: { launched: false, ready: false },
                        error: {
                            code: 'agent-control-unavailable',
                            message: `Could not launch CarbonCast IPTV: ${error instanceof Error ? error.message : String(error)}`,
                            retryable: true,
                        },
                    };
                }
                if (await waitForBridgeReady(control)) {
                    return { success: true, operation: 'app.launch', state: { launched: true, pid, ready: true } };
                }
                return {
                    success: false,
                    operation: 'app.launch',
                    state: { launched: true, pid, ready: false },
                    error: {
                        code: 'renderer-timeout',
                        message: `Launched CarbonCast IPTV but the bridge did not report ready within 60s.`,
                        retryable: true,
                    },
                };
            });
        }
        if (action === 'quit') {
            ensure(rest.length === 0, 'app quit does not accept positional arguments.');
            return command('app.quit');
        }
        if (action === 'display') {
            ensure(rest.length === 1, 'app display requires a subcommand (list or move).');
            const sub = required(rest[0], 'app display subcommand');
            if (sub === 'list') return command('app.display.list', {}, false);
            if (sub === 'move') {
                ensure(
                    !(flags.next && flags.index !== undefined),
                    'app display move accepts either --next or --index N, not both.'
                );
                if (flags.next) return command('app.display.move', { next: true });
                if (flags.index !== undefined) {
                    return command('app.display.move', {
                        index: positiveInteger(flags.index, '--index'),
                    });
                }
                throw new UsageError('app display move requires --next or --index N.');
            }
            throw new UsageError(`Unknown app display subcommand: ${sub}. Available: list, move.`);
        }
        if (action === 'window') {
            ensure(rest.length >= 1, 'app window requires a subcommand (fullscreen, minimize, or restore).');
            const sub = required(rest[0], 'app window subcommand');
            if (sub === 'fullscreen') {
                ensure(rest.length === 2, 'app window fullscreen requires true or false.');
                return command('app.window.set', {
                    state: strictBoolean(rest[1]) ? 'fullscreen' : 'normal',
                });
            }
            if (sub === 'minimize') {
                ensure(rest.length === 1, 'app window minimize does not accept arguments.');
                return command('app.window.set', { state: 'minimized' });
            }
            if (sub === 'restore') {
                ensure(rest.length === 1, 'app window restore does not accept arguments.');
                return command('app.window.set', { state: 'normal' });
            }
            throw new UsageError(`Unknown app window subcommand: ${sub}. Available: fullscreen, minimize, restore.`);
        }
        throw new UsageError(
            `Unknown app command: ${action ?? '(none)'}. Available: launch, quit, display (list|move), window (fullscreen|minimize|restore).`
        );
    }
    if (area === 'tokens') {
        if (action === 'list') { noArguments(); return read('token.list', (control) => control.listTokens()); }
        if (action === 'create') {
            noArguments();
            const scopes = String(flags.scopes || '').split(',').map((scope) => scope.trim()).filter(Boolean);
            ensure(scopes.length > 0, 'tokens create requires --scopes SCOPE[,SCOPE].');
            if (flags.expiresAt !== undefined) ensure(!Number.isNaN(Date.parse(flags.expiresAt)), '--expires-at must be an ISO timestamp.');
            const params = { label: flags.label || 'iptvctl token', scopes, ...(flags.expiresAt ? { expiresAt: flags.expiresAt } : {}) };
            return routed('token.create', params, true, (control) => control.createToken(params));
        }
        if (action === 'revoke') {
            const tokenId = one(rest, 'token ID');
            return routed('token.revoke', { tokenId }, true, (control) => control.revokeToken(tokenId));
        }
        if (action === 'rotate') {
            const tokenId = one(rest, 'token ID');
            return routed('token.rotate', { tokenId }, true, (control) => control.rotateToken(tokenId));
        }
    }
    // Distinguish "no such group" from "that group has no such command", and
    // name the commands that group does have.
    const actions = GROUP_ACTIONS[area];
    if (actions) {
        throw new UsageError(
            `Unknown ${area} command: ${action ?? '(none)'}. Available: ${actions.join(', ')}.`
        );
    }
    throw new UsageError(
        `Unknown command group: ${area}. Available: ${Object.keys(GROUP_ACTIONS).join(', ')}.`
    );
}

function bridgeIsUnreachable(result) {
    return result?.success === false && [
        'agent-control-unavailable',
        'renderer-timeout',
    ].includes(result.error?.code);
}

async function waitForBridgeReady(control) {
    const deadline = Date.now() + APP_LAUNCH_READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, APP_LAUNCH_POLL_MS));
        const poll = await control.health();
        if (poll?.ready) return true;
    }
    return false;
}

function launchDesktopApp(appPath) {
    return new Promise((resolve, reject) => {
        let child;
        try {
            child = spawn(appPath, [], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
                cwd: path.dirname(appPath) || process.cwd(),
            });
        } catch (error) {
            reject(error);
            return;
        }
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve(child.pid ?? null);
        });
    });
}

const GROUP_ACTIONS = {
    health: [],
    player: ['state', 'play', 'pause', 'stop', 'pip', 'volume', 'mute', 'seek', 'fullscreen'],
    channels: ['list', 'switch', 'next', 'previous'],
    epg: ['now', 'refresh'],
    favorites: ['list', 'set'],
    follows: ['list', 'follow', 'unfollow', 'auto-switch'],
    recording: ['start', 'stop'],
    settings: ['get', 'set'],
    diagnostics: ['get', 'screenshot'],
    navigate: ['<route>'],
    app: ['launch', 'quit', 'display (list|move)', 'window (fullscreen|minimize|restore)'],
    tokens: ['list', 'create', 'revoke', 'rotate'],
    events: [],
};

function parseArgs(args) {
    const flags = {};
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--') {
            positionals.push(...args.slice(index + 1));
            break;
        }
        if (!arg.startsWith('--')) {
            positionals.push(arg);
            continue;
        }
        const equalsIndex = arg.indexOf('=');
        const key = arg.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
        const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if (BOOLEAN_FLAGS.has(key)) {
            ensure(equalsIndex === -1, `--${key} does not take a value.`);
            flags[camelKey] = true;
            continue;
        }
        ensure(VALUE_FLAGS.has(key), `Unknown option: --${key}.`);
        const input = equalsIndex === -1 ? args[++index] : arg.slice(equalsIndex + 1);
        ensure(input !== undefined && input !== '' && !input.startsWith('--'), `--${key} requires a value.`);
        flags[camelKey] = input;
    }
    return { flags, positionals };
}

function createOutput(flags) {
    return {
        result(value) {
            if (flags.json || flags.jsonl) {
                if (!flags.quiet) process.stdout.write(`${JSON.stringify(value)}\n`);
                return;
            }
            // A failed operation belongs on stderr even under --quiet: a script
            // that suppresses chatter still needs to see why a write failed.
            if (value?.success === false) return process.stderr.write(`${plain(value)}\n`);
            if (!flags.quiet) process.stdout.write(`${plain(value)}\n`);
        },
        text(value) {
            if (!flags.quiet) process.stdout.write(`${value}\n`);
        },
        error(value) {
            process.stderr.write(`${value}\n`);
        },
        debug(value) {
            if (flags.verbose) process.stderr.write(`[iptvctl] ${value}\n`);
        },
    };
}

function plain(value) {
    if (value?.success === false) {
        const retry = value.error?.retryable ? ' (retryable)' : '';
        return `${value.error?.code || 'failed'}${retry}: ${value.error?.message || 'Operation failed.'}`;
    }
    if (value?.success === true) return `${value.operation || 'operation'}: success`;
    return JSON.stringify(value, null, 2);
}

function one(values, label) {
    ensure(values.length === 1, `${label} is required.`);
    return required(values[0], label);
}

function required(input, label) {
    ensure(typeof input === 'string' && input.trim().length > 0, `${label} is required.`);
    return input;
}

function boundedNumber(values, label, minimum, maximum = Number.MAX_SAFE_INTEGER) {
    const input = one(values, label);
    const result = Number(input);
    ensure(Number.isFinite(result) && result >= minimum && result <= maximum, `${label} must be a number between ${minimum} and ${maximum}.`);
    return result;
}

function positiveInteger(input, label, maximum = Number.MAX_SAFE_INTEGER) {
    const result = Number(input);
    ensure(Number.isInteger(result) && result >= 1 && result <= maximum, `${label} must be an integer between 1 and ${maximum}.`);
    return result;
}

function strictBoolean(input) {
    const normalized = String(input).toLowerCase();
    if (['true', '1', 'on'].includes(normalized)) return true;
    if (['false', '0', 'off'].includes(normalized)) return false;
    throw new UsageError('Boolean values must be true/false, 1/0, or on/off.');
}

function value(input) {
    if (input === 'true' || input === 'false') return input === 'true';
    const numeric = Number(input);
    if (input.trim() && Number.isFinite(numeric)) return numeric;
    try { return JSON.parse(input); } catch { return input; }
}

function ensure(condition, message) {
    if (!condition) throw new UsageError(message);
}

class UsageError extends Error {}

function usage() {
    return `iptvctl <group> <command> [options]\n\nGroups: health, player, channels, epg, favorites, follows, recording, settings, diagnostics, navigate, app, tokens, events\n\nGlobal options: --url URL --token TOKEN --timeout-ms MS --correlation-id ID --json --jsonl --quiet --verbose --dry-run --confirm\n\nHealth is public; live control requires IPTVNATOR_AGENT_TOKEN. Use --dry-run before writes, then retry a timed-out write with the same --correlation-id.\n\nExamples: iptvctl health --json | iptvctl player state --json | iptvctl channels switch --number 12 --dry-run | iptvctl app display move --next --confirm | iptvctl app window fullscreen true --confirm | iptvctl player pause --correlation-id pause-001 --confirm`;
}

await main();
