import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
    CHANNEL_SOURCE_CATALOG,
    ChannelSource,
    ChannelSourceImportService,
    ChannelSourceKind,
    filterChannelSources,
    totalStreamCount,
} from '@iptvnator/playlist/shared/util';

/** Rows rendered before the "show more" button appears. */
const PAGE_SIZE = 60;

/**
 * Above this many streams a merge is slow enough that the user should be told
 * before it starts rather than after.
 */
const LARGE_IMPORT_STREAM_COUNT = 20_000;

interface KindTab {
    readonly kind: ChannelSourceKind;
    readonly labelKey: string;
}

@Component({
    selector: 'app-channel-source-directory',
    templateUrl: './channel-source-directory.component.html',
    styleUrl: './channel-source-directory.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIcon,
        MatInputModule,
        MatProgressBarModule,
        TranslateModule,
    ],
})
export class ChannelSourceDirectoryComponent {
    private readonly importService = inject(ChannelSourceImportService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly translate = inject(TranslateService);

    /** Emitted once an import has been dispatched, so the dialog can close. */
    readonly imported = output<void>();

    readonly kindTabs: readonly KindTab[] = [
        { kind: 'featured', labelKey: 'HOME.DISCOVER.KIND_FEATURED' },
        { kind: 'country', labelKey: 'HOME.DISCOVER.KIND_COUNTRY' },
        { kind: 'region', labelKey: 'HOME.DISCOVER.KIND_REGION' },
        { kind: 'category', labelKey: 'HOME.DISCOVER.KIND_CATEGORY' },
        { kind: 'language', labelKey: 'HOME.DISCOVER.KIND_LANGUAGE' },
    ];

    readonly query = signal('');
    readonly activeKind = signal<ChannelSourceKind>('featured');
    readonly visibleCount = signal(PAGE_SIZE);
    readonly selectedIds = signal<ReadonlySet<string>>(new Set());
    readonly mergeIntoOne = signal(false);
    readonly isImporting = signal(false);
    readonly progressLabel = signal('');

    /**
     * A search spans every kind: someone typing "sport" should not have to
     * guess that it lives under Categories rather than the tab they are on.
     */
    readonly matchingSources = computed(() =>
        filterChannelSources(CHANNEL_SOURCE_CATALOG, {
            query: this.query(),
            kinds: this.query().trim() ? undefined : [this.activeKind()],
        })
    );

    readonly visibleSources = computed(() =>
        this.matchingSources().slice(0, this.visibleCount())
    );

    readonly hasMore = computed(
        () => this.matchingSources().length > this.visibleCount()
    );

    readonly selectedSources = computed(() => {
        const selected = this.selectedIds();
        return CHANNEL_SOURCE_CATALOG.filter((source) =>
            selected.has(source.id)
        );
    });

    readonly selectedStreamCount = computed(() =>
        totalStreamCount(this.selectedSources())
    );

    readonly isLargeSelection = computed(
        () => this.selectedStreamCount() >= LARGE_IMPORT_STREAM_COUNT
    );

    setQuery(value: string): void {
        this.query.set(value);
        this.visibleCount.set(PAGE_SIZE);
    }

    setKind(kind: ChannelSourceKind): void {
        this.activeKind.set(kind);
        this.visibleCount.set(PAGE_SIZE);
    }

    showMore(): void {
        this.visibleCount.update((count) => count + PAGE_SIZE);
    }

    isSelected(source: ChannelSource): boolean {
        return this.selectedIds().has(source.id);
    }

    toggle(source: ChannelSource): void {
        this.selectedIds.update((current) => {
            const next = new Set(current);
            if (!next.delete(source.id)) {
                next.add(source.id);
            }
            return next;
        });
    }

    clearSelection(): void {
        this.selectedIds.set(new Set());
    }

    async importSelected(): Promise<void> {
        const sources = this.selectedSources();
        if (sources.length === 0 || this.isImporting()) {
            return;
        }

        this.isImporting.set(true);
        this.progressLabel.set('');

        try {
            const result = await this.importService.import(sources, {
                mode: this.mergeIntoOne() ? 'merged' : 'separate',
                mergedTitle: this.translate.instant(
                    'HOME.DISCOVER.MERGED_TITLE'
                ),
                prefixGroupsWithSource: sources.length > 1,
                onProgress: (progress) =>
                    this.progressLabel.set(
                        progress.current
                            ? this.translate.instant('HOME.DISCOVER.PROGRESS', {
                                  current: progress.completed + 1,
                                  total: progress.total,
                                  name: progress.current,
                              })
                            : ''
                    ),
            });

            this.reportOutcome(result.failures.length, result.channelCount);

            if (result.playlists.length > 0) {
                this.imported.emit();
            }
        } catch (error) {
            console.error('[Discover] Import failed:', error);
            this.snackBar.open(
                this.translate.instant('HOME.DISCOVER.IMPORT_FAILED'),
                undefined,
                { duration: 4000 }
            );
        } finally {
            this.isImporting.set(false);
            this.progressLabel.set('');
        }
    }

    /**
     * A partial success is the common case — aggregator mirrors go down
     * individually — so the count of failures is reported alongside what was
     * actually imported instead of replacing it.
     */
    private reportOutcome(failureCount: number, channelCount: number): void {
        if (channelCount === 0) {
            this.snackBar.open(
                this.translate.instant('HOME.DISCOVER.IMPORT_FAILED'),
                undefined,
                { duration: 4000 }
            );
            return;
        }

        this.snackBar.open(
            failureCount > 0
                ? this.translate.instant('HOME.DISCOVER.IMPORTED_PARTIAL', {
                      channels: channelCount,
                      failed: failureCount,
                  })
                : this.translate.instant('HOME.DISCOVER.IMPORTED', {
                      channels: channelCount,
                  }),
            undefined,
            { duration: 4000 }
        );
    }
}
