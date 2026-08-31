import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { MatTooltip, TooltipPosition } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
    ChannelActions,
    selectActive,
    selectChannels,
} from '@iptvnator/m3u-state';
import {
    getAdjacentChannelItem,
    PortalRailLink,
    PortalRailSection,
} from '@iptvnator/portal/shared/util';
import { WorkspaceShellRailLinksComponent } from '../workspace-shell-rail-links/workspace-shell-rail-links.component';

@Component({
    selector: 'app-workspace-shell-rail',
    imports: [
        MatIconButton,
        MatIcon,
        MatTooltip,
        RouterLink,
        TranslatePipe,
        WorkspaceShellRailLinksComponent,
    ],
    templateUrl: './workspace-shell-rail.component.html',
    styleUrl: './workspace-shell-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellRailComponent {
    private readonly store = inject(Store);
    private readonly channels = this.store.selectSignal(selectChannels);
    private readonly activeChannel = this.store.selectSignal(selectActive);

    readonly brandLink = input('/workspace/dashboard');
    readonly brandTooltipKey = input('WORKSPACE.SHELL.RAIL_DASHBOARD');
    readonly brandAriaLabelKey = input('WORKSPACE.SHELL.OPEN_DASHBOARD');
    readonly workspaceLinks = input<PortalRailLink[]>([]);
    readonly primaryContextLinks = input<PortalRailLink[]>([]);
    readonly secondaryContextLinks = input<PortalRailLink[]>([]);
    readonly selectedSection = input<
        PortalRailSection | string | null | undefined
    >(null);
    readonly railProviderClass = input('rail-context-region');
    readonly isSettingsRoute = input(false);
    readonly isM3uPlaylistRoute = input(false);

    /** Channel flipping belongs in the persistent M3U bottom dock. */
    readonly canNavigateChannels = computed(() => {
        const activeChannel = this.activeChannel();
        const channels = this.channels();

        return (
            this.isM3uPlaylistRoute() &&
            !!activeChannel &&
            channels.length > 1 &&
            channels.some((channel) => channel.id === activeChannel.id)
        );
    });

    /** The dock sits below the workspace, so hints open toward the content. */
    readonly tooltipPosition: TooltipPosition = 'above';

    changeChannel(direction: 'up' | 'down'): void {
        const activeChannel = this.activeChannel();
        if (!activeChannel || !this.canNavigateChannels()) {
            return;
        }

        const channel = getAdjacentChannelItem(
            this.channels(),
            activeChannel.id,
            direction,
            (item) => item.id
        );
        if (!channel) {
            return;
        }

        this.store.dispatch(
            ChannelActions.setActiveChannel({
                channel,
                startPlayback: true,
            })
        );
    }
}
