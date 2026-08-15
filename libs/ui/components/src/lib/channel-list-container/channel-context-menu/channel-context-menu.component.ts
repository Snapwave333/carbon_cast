import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { resolveChannelEpgLookupKey } from '@iptvnator/m3u-state';
import { Channel } from '@iptvnator/shared/interfaces';
import { ChannelDetailsDialogComponent } from '../channel-details-dialog/channel-details-dialog.component';
import { EpgMappingDialogComponent } from '../epg-mapping-dialog/epg-mapping-dialog.component';

/**
 * Right-click menu shared by every channel list view.
 *
 * Each of the four views previously carried its own copy of this menu, the
 * invisible anchor it opens from, and the two dialog handlers — so a fix to
 * any of it had to be made four times, and they had already drifted apart.
 * Views now render `<app-channel-context-menu #menu />` and call
 * `menu.open(channel, event)` from their contextmenu handler.
 */
@Component({
    selector: 'app-channel-context-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIcon, MatMenuModule, TranslatePipe],
    template: `
        <div
            aria-hidden="true"
            class="channel-context-menu-anchor"
            [style.left]="position().x"
            [style.top]="position().y"
            [matMenuTriggerFor]="channelContextMenu"
            #contextMenuTrigger="matMenuTrigger"
        ></div>

        <mat-menu #channelContextMenu="matMenu">
            @if (supportsEpgMapping) {
                <button mat-menu-item (click)="openEpgMapping()">
                    <mat-icon svgIcon="settings_remote"></mat-icon>
                    <span>{{ 'CHANNELS.MAP_EPG' | translate }}</span>
                </button>
            }
            <button mat-menu-item (click)="openChannelDetails()">
                <mat-icon svgIcon="info"></mat-icon>
                <span>{{ 'CHANNELS.SHOW_DETAILS' | translate }}</span>
            </button>
            <!-- View-specific actions, e.g. Recently viewed's "remove from
                 history". They read the channel via activeChannel(). -->
            <ng-content />
        </mat-menu>
    `,
    styles: `
        .channel-context-menu-anchor {
            position: fixed;
            width: 0;
            height: 0;
            opacity: 0;
            pointer-events: none;
        }
    `,
})
export class ChannelContextMenuComponent {
    private readonly dialog = inject(MatDialog);
    private readonly epgBridge = inject(EpgRuntimeBridgeService);

    protected readonly supportsEpgMapping = this.epgBridge.supportsEpgMapping;
    protected readonly position = signal({ x: '0px', y: '0px' });

    private readonly trigger =
        viewChild.required<MatMenuTrigger>('contextMenuTrigger');
    private readonly channel = signal<Channel | null>(null);
    /** The channel the menu was opened on, for projected actions. */
    readonly activeChannel = this.channel.asReadonly();

    close(): void {
        this.trigger().closeMenu();
    }

    open(channel: Channel, event: MouseEvent): void {
        this.channel.set(channel);
        this.position.set({
            x: `${event.clientX}px`,
            y: `${event.clientY}px`,
        });

        const trigger = this.trigger();
        if (trigger.menuOpen) {
            trigger.closeMenu();
        }

        // The anchor has to move before the overlay measures it, so opening
        // waits for the position binding to flush.
        queueMicrotask(() => this.trigger().openMenu());
    }

    protected openChannelDetails(): void {
        const channel = this.channel();
        if (!channel) {
            return;
        }

        this.trigger().closeMenu();
        this.dialog.open(ChannelDetailsDialogComponent, {
            data: channel,
            maxWidth: '720px',
            width: 'calc(100vw - 32px)',
        });
    }

    protected openEpgMapping(): void {
        const channel = this.channel();
        if (!channel) {
            return;
        }

        this.trigger().closeMenu();
        const channelKey = resolveChannelEpgLookupKey(channel);
        if (!channelKey) {
            return;
        }

        EpgMappingDialogComponent.open(this.dialog, {
            channelKey,
            channelName: channel.name ?? channelKey,
        });
    }
}
