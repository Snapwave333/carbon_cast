import { AGENT_CONTROL_SCOPES } from '@iptvnator/shared/interfaces';
import type {
    AgentControlOperation,
    AgentControlScope,
} from '@iptvnator/shared/interfaces';

import {
    isControlOperation,
    operationScopes,
} from './agent-control-operations';


describe('agent-control rate-limit metering', () => {
    it('meters read-only operations against the read budget', () => {
        // Every operation arrives on POST /command, so hardcoding "control"
        // here spent the 30/min control budget on `channel.list` calls.
        const reads: AgentControlOperation[] = [
            'player.getState',
            'channel.list',
            'epg.getNowNext',
            'favorite.list',
            'follow.list',
            'settings.get',
            'diagnostics.get',
        ];

        for (const operation of reads) {
            expect(isControlOperation(operation)).toBe(false);
        }
    });

    it('meters mutating operations against the control budget', () => {
        const writes: AgentControlOperation[] = [
            'player.pause',
            'player.setVolume',
            'channel.switch',
            'epg.refresh',
            'favorite.set',
            'follow.set',
            'recording.start',
            'settings.update',
            'app.navigate',
        ];

        for (const operation of writes) {
            expect(isControlOperation(operation)).toBe(true);
        }
    });

    it('meters diagnostics.screenshot as control despite its read scope', () => {
        // It captures the window and writes a file, so the read budget would
        // make it a disk-fill vector.
        expect(operationScopes['diagnostics.screenshot']).toBe('diagnostics.read');
        expect(isControlOperation('diagnostics.screenshot')).toBe(true);
    });

    it('classifies every mapped operation from a known scope', () => {
        for (const [operation, scope] of Object.entries(operationScopes)) {
            expect(AGENT_CONTROL_SCOPES).toContain(scope as AgentControlScope);
            expect(typeof isControlOperation(operation as AgentControlOperation)).toBe(
                'boolean'
            );
        }
    });
});
