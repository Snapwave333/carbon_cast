// Playback control: open a channel in the installed CarbonCast IPTV desktop app.
//
// The desktop app registers as the .m3u handler and opens a playlist passed on
// the command line (forwarding to the running instance via its single-instance
// lock). So "play a channel" = write a one-channel .m3u and launch CarbonCast IPTV
// with it. This is the server's write/control surface (no live renderer bridge
// required, works with the shipped app).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function iptvnatorAppPath() {
    if (process.env.IPTVNATOR_APP_PATH) return process.env.IPTVNATOR_APP_PATH;
    const candidates = [
        path.join(
            os.homedir(),
            'AppData',
            'Local',
            'Programs',
            'CarbonCast IPTV',
            'CarbonCast IPTV.exe'
        ),
        'C:/Program Files/CarbonCast IPTV/CarbonCast IPTV.exe',
        '/Applications/CarbonCast IPTV.app/Contents/MacOS/CarbonCast IPTV',
        path.join(
            os.homedir(),
            'AppData',
            'Local',
            'Programs',
            'iptvnator',
            'IPTVnator.exe'
        ),
        'C:/Program Files/IPTVnator/IPTVnator.exe',
        '/Applications/IPTVnator.app/Contents/MacOS/IPTVnator',
    ];
    return (
        candidates.find((p) => {
            try {
                return fs.existsSync(p);
            } catch {
                return false;
            }
        }) || null
    );
}

function m3uFor(channel) {
    const tvg = channel.tvgId ? ` tvg-id="${channel.tvgId}"` : '';
    const logo = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
    const grp = channel.group ? ` group-title="${channel.group}"` : '';
    return (
        '#EXTM3U url-tvg="https://i.mjh.nz/PlutoTV/us.xml"\n' +
        `#EXTINF:-1${tvg}${logo}${grp},${channel.name}\n${channel.url}\n`
    );
}

// Write a one-channel playlist and (unless dryRun) launch CarbonCast IPTV with it.
export function launchInIptvnator(channel, { dryRun = false } = {}) {
    const app = iptvnatorAppPath();
    const file = path.join(os.tmpdir(), 'iptvnator-mcp-play.m3u');
    fs.writeFileSync(file, m3uFor(channel), 'utf8');
    if (!app)
        return {
            launched: false,
            reason: 'CarbonCast IPTV app not found. Set IPTVNATOR_APP_PATH to the executable.',
            file,
        };
    if (dryRun) return { launched: false, dryRun: true, app, file };
    const child = spawn(app, [file], { detached: true, stdio: 'ignore' });
    child.unref();
    return { launched: true, app, file };
}
