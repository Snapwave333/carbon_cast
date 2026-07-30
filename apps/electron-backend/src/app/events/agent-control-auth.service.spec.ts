import type * as http from 'node:http';

const records: unknown[] = [];
const mockStoreGet = jest.fn(() => records);
const mockStoreSet = jest.fn((_key: string, value: unknown[]) => {
    records.splice(0, records.length, ...value);
});

jest.mock('../services/store.service', () => ({
    AGENT_CONTROL_TOKENS: 'AGENT_CONTROL_TOKENS',
    store: { get: mockStoreGet, set: mockStoreSet },
}));

import { AgentControlAuthService } from './agent-control-auth.service';

const request = (token?: string) =>
    ({
        headers: token ? { authorization: `Bearer ${token}` } : {},
    }) as http.IncomingMessage;

describe('AgentControlAuthService', () => {
    const bootstrapToken = 'bootstrap-token-must-have-at-least-24-characters';
    const originalToken = process.env.IPTVNATOR_AGENT_TOKEN;

    beforeEach(() => {
        records.splice(0, records.length);
        mockStoreGet.mockClear();
        mockStoreSet.mockClear();
        process.env.IPTVNATOR_AGENT_TOKEN = bootstrapToken;
        delete process.env.IPTVNATOR_AGENT_TOKEN_EXPIRES_AT;
    });

    afterAll(() => {
        if (originalToken === undefined) delete process.env.IPTVNATOR_AGENT_TOKEN;
        else process.env.IPTVNATOR_AGENT_TOKEN = originalToken;
    });

    it('imports a hashed all-scope bootstrap token and authorizes it', () => {
        const auth = new AgentControlAuthService();
        auth.importBootstrapToken();

        const stored = records[0] as { tokenHash: string; scopes: string[] };
        expect(stored.tokenHash).not.toContain(bootstrapToken);
        expect(stored.scopes).toContain('tokens.manage');
        expect(auth.authorize(request(bootstrapToken), 'state.read')).toEqual(
            expect.objectContaining({ scopes: expect.arrayContaining(['state.read']) })
        );
    });

    it('returns a raw generated token once while persisting only a hash', () => {
        const auth = new AgentControlAuthService();
        auth.importBootstrapToken();

        const created = auth.create({
            label: 'MCP',
            scopes: ['state.read', 'player.control'],
        });

        if (!('token' in created)) throw new Error('Expected token creation.');
        expect(created.token).toMatch(/^iptv_/);
        expect(records.some((record) => JSON.stringify(record).includes(created.token))).toBe(false);
        expect(auth.authorize(request(created.token), 'player.control')).toEqual(
            expect.objectContaining({ id: created.record.id })
        );
    });

    it('enforces scopes, revocation, and the control rate limit', () => {
        const auth = new AgentControlAuthService();
        const created = auth.create({ scopes: ['state.read'] });
        if (!('token' in created)) throw new Error('Expected token creation.');
        const checked = auth.authorize(request(created.token), 'player.control');
        expect('code' in checked && checked.code).toBe('authorization-denied');

        const checkedRead = auth.authorize(request(created.token), 'state.read');
        if ('code' in checkedRead) throw new Error('Expected read authorization.');
        for (let index = 0; index < 30; index += 1) {
            expect(auth.consumeRateLimit(checkedRead, true)).toBeNull();
        }
        expect(auth.consumeRateLimit(checkedRead, true)).toBeGreaterThan(0);

        auth.revoke(created.record.id);
        const revoked = auth.authorize(request(created.token), 'state.read');
        expect('code' in revoked && revoked.code).toBe('token-revoked');
    });
});
