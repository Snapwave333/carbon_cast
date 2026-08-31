/**
 * Proxy configuration for the built-in players' network stack.
 *
 * This routes Chromium's session — which is what fetches HLS/DASH manifests and
 * segments — through a proxy, so a geo-restricted stream resolves from the
 * proxy's exit country instead of the machine's. It is deliberately *not* a
 * VPN: only CarbonCast IPTV's own requests are affected, and the rest of the
 * system keeps its normal route.
 */
export type ProxyProtocol = 'socks5' | 'socks4' | 'http' | 'https';

export const PROXY_PROTOCOLS: readonly ProxyProtocol[] = [
    'socks5',
    'socks4',
    'http',
    'https',
];

export interface ProxySettings {
    enabled: boolean;
    protocol: ProxyProtocol;
    host: string;
    port: number;
    username: string;
    password: string;
    /**
     * Chromium bypass list, comma or semicolon separated. Loopback and private
     * ranges are always appended so a proxy can never swallow the local
     * agent-control bridge or a LAN playlist host.
     */
    bypassList: string;
}

export type ProxySettingsInput = Partial<
    Record<keyof ProxySettings, unknown>
> | null;

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
    enabled: false,
    protocol: 'socks5',
    host: '',
    port: 1080,
    username: '',
    password: '',
    bypassList: '',
};

/**
 * Always bypassed, appended to whatever the user configured. Routing loopback
 * through a proxy would break the agent-control bridge and the remote-control
 * server, and sending private-range requests to a remote proxy would leak the
 * shape of the local network.
 */
export const ALWAYS_BYPASSED_HOSTS =
    '<local>,localhost,127.0.0.1,[::1],10.0.0.0/8,172.16.0.0/12,192.168.0.0/16';

/** Outcome of dialling a proxy from the main process. */
export interface ProxyTestResult {
    ok: boolean;
    /** Exit IP the streams will appear to come from. Absent on failure. */
    ip?: string;
    /** ISO country of the exit node, when the probe reports one. */
    country?: string;
    error?: string;
}

const MAX_PORT = 65535;

function text(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
}

export function normalizeProxySettings(
    settings?: ProxySettingsInput
): ProxySettings {
    const source = settings ?? {};
    const port = Number(source.port);
    const protocol = source.protocol as ProxyProtocol;

    return {
        enabled: source.enabled === true,
        protocol: PROXY_PROTOCOLS.includes(protocol)
            ? protocol
            : DEFAULT_PROXY_SETTINGS.protocol,
        // Strip a pasted scheme so "socks5://10.64.0.1" does not become a host
        // named "socks5://10.64.0.1"; the protocol has its own field.
        host: text(source.host).replace(/^[a-z0-9+.-]+:\/\//i, ''),
        port:
            Number.isInteger(port) && port >= 1 && port <= MAX_PORT
                ? port
                : DEFAULT_PROXY_SETTINGS.port,
        username: text(source.username),
        password: typeof source.password === 'string' ? source.password : '',
        bypassList: text(source.bypassList),
    };
}

/** True when the settings describe a proxy that can actually be dialled. */
export function isProxyUsable(settings: ProxySettings): boolean {
    return settings.enabled && settings.host.length > 0;
}

/**
 * Chromium `proxyRules` string, or `null` when the proxy is off or incomplete.
 * Credentials are never placed in the rules — Chromium ignores them there and
 * they would end up in logs. They are supplied through the `login` event.
 */
export function buildProxyRules(settings: ProxySettings): string | null {
    if (!isProxyUsable(settings)) return null;
    const host = settings.host.includes(':')
        ? `[${settings.host.replace(/^\[|\]$/g, '')}]`
        : settings.host;
    return `${settings.protocol}://${host}:${settings.port}`;
}

export function buildProxyBypassRules(settings: ProxySettings): string {
    const configured = settings.bypassList
        .split(/[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    return [...new Set([...configured, ...ALWAYS_BYPASSED_HOSTS.split(',')])].join(
        ','
    );
}

/** Proxy settings with the password removed, for logs and IPC echoes. */
export function redactProxySettings(
    settings: ProxySettings
): Omit<ProxySettings, 'password'> & { password: string } {
    return { ...settings, password: settings.password ? '[redacted]' : '' };
}
