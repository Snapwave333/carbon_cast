import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip, TooltipPosition } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
    PortalRailLink,
    PortalRailSection,
} from '@iptvnator/portal/shared/util';
import { RailExpansionService } from '@iptvnator/workspace/shell/util';
import { SettingsStore } from '@iptvnator/services';
import { WorkspaceShellRailLinksComponent } from '../workspace-shell-rail-links/workspace-shell-rail-links.component';

@Component({
    selector: 'app-workspace-shell-rail',
    imports: [
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
    private readonly railExpansion = inject(RailExpansionService);
    private readonly settings = inject(SettingsStore);

    readonly isMacOS = input(false);
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

    readonly expanded = this.railExpansion.expanded;

    /** The rail sits on the right when mirrored, so hints point left there. */
    private readonly mirrored = computed(
        () => this.settings.mirrorLayout?.() ?? true
    );
    readonly tooltipPosition = computed<TooltipPosition>(() =>
        this.mirrored() ? 'left' : 'right'
    );
    /** Chevron points the way the rail will grow / shrink. */
    readonly expandIcon = computed(() => {
        const towardEdge = this.mirrored() ? 'chevron_right' : 'chevron_left';
        const towardContent = this.mirrored()
            ? 'chevron_left'
            : 'chevron_right';
        return this.expanded() ? towardEdge : towardContent;
    });

    toggleExpanded(): void {
        this.railExpansion.toggle();
    }
}
