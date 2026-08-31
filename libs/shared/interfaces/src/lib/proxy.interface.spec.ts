import {
    ALWAYS_BYPASSED_HOSTS,
    buildProxyBypassRules,
    buildProxyRules,
    DEFAULT_PROXY_SETTINGS,
    isProxyUsable,
    normalizeProxySettings,
    redactProxySettings,
} from './proxy.interface';

describe('normalizeProxySettings', () => {
    it('falls back to defaults for missing or malformed input', () => {
        expect(normalizeProxySettings(null)).toEqual(DEFAULT_PROXY_SETTINGS);
        expect(
            normalizeProxySettings({ protocol: 'carrier-pigeon', port: 'abc' })
        ).toMatchObject({
            protocol: DEFAULT_PROXY_SETTINGS.protocol,
            port: DEFAULT_PROXY_SETTINGS.port,
        });
    });

    it('strips a pasted scheme from the host', () => {
        // Users paste the whole endpoint; the protocol has its own field, so
        // keeping the scheme would produce a host that cannot resolve.
        expect(normalizeProxySettings({ host: 'socks5://10.64.0.1' }).host).toBe(
            '10.64.0.1'
        );
        expect(normalizeProxySettings({ host: '  proxy.example  ' }).host).toBe(
            'proxy.example'
        );
    });

    it.each([0, 65536, -1, 1.5])('rejects the out-of-range port %s', (port) => {
        expect(normalizeProxySettings({ port }).port).toBe(
            DEFAULT_PROXY_SETTINGS.port
        );
    });

    it('keeps a password verbatim, including surrounding whitespace', () => {
        // Trimming a password silently breaks a legitimate credential.
        expect(normalizeProxySettings({ password: '  hunter2 ' }).password).toBe(
            '  hunter2 '
        );
    });
});

describe('buildProxyRules', () => {
    it('returns null when the proxy is off or has no host', () => {
        expect(buildProxyRules(normalizeProxySettings({ host: 'a' }))).toBeNull();
        expect(
            buildProxyRules(normalizeProxySettings({ enabled: true, host: '' }))
        ).toBeNull();
    });

    it('builds a Chromium rules string', () => {
        expect(
            buildProxyRules(
                normalizeProxySettings({
                    enabled: true,
                    protocol: 'socks5',
                    host: '10.64.0.1',
                    port: 1080,
                })
            )
        ).toBe('socks5://10.64.0.1:1080');
    });

    it('brackets an IPv6 host so the port stays parseable', () => {
        expect(
            buildProxyRules(
                normalizeProxySettings({
                    enabled: true,
                    protocol: 'http',
                    host: '2001:db8::1',
                    port: 8080,
                })
            )
        ).toBe('http://[2001:db8::1]:8080');
    });

    it('never places credentials in the rules string', () => {
        // Chromium ignores userinfo there and the URL reaches logs verbatim.
        const rules = buildProxyRules(
            normalizeProxySettings({
                enabled: true,
                host: 'proxy.example',
                username: 'agent',
                password: 'hunter2',
            })
        );
        expect(rules).not.toContain('agent');
        expect(rules).not.toContain('hunter2');
    });
});

describe('buildProxyBypassRules', () => {
    it('always bypasses loopback and private ranges', () => {
        const rules = buildProxyBypassRules(normalizeProxySettings({}));
        for (const host of ALWAYS_BYPASSED_HOSTS.split(',')) {
            expect(rules).toContain(host);
        }
    });

    it('merges configured hosts without duplicating the defaults', () => {
        const rules = buildProxyBypassRules(
            normalizeProxySettings({ bypassList: 'example.com; localhost ,' })
        );
        expect(rules.split(',').filter((e) => e === 'localhost')).toHaveLength(1);
        expect(rules).toContain('example.com');
    });
});

describe('isProxyUsable / redactProxySettings', () => {
    it('needs both the toggle and a host', () => {
        expect(isProxyUsable(normalizeProxySettings({ enabled: true }))).toBe(
            false
        );
        expect(
            isProxyUsable(
                normalizeProxySettings({ enabled: true, host: 'proxy.example' })
            )
        ).toBe(true);
    });

    it('redacts a set password but does not invent one', () => {
        expect(
            redactProxySettings(normalizeProxySettings({ password: 'hunter2' }))
                .password
        ).toBe('[redacted]');
        expect(
            redactProxySettings(normalizeProxySettings({})).password
        ).toBe('');
    });
});
