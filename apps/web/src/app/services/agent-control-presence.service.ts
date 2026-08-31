import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { AgentControlEvent } from '@iptvnator/shared/interfaces';

export const AGENT_COMMAND_PULSE_MS = 180;

export type AgentPresenceSurface = 'player' | 'library' | 'window' | 'shell';

/**
 * Mirrors the bridge's redacted event stream into a deliberately small piece
 * of UI feedback. The bridge is authoritative: no renderer command needs to
 * guess whether it was issued by an agent or a local button click.
 */
@Injectable({ providedIn: 'root' })
export class AgentControlPresenceService {
    readonly connected = signal(false);
    readonly activeSurface = signal<AgentPresenceSurface | null>(null);

    private readonly destroyRef = inject(DestroyRef);
    private started = false;
    private pulseTimer: ReturnType<typeof setTimeout> | null = null;
    private lastPulseCorrelationId: string | null = null;

    start(): void {
        if (this.started || !window.electron?.onAgentControlEvent) return;
        this.started = true;
        const unsubscribe = window.electron.onAgentControlEvent((event) =>
            this.handle(event)
        );
        this.destroyRef.onDestroy(() => {
            unsubscribe();
            if (this.pulseTimer) clearTimeout(this.pulseTimer);
            this.pulseTimer = null;
            this.clearBodyPulse();
            this.started = false;
        });
    }

    private handle(event: AgentControlEvent): void {
        // The first mirrored state event proves the renderer can hear the
        // bridge. Keep the indicator visible for the rest of the session so
        // the user does not have to infer whether agent control is available.
        this.connected.set(true);

        const command = event.state?.agentCommand;
        if (!command || command.correlationId === this.lastPulseCorrelationId) {
            return;
        }
        this.lastPulseCorrelationId = command.correlationId;
        this.pulse(surfaceFor(command.operation));
    }

    private pulse(surface: AgentPresenceSurface): void {
        this.clearBodyPulse();
        this.activeSurface.set(surface);
        const className = pulseClass(surface);
        // Reflow is intentional: a second agent command can target the same
        // surface before the prior 180ms polish window has elapsed.
        void document.body.offsetWidth;
        document.body.classList.add(className);
        this.pulseTimer = setTimeout(() => {
            this.clearBodyPulse();
            this.activeSurface.set(null);
            this.pulseTimer = null;
        }, AGENT_COMMAND_PULSE_MS);
    }

    private clearBodyPulse(): void {
        for (const surface of ['player', 'library', 'window', 'shell'] as const) {
            document.body.classList.remove(pulseClass(surface));
        }
    }
}

function pulseClass(surface: AgentPresenceSurface): string {
    return `agent-command-pulse--${surface}`;
}

function surfaceFor(operation: string): AgentPresenceSurface {
    if (operation.startsWith('player.')) return 'player';
    if (
        operation.startsWith('channel.') ||
        operation.startsWith('epg.') ||
        operation.startsWith('favorite.') ||
        operation.startsWith('follow.')
    ) {
        return 'library';
    }
    if (operation.startsWith('app.window.') || operation.startsWith('app.display.')) {
        return 'window';
    }
    return 'shell';
}
