import { DragDropModule } from '@angular/cdk/drag-drop';
import { DatePipe, NgStyle } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    output,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { EpgItemDescriptionComponent } from '@iptvnator/ui/epg';
import { EpgProgram } from '@iptvnator/shared/interfaces';
import { SettingsStore } from '@iptvnator/services';
import { applyChannelNameStrip } from '@iptvnator/shared/m3u-utils';

@Component({
    selector: 'app-channel-list-item',
    styleUrls: ['./channel-list-item.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './channel-list-item.component.html',
    imports: [
        DatePipe,
        DragDropModule,
        MatIcon,
        MatIconButton,
        MatTooltip,
        NgStyle,
        TranslatePipe,
    ],
})
export class ChannelListItemComponent {
    private readonly dialog = inject(MatDialog);
    private readonly settingsStore = inject(SettingsStore);

    /** Reset whenever the row is handed a different logo. */
    private readonly logoFailed = linkedSignal<
        string | null | undefined,
        boolean
    >({
        source: () => this.logo(),
        computation: () => false,
    });

    readonly isDraggable = input(false);
    readonly logo = input<string | null | undefined>('');
    readonly name = input('');
    readonly displayName = computed(() =>
        applyChannelNameStrip(
            this.name(),
            this.settingsStore.stripCountryPrefix?.()
        )
    );
    readonly showFavoriteButton = input(false);
    readonly showAuxActionButton = input(false);
    readonly showProgramInfoButton = input(true);
    readonly showDetailsContextMenu = input(false);
    readonly isFavorite = input(false);
    readonly selected = input(false);
    /**
     * Identifies the row for the owning listbox's aria-activedescendant. The
     * list is virtualized, so keyboard focus stays on the viewport and moves
     * this pointer rather than moving DOM focus between recycled rows.
     */
    readonly rowId = input('');
    readonly keyboardFocused = input(false);
    readonly showEpg = input(true);
    readonly isRadio = input(false);
    readonly epgProgram = input<EpgProgram | null | undefined>();
    /** Progress percentage pre-computed by parent for performance */
    readonly progressPercentage = input(0);
    readonly auxActionIcon = input('delete');
    readonly auxActionTooltip = input('');

    /**
     * Virtual-scroll rows are recycled, so the failed state has to be derived
     * from the current logo rather than left on the DOM node: a row that once
     * showed a broken image is reused for a channel whose logo is fine.
     */
    readonly showLogo = computed(() => !!this.logo() && !this.logoFailed());
    readonly showLogoFallback = computed(() => !this.showLogo());

    readonly clicked = output<void>();
    readonly activated = output<void>();
    readonly favoriteToggled = output<MouseEvent>();
    readonly auxActionClicked = output<MouseEvent>();
    readonly contextMenuRequested = output<MouseEvent>();

    /**
     * Opens the dialog with details about the current EPG program
     * @param program EPG program to show details for
     * @param event Mouse event to stop propagation
     */
    showProgramDescription(program: EpgProgram, event: MouseEvent): void {
        event.stopPropagation();
        this.dialog.open(EpgItemDescriptionComponent, {
            data: program,
        });
    }

    onFavoriteClick(event: MouseEvent): void {
        event.stopPropagation();
        this.favoriteToggled.emit(event);
    }

    onAuxActionClick(event: MouseEvent): void {
        event.stopPropagation();
        this.auxActionClicked.emit(event);
    }

    onClick(event?: MouseEvent): void {
        if ((event?.detail ?? 1) > 1) {
            return;
        }

        this.clicked.emit();
    }

    onDoubleClick(): void {
        this.activated.emit();
    }

    onContextMenu(event: MouseEvent): void {
        if (!this.showDetailsContextMenu()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.contextMenuRequested.emit(event);
    }

    onLogoError(): void {
        this.logoFailed.set(true);
    }
}
