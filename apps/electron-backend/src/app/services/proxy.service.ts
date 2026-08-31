import { app, session } from 'electron';
import {
    buildProxyBypassRules,
    buildProxyRules,
    DEFAULT_PROXY_SETTINGS,
    isProxyUsable,
    normalizeProxySettings,
    redactProxySettings,
    type ProxySettings,
    type ProxySettingsInput,
    type ProxyTestResult,
} from '@iptvnator/shared/interfaces';
import { PROXY_SETTINGS, store } from './store.service';

/**
 * Endpoint used by the "Test connection" button to report the exit address the
 * streams will appear to come from. Chosen because it needs no key and returns
 * the country, which is the only thing that matters for a geo-block.
 */
const PROBE_URL = 'https://ipinfo.io/json';
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Applies a per-app proxy to Chromium's default session.
 *
 * This is the session that fetches HLS/DASH manifests and segments for the
 * built-in players, so it is what actually moves a geo-blocked stream to
 * another country. It is not a VPN: main-process Node fetches (playlist and
 * EPG downloads) keep their direct route, and nothing outside this app is
 * affected.
 */
export class ProxyService {
    private current: ProxySettings = { ...DEFAULT_PROXY_SETTINGS };
    private loginHandlerAttached = false;
    /**
     * Credentials for a proxy being tested but not yet saved. Chromium only
     * surfaces proxy authentication through the app-level `login` event, so a
     * test against different credentials has to hand them to that one handler.
     */
    private authOverride: ProxySettings | null = null;

    /** Re-apply the persisted proxy during startup, before any window loads. */
    async restore(): Promise<void> {
        await this.apply(store.get(PROXY_SETTINGS, undefined));
    }

    async apply(input: ProxySettingsInput | undefined): Promise<ProxySettings> {
        const settings = normalizeProxySettings(input);
        this.current = settings;
        store.set(PROXY_SETTINGS, settings);
        this.attachLoginHandler();

        const proxyRules = buildProxyRules(settings);
        console.log(
            '[proxy] applying',
            JSON.stringify(redactProxySettings(settings))
        );

        // `mode: 'direct'` rather than clearing the rules: an empty rules
        // string makes Chromium fall back to the *system* proxy, which is not
        // what "off" means here.
        await session.defaultSession.setProxy(
            proxyRules
                ? {
                      proxyRules,
                      proxyBypassRules: buildProxyBypassRules(settings),
                  }
                : { mode: 'direct' }
        );
        // Chromium keeps sockets open across a proxy change, so without this an
        // already-playing stream would continue on the previous route and the
        // change would look like it had not taken effect.
        await session.defaultSession.closeAllConnections();
        return settings;
    }

    /**
     * Dial the probe through the given proxy and report the exit address, so a
     * typo cannot be saved as a working configuration.
     */
    async test(input?: ProxySettingsInput): Promise<ProxyTestResult> {
        const settings = input ? normalizeProxySettings(input) : this.current;
        if (!isProxyUsable(settings)) {
            return { ok: false, error: 'proxy-not-configured' };
        }
        // Probe through a throwaway session so an unverified proxy is never
        // installed on the default session mid-playback.
        const probe = session.fromPartition(`proxy-test-${Date.now()}`);
        this.attachLoginHandler();
        this.authOverride = settings;
        try {
            await probe.setProxy({
                proxyRules: buildProxyRules(settings) as string,
                proxyBypassRules: buildProxyBypassRules(settings),
            });
            const response = await this.fetchWithTimeout(probe);
            if (!response.ok) {
                return { ok: false, error: `probe-http-${response.status}` };
            }
            const payload = (await response.json()) as Record<string, unknown>;
            return {
                ok: true,
                ip: typeof payload.ip === 'string' ? payload.ip : undefined,
                country:
                    typeof payload.country === 'string'
                        ? payload.country
                        : undefined,
            };
        } catch (error) {
            return {
                ok: false,
                error:
                    error instanceof Error ? error.message : 'proxy-test-failed',
            };
        } finally {
            this.authOverride = null;
            await probe.closeAllConnections().catch(() => undefined);
        }
    }

    /**
     * `Session.fetch` rather than the global `fetch`: only the former goes
     * through Chromium's stack and therefore through the proxy. Node's fetch
     * would ignore it and cheerfully report the direct connection as a pass.
     */
    private async fetchWithTimeout(probe: Electron.Session): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        try {
            return await probe.fetch(PROBE_URL, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Proxy credentials are supplied here rather than embedded in the rules
     * string: Chromium ignores userinfo in `proxyRules`, and a URL carrying a
     * password would be written to logs and crash dumps.
     */
    private attachLoginHandler(): void {
        if (this.loginHandlerAttached) return;
        this.loginHandlerAttached = true;
        app.on('login', (event, _webContents, _request, authInfo, callback) => {
            if (!authInfo.isProxy) return;
            const { username, password } = this.authOverride ?? this.current;
            if (!username) return;
            event.preventDefault();
            callback(username, password);
        });
    }
}

export const proxyService = new ProxyService();
