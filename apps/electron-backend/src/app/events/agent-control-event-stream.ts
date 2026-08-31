/**
 * Fan-out for the agent-control event feed.
 *
 * Two audiences receive the same redacted frames:
 *
 * - SSE subscribers on `GET /events`, the CLI's `iptvctl events`.
 * - The renderer itself, over `AGENT_CONTROL_EVENT` IPC, which is how the
 *   agent-presence indicator knows a command is running without being taught
 *   about HTTP or credentials.
 *
 * Split out of `agent-control.events.ts` so that file stays inside the
 * workspace's 400-line ESLint ceiling; subscriber bookkeeping is a self
 * contained concern with no need for the bridge's auth or command state.
 */

import { BrowserWindow } from 'electron';
import * as http from 'node:http';
import type { AgentControlEvent } from '@iptvnator/shared/interfaces';
import { sanitize } from './agent-control-redact';

/**
 * SSE dies silently behind idle-timeout proxies and sleeping NICs. A comment
 * frame is ignored by every conforming client but keeps the socket accounted
 * for, and a failed write is how a dropped subscriber is noticed at all.
 */
export const EVENT_HEARTBEAT_MS = 25_000;

export class AgentControlEventStream {
    private readonly subscribers = new Map<
        http.ServerResponse,
        ReturnType<typeof setInterval>
    >();

    /**
     * Register an SSE subscriber and send it the current state immediately, so
     * a client that connects mid-session is not blind until the next change.
     */
    open(res: http.ServerResponse, initialState: unknown): void {
        res.writeHead(200, {
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Content-Type': 'text/event-stream',
            'X-Accel-Buffering': 'no',
        });
        res.write(`event: state.changed\ndata: ${JSON.stringify(initialState)}\n\n`);

        const heartbeat = setInterval(() => {
            try {
                res.write(': heartbeat\n\n');
            } catch {
                this.drop(res);
            }
        }, EVENT_HEARTBEAT_MS);
        // Timers keep the event loop alive; an SSE subscriber must not be the
        // reason the process refuses to exit.
        heartbeat.unref?.();
        this.subscribers.set(res, heartbeat);
    }

    drop(res: http.ServerResponse): void {
        const heartbeat = this.subscribers.get(res);
        if (heartbeat) clearInterval(heartbeat);
        this.subscribers.delete(res);
    }

    publish(event: AgentControlEvent): void {
        const sanitized = sanitize(event) as AgentControlEvent;

        for (const window of BrowserWindow.getAllWindows()) {
            try {
                if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
                    window.webContents.send('AGENT_CONTROL_EVENT', sanitized);
                }
            } catch {
                // A window can disappear between the destroyed check and the
                // IPC send. SSE delivery below must continue regardless.
            }
        }

        if (!this.subscribers.size) return;
        const line = `event: ${sanitized.type}\ndata: ${JSON.stringify(sanitized)}\n\n`;
        for (const response of [...this.subscribers.keys()]) {
            try {
                response.write(line);
            } catch {
                this.drop(response);
            }
        }
    }
}
