import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    input,
    output,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { WorkspaceContextErrorViewComponent } from './workspace-context-error-view.component';

interface WorkspaceCategoryViewItem {
    readonly category_id?: string | number;
    readonly category_name?: string;
    readonly count?: number;
    readonly id?: string | number;
    readonly name?: string;
}

interface WorkspaceCategorySection {
    readonly key: string;
    readonly label: string | null;
    readonly items: ReadonlyArray<WorkspaceCategoryViewItem>;
}

@Component({
    selector: 'app-workspace-context-category-view',
    imports: [MatListModule, WorkspaceContextErrorViewComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './workspace-context-category-view.component.html',
    styleUrl: './workspace-context-category-view.component.scss',
})
export class WorkspaceContextCategoryViewComponent {
    readonly items = input<ReadonlyArray<WorkspaceCategoryViewItem>>([]);
    readonly selectedCategoryId = input<string | number | null | undefined>();
    readonly itemCounts = input<Map<number, number>>(new Map());
    readonly showCounts = input(false);
    readonly countDisplayMode = input<'loading' | 'ready'>('ready');
    /**
     * When true, items without an entry in `itemCounts` render no badge at
     * all instead of "0" — used for Stalker censored (adult) genres whose
     * real channel count is unknown to the full-list cache.
     */
    readonly omitMissingCounts = input(false);
    readonly interactionEnabled = input(true);
    readonly statusText = input('');

    /**
     * Providers can hand us hundreds of category names in an arbitrary order.
     * Keep an "All" entry distinct, then give long lists an honest A-Z
     * structure without inventing a taxonomy the provider did not supply.
     */
    readonly categorySections = computed<
        ReadonlyArray<WorkspaceCategorySection>
    >(() => {
        const allItems: WorkspaceCategoryViewItem[] = [];
        const sections = new Map<string, WorkspaceCategoryViewItem[]>();

        for (const item of this.items()) {
            if (this.isAllCategory(item)) {
                allItems.push(item);
                continue;
            }

            const key = this.getSectionKey(item);
            const sectionItems = sections.get(key) ?? [];
            sectionItems.push(item);
            sections.set(key, sectionItems);
        }

        const showSectionLabels = sections.size > 1 && this.items().length > 7;
        const result: WorkspaceCategorySection[] = [];

        if (allItems.length > 0) {
            result.push({ key: 'all', label: null, items: allItems });
        }

        for (const [key, items] of sections) {
            result.push({
                key,
                label: showSectionLabels ? key : null,
                items,
            });
        }

        return result;
    });

    private readonly hostEl = inject(ElementRef<HTMLElement>);

    readonly categoryClicked = output<WorkspaceCategoryViewItem>();

    constructor() {
        effect(() => {
            const selectedCategory = this.selectedCategoryId();
            if (selectedCategory == null) {
                return;
            }

            queueMicrotask(() => {
                const container = this.hostEl.nativeElement;
                const candidates = Array.from(
                    container.querySelectorAll('[data-category-id]')
                ) as HTMLElement[];
                const selected = candidates.find(
                    (el) =>
                        el.dataset['categoryId'] === String(selectedCategory)
                );
                if (!selected) {
                    return;
                }

                const containerRect = container.getBoundingClientRect();
                const selectedRect = selected.getBoundingClientRect();
                const targetTop =
                    container.scrollTop +
                    (selectedRect.top - containerRect.top) -
                    container.clientHeight / 2 +
                    selectedRect.height / 2;
                const maxScrollTop = Math.max(
                    0,
                    container.scrollHeight - container.clientHeight
                );

                container.scrollTo({
                    behavior: 'smooth',
                    top: Math.min(maxScrollTop, Math.max(0, targetTop)),
                });
            });
        });
    }

    isSelected(item: WorkspaceCategoryViewItem): boolean {
        const selectedCategory = this.selectedCategoryId();
        const itemId = item.category_id ?? item.id;
        return (
            selectedCategory != null &&
            String(selectedCategory) === String(itemId)
        );
    }

    getItemCount(item: WorkspaceCategoryViewItem): number {
        const itemId = Number(item.id ?? item.category_id);
        return this.itemCounts().get(itemId) ?? 0;
    }

    hasItemCount(item: WorkspaceCategoryViewItem): boolean {
        if (!this.omitMissingCounts()) {
            return true;
        }

        // NaN (from the "*" all-category id) is a valid Map key here.
        return this.itemCounts().has(Number(item.id ?? item.category_id));
    }

    onCategoryClick(item: WorkspaceCategoryViewItem): void {
        if (!this.interactionEnabled()) {
            return;
        }

        this.categoryClicked.emit(item);
    }

    private isAllCategory(item: WorkspaceCategoryViewItem): boolean {
        const id = String(item.category_id ?? item.id ?? '')
            .trim()
            .toLocaleLowerCase();
        if (id === '*' || id === 'all') {
            return true;
        }

        return /^all(?:\s+(?:items?|channels?|categories|movies|shows|series|radio))?$/i.test(
            this.getLabel(item)
        );
    }

    private getSectionKey(item: WorkspaceCategoryViewItem): string {
        const label = this.getLabel(item).replace(/^\d+\s*[|:.-]\s*/, '');
        const firstCharacter = Array.from(label.trim())[0];

        if (
            !firstCharacter ||
            firstCharacter.toLocaleUpperCase() ===
                firstCharacter.toLocaleLowerCase()
        ) {
            return '#';
        }

        return firstCharacter.toLocaleUpperCase();
    }

    private getLabel(item: WorkspaceCategoryViewItem): string {
        return String(item.category_name ?? item.name ?? '').trim();
    }
}
