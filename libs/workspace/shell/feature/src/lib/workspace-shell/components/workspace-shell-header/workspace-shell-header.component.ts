import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    computed,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    ChannelActions,
    selectActive,
    selectChannels,
} from '@iptvnator/m3u-state';
import { PlaylistSwitcherComponent } from '@iptvnator/playlist/shared/ui';
import {
    getAdjacentChannelItem,
    WorkspaceHeaderAction,
} from '@iptvnator/portal/shared/util';
import { WorkspaceHeaderBulkAction } from '../../services/helpers/workspace-shell-constants';

@Component({
    selector: 'app-workspace-shell-header',
    imports: [
        MatIcon,
        MatIconButton,
        MatTooltip,
        PlaylistSwitcherComponent,
        TranslatePipe,
    ],
    templateUrl: './workspace-shell-header.component.html',
    styleUrl: './workspace-shell-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellHeaderComponent {
    private readonly store = inject(Store);
    private readonly searchInput =
        viewChild<ElementRef<HTMLInputElement>>('searchInput');
    private readonly channels = this.store.selectSignal(selectChannels);
    private readonly activeChannel = this.store.selectSignal(selectActive);

    readonly isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    readonly commandShortcutLabel = this.isMac ? '⌘K' : 'Ctrl+K';

    readonly playlistTitle = input('');
    readonly playlistSubtitle = input('');
    readonly canOpenPlaylistInfo = input(false);
    readonly canOpenAccountInfo = input(false);
    readonly searchQuery = input('');
    readonly canUseSearch = input(false);
    readonly searchPlaceholder = input('');
    readonly searchScopeLabel = input('');
    readonly searchStatusLabel = input('');
    readonly headerShortcut = input<WorkspaceHeaderAction | null>(null);
    readonly headerBulkAction = input<WorkspaceHeaderBulkAction | null>(null);
    readonly canRefreshPlaylist = input(false);
    readonly isRefreshingPlaylist = input(false);
    readonly hasNoPlaylists = input(false);
    readonly isSettingsRoute = input(false);
    readonly isM3uPlaylistRoute = input(false);

    /** Only offer channel flipping when the current M3U playlist has a real selection. */
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

    readonly searchChanged = output<string>();
    readonly searchSubmitted = output<string>();
    readonly commandPaletteRequested = output<void>();
    readonly shortcutsRequested = output<void>();
    readonly addPlaylistRequested = output<void>();
    readonly headerShortcutRequested = output<void>();
    readonly headerBulkActionRequested = output<void>();
    readonly refreshPlaylistRequested = output<void>();
    readonly playlistInfoRequested = output<void>();
    readonly accountInfoRequested = output<void>();

    focusSearchInput(options: { select?: boolean } = {}): void {
        const inputElement = this.searchInput()?.nativeElement;
        if (!inputElement || inputElement.disabled) {
            return;
        }

        inputElement.focus();
        if (options.select) {
            inputElement.select();
        }
    }

    containsSearchInput(target: EventTarget | null): boolean {
        const inputElement = this.searchInput()?.nativeElement;
        return !!inputElement && target === inputElement;
    }

    onSearchInput(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchChanged.emit(target?.value ?? '');
    }

    onSearchEnter(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchSubmitted.emit(target?.value ?? this.searchQuery());
    }

    onPlaylistInfoRequested(): void {
        this.playlistInfoRequested.emit();
    }

    onAccountInfoRequested(): void {
        this.accountInfoRequested.emit();
    }

    onAddPlaylistRequested(): void {
        this.addPlaylistRequested.emit();
    }

    onCommandPaletteRequested(): void {
        this.commandPaletteRequested.emit();
    }

    onShortcutsRequested(): void {
        this.shortcutsRequested.emit();
    }

    onHeaderShortcutRequested(): void {
        this.headerShortcutRequested.emit();
    }

    onHeaderBulkActionRequested(): void {
        this.headerBulkActionRequested.emit();
    }

    onRefreshPlaylistRequested(): void {
        this.refreshPlaylistRequested.emit();
    }

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
