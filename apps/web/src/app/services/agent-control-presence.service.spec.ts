import { TestBed } from '@angular/core/testing';
import type { AgentControlEvent } from '@iptvnator/shared/interfaces';
import {
    AGENT_COMMAND_PULSE_MS,
    AgentControlPresenceService,
} from './agent-control-presence.service';

describe('AgentControlPresenceService', () => {
    let service: AgentControlPresenceService;
    let emit: (event: AgentControlEvent) => void;
    let originalElectron: PropertyDescriptor | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
        originalElectron = Object.getOwnPropertyDescriptor(window, 'electron');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                onAgentControlEvent: jest.fn((callback: (event: AgentControlEvent) => void) => {
                    emit = callback;
                    return jest.fn();
                }),
            },
        });
        TestBed.configureTestingModule({});
        service = TestBed.inject(AgentControlPresenceService);
        service.start();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
        jest.useRealTimers();
        document.body.className = '';
        if (originalElectron) Object.defineProperty(window, 'electron', originalElectron);
        else delete (window as { electron?: unknown }).electron;
    });

    it('keeps the connected badge and pulses only once for an executing command', () => {
        emit({
            type: 'state.changed',
            timestamp: '2026-08-28T12:00:00.000Z',
            state: {
                ready: true,
                updatedAt: '2026-08-28T12:00:00.000Z',
                agentCommand: {
                    operation: 'player.pause',
                    correlationId: 'agent-1',
                    startedAt: '2026-08-28T12:00:00.000Z',
                },
            },
        });

        expect(service.connected()).toBe(true);
        expect(service.activeSurface()).toBe('player');
        expect(document.body.classList.contains('agent-command-pulse--player')).toBe(true);

        emit({
            type: 'state.changed',
            timestamp: '2026-08-28T12:00:00.010Z',
            state: {
                ready: true,
                updatedAt: '2026-08-28T12:00:00.010Z',
                agentCommand: {
                    operation: 'player.pause',
                    correlationId: 'agent-1',
                    startedAt: '2026-08-28T12:00:00.000Z',
                },
            },
        });

        jest.advanceTimersByTime(AGENT_COMMAND_PULSE_MS);
        expect(service.activeSurface()).toBeNull();
        expect(document.body.className).not.toContain('agent-command-pulse');
        expect(service.connected()).toBe(true);
    });

    it('maps window and display operations to window chrome feedback', () => {
        emit({
            type: 'state.changed',
            timestamp: '2026-08-28T12:00:00.000Z',
            state: {
                ready: true,
                updatedAt: '2026-08-28T12:00:00.000Z',
                agentCommand: {
                    operation: 'app.display.move',
                    correlationId: 'agent-2',
                    startedAt: '2026-08-28T12:00:00.000Z',
                },
            },
        });

        expect(service.activeSurface()).toBe('window');
        expect(document.body.classList.contains('agent-command-pulse--window')).toBe(true);
    });
});
