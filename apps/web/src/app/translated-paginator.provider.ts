import { DestroyRef, Provider, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/**
 * Material's paginator ships its own English labels and does not go through
 * `TranslatePipe`, so every portal grid rendered "Items per page:" and
 * "1 – 25 of 300" in English regardless of the app language.
 */
class TranslatedPaginatorIntl extends MatPaginatorIntl {
    constructor(
        private readonly translate: TranslateService,
        destroyRef: DestroyRef
    ) {
        super();
        this.applyLabels();

        const subscription = this.translate.onLangChange.subscribe(() =>
            this.applyLabels()
        );
        destroyRef.onDestroy(() => subscription.unsubscribe());
    }

    override getRangeLabel = (
        page: number,
        pageSize: number,
        length: number
    ): string => {
        const total = Math.max(length, 0);
        if (total === 0 || pageSize === 0) {
            return this.translate.instant('PAGINATOR.RANGE_EMPTY', { total });
        }

        const start = page * pageSize;
        // A miscounted total can put the last page past `length`; clamp so the
        // label never reads "251 – 275 of 260".
        const end = Math.min(start + pageSize, total);

        return this.translate.instant('PAGINATOR.RANGE', {
            start: start + 1,
            end,
            total,
        });
    };

    private applyLabels(): void {
        this.itemsPerPageLabel = this.translate.instant(
            'PAGINATOR.ITEMS_PER_PAGE'
        );
        this.nextPageLabel = this.translate.instant('PAGINATOR.NEXT_PAGE');
        this.previousPageLabel = this.translate.instant(
            'PAGINATOR.PREVIOUS_PAGE'
        );
        this.firstPageLabel = this.translate.instant('PAGINATOR.FIRST_PAGE');
        this.lastPageLabel = this.translate.instant('PAGINATOR.LAST_PAGE');
        this.changes.next();
    }
}

export function provideTranslatedPaginator(): Provider {
    return {
        provide: MatPaginatorIntl,
        useFactory: () =>
            new TranslatedPaginatorIntl(
                inject(TranslateService),
                inject(DestroyRef)
            ),
    };
}
