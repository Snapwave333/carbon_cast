import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { PlaylistMergeService } from '@iptvnator/playlist/shared/util';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';

@Component({
    selector: 'app-merge-playlists-dialog',
    templateUrl: './merge-playlists-dialog.component.html',
    styleUrl: './merge-playlists-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressBarModule,
        TranslateModule,
    ],
})
export class MergePlaylistsDialogComponent {
    private readonly dialogRef =
        inject<MatDialogRef<MergePlaylistsDialogComponent>>(MatDialogRef);
    private readonly mergeService = inject(PlaylistMergeService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly store = inject(Store);
    private readonly translate = inject(TranslateService);

    private readonly allPlaylists = this.store.selectSignal(
        selectAllPlaylistsMeta
    );

    /** Portals are excluded: their channels are not in `playlist.items`. */
    readonly mergeablePlaylists = computed(() =>
        this.allPlaylists().filter((playlist) =>
            PlaylistMergeService.isMergeable(playlist)
        )
    );

    readonly selectedIds = signal<ReadonlySet<string>>(new Set());
    readonly title = signal('');
    readonly prefixGroups = signal(true);
    readonly isMerging = signal(false);

    readonly canMerge = computed(
        () => this.selectedIds().size >= 2 && !this.isMerging()
    );

    isSelected(playlist: PlaylistMeta): boolean {
        return this.selectedIds().has(playlist._id);
    }

    toggle(playlist: PlaylistMeta): void {
        this.selectedIds.update((current) => {
            const next = new Set(current);
            if (!next.delete(playlist._id)) {
                next.add(playlist._id);
            }
            return next;
        });
    }

    async merge(): Promise<void> {
        if (!this.canMerge()) {
            return;
        }

        this.isMerging.set(true);

        try {
            const outcome = await this.mergeService.merge({
                playlistIds: Array.from(this.selectedIds()),
                title:
                    this.title().trim() ||
                    this.translate.instant('HOME.MERGE.DEFAULT_TITLE'),
                prefixGroupsWithSource: this.prefixGroups(),
            });

            this.snackBar.open(
                this.translate.instant('HOME.MERGE.SUCCESS', {
                    channels: outcome.channelCount,
                    duplicates: outcome.duplicateCount,
                }),
                undefined,
                { duration: 4000 }
            );
            this.dialogRef.close(outcome.playlist._id);
        } catch (error) {
            console.error('[Merge] Failed to merge playlists:', error);
            this.snackBar.open(
                this.translate.instant('HOME.MERGE.FAILED'),
                undefined,
                { duration: 4000 }
            );
        } finally {
            this.isMerging.set(false);
        }
    }

    close(): void {
        this.dialogRef.close();
    }
}
