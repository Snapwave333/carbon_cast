import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { AgentControlPresenceService } from './services/agent-control-presence.service';

@Component({
    selector: 'app-agent-control-presence',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    template: `
        <div
            class="agent-control-presence"
            [class.agent-control-presence--visible]="presence.connected()"
            [attr.aria-hidden]="presence.connected() ? null : 'true'"
            role="status"
        >
            <span class="agent-control-presence__dot"></span>
            <span>Agent connected</span>
        </div>
    `,
    styles: [
        `
            .agent-control-presence {
                align-items: center;
                background: color-mix(in srgb, var(--surface-card, #1e293b) 84%, transparent);
                border: 1px solid color-mix(in srgb, #67e8f9 42%, transparent);
                border-radius: 999px;
                box-shadow: 0 8px 24px rgb(8 47 73 / 18%);
                color: var(--text-color, #e2e8f0);
                display: inline-flex;
                font-size: 0.7rem;
                font-weight: 650;
                gap: 0.4rem;
                letter-spacing: 0.01em;
                opacity: 0;
                padding: 0.34rem 0.6rem;
                pointer-events: none;
                position: fixed;
                right: 1rem;
                top: 3.2rem;
                transform: translateY(-4px);
                transition: opacity 160ms ease-out, transform 160ms ease-out;
                z-index: 1001;
            }

            .agent-control-presence--visible {
                opacity: 1;
                transform: translateY(0);
            }

            .agent-control-presence__dot {
                background: #22d3ee;
                border-radius: 50%;
                box-shadow: 0 0 0.4rem rgb(34 211 238 / 75%);
                height: 0.42rem;
                width: 0.42rem;
            }

            body.agent-command-pulse--player app-video-player,
            body.agent-command-pulse--player app-web-player-view,
            body.agent-command-pulse--player app-html-video-player,
            body.agent-command-pulse--library app-channel-list-container,
            body.agent-command-pulse--library app-multi-epg-container,
            body.agent-command-pulse--library app-epg-list-view,
            body.agent-command-pulse--window app-window-controls,
            body.agent-command-pulse--shell app-root {
                animation: agent-control-surface-pulse 180ms ease-out;
                outline: 1px solid rgb(34 211 238 / 68%);
                outline-offset: 2px;
            }

            @keyframes agent-control-surface-pulse {
                from { box-shadow: 0 0 0 0 rgb(34 211 238 / 0%); }
                45% { box-shadow: 0 0 0 5px rgb(34 211 238 / 18%); }
                to { box-shadow: 0 0 0 0 rgb(34 211 238 / 0%); }
            }

            @media (prefers-reduced-motion: reduce) {
                .agent-control-presence,
                .agent-control-presence--visible {
                    transition: none;
                    transform: none;
                }

                body.agent-command-pulse--player app-video-player,
                body.agent-command-pulse--player app-web-player-view,
                body.agent-command-pulse--player app-html-video-player,
                body.agent-command-pulse--library app-channel-list-container,
                body.agent-command-pulse--library app-multi-epg-container,
                body.agent-command-pulse--library app-epg-list-view,
                body.agent-command-pulse--window app-window-controls,
                body.agent-command-pulse--shell app-root {
                    animation: none;
                }
            }
        `,
    ],
})
export class AgentControlPresenceComponent {
    readonly presence = inject(AgentControlPresenceService);
}
