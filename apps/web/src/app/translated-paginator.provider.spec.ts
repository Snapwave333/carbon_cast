import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideTranslatedPaginator } from './translated-paginator.provider';

const EN = {
    PAGINATOR: {
        ITEMS_PER_PAGE: 'Items per page:',
        NEXT_PAGE: 'Next page',
        PREVIOUS_PAGE: 'Previous page',
        FIRST_PAGE: 'First page',
        LAST_PAGE: 'Last page',
        RANGE: '{{start}} – {{end}} of {{total}}',
        RANGE_EMPTY: '0 of {{total}}',
        SELECT_PAGE: 'Select page',
    },
};

const DE = {
    PAGINATOR: {
        ...EN.PAGINATOR,
        ITEMS_PER_PAGE: 'Einträge pro Seite:',
        RANGE: '{{start}} – {{end}} von {{total}}',
    },
};

describe('provideTranslatedPaginator', () => {
    let intl: MatPaginatorIntl;
    let translate: TranslateService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [provideTranslatedPaginator()],
        });

        translate = TestBed.inject(TranslateService);
        translate.setTranslation('en', EN);
        translate.setTranslation('de', DE);
        translate.use('en');

        intl = TestBed.inject(MatPaginatorIntl);
    });

    it('translates the labels Material would otherwise hard-code in English', () => {
        expect(intl.itemsPerPageLabel).toBe('Items per page:');
        expect(intl.nextPageLabel).toBe('Next page');
        expect(intl.previousPageLabel).toBe('Previous page');
        expect(intl.firstPageLabel).toBe('First page');
        expect(intl.lastPageLabel).toBe('Last page');
    });

    it('builds the range label from the active language', () => {
        expect(intl.getRangeLabel(0, 25, 300)).toBe('1 – 25 of 300');
        expect(intl.getRangeLabel(2, 25, 300)).toBe('51 – 75 of 300');
    });

    it('clamps the last page to the reported total', () => {
        expect(intl.getRangeLabel(10, 25, 260)).toBe('251 – 260 of 260');
    });

    it('reports an empty range rather than "1 – 0 of 0"', () => {
        expect(intl.getRangeLabel(0, 25, 0)).toBe('0 of 0');
        expect(intl.getRangeLabel(0, 0, 40)).toBe('0 of 40');
    });

    it('re-reads the labels and notifies paginators when the language changes', () => {
        const changes: number[] = [];
        intl.changes.subscribe(() => changes.push(1));

        translate.use('de');

        expect(intl.itemsPerPageLabel).toBe('Einträge pro Seite:');
        expect(intl.getRangeLabel(0, 25, 300)).toBe('1 – 25 von 300');
        expect(changes.length).toBeGreaterThan(0);
    });
});
