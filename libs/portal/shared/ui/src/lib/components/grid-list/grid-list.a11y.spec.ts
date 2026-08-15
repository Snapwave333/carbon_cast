import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';
import { MockPipe } from 'ng-mocks';
import { provideStubIconRegistry } from '@iptvnator/shared/testing';
import { GridListComponent } from './grid-list.component';

describe('GridListComponent keyboard and list semantics', () => {
    let fixture: ComponentFixture<GridListComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GridListComponent],
            providers: [provideStubIconRegistry()],
        })
            .overrideComponent(GridListComponent, {
                remove: { imports: [TranslatePipe] },
                add: {
                    imports: [
                        MockPipe(
                            TranslatePipe,
                            (value: string | null | undefined) => value ?? ''
                        ),
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(GridListComponent);
    });

    it('exposes cards as keyboard-reachable buttons named after the item', () => {
        fixture.componentRef.setInput('items', [
            { name: 'The Expanse', stream_icon: 'expanse.png' },
        ]);
        fixture.detectChanges();

        const card = fixture.debugElement.query(By.css('mat-card'))
            .nativeElement as HTMLElement;

        expect(card.getAttribute('role')).toBe('button');
        expect(card.getAttribute('tabindex')).toBe('0');
        expect(card.getAttribute('aria-label')).toBe('The Expanse');
        // The title is the accessible name; a repeated "logo" alt on every
        // poster would be announced instead.
        expect(
            fixture.debugElement
                .query(By.css('.stream-icon'))
                .nativeElement.getAttribute('alt')
        ).toBe('');
    });

    it.each(['Enter', ' '] as const)(
        'activates a focused card with %s',
        (key) => {
            const item = { name: 'The Expanse' };
            fixture.componentRef.setInput('items', [item]);
            fixture.detectChanges();

            const clicked: unknown[] = [];
            fixture.componentInstance.itemClicked.subscribe((emitted) =>
                clicked.push(emitted)
            );

            const event = new KeyboardEvent('keydown', {
                key,
                cancelable: true,
            });
            fixture.debugElement
                .query(By.css('mat-card'))
                .nativeElement.dispatchEvent(event);

            expect(clicked).toEqual([item]);
            // Space would otherwise scroll the grid instead of opening.
            expect(event.defaultPrevented).toBe(true);
        }
    );

    it('announces each card as a positioned list item across pages', () => {
        fixture.componentRef.setInput('items', [{ name: 'A' }, { name: 'B' }]);
        fixture.componentRef.setInput('pageIndex', 2);
        fixture.componentRef.setInput('limit', 25);
        fixture.componentRef.setInput('totalPages', 13);
        fixture.detectChanges();

        expect(
            fixture.debugElement
                .query(By.css('.grid-list__grid'))
                .nativeElement.getAttribute('role')
        ).toBe('list');

        const cells = fixture.debugElement.queryAll(By.css('[role="listitem"]'));
        expect(cells).toHaveLength(2);
        expect(cells[0].nativeElement.getAttribute('aria-posinset')).toBe('51');
        expect(cells[1].nativeElement.getAttribute('aria-posinset')).toBe('52');
        expect(cells[0].nativeElement.getAttribute('aria-setsize')).toBe('325');
    });

    it('keeps the paginator usable when a portal reports no page count', () => {
        fixture.componentRef.setInput(
            'items',
            Array.from({ length: 25 }, (_, index) => ({ name: `Item ${index}` }))
        );
        fixture.componentRef.setInput('pageIndex', 1);
        fixture.componentRef.setInput('limit', 25);
        fixture.componentRef.setInput('totalPages', 0);
        fixture.detectChanges();

        // Length 0 made Material render "0 of 0" and disable next while a full
        // page of items was on screen.
        expect(
            fixture.debugElement.query(By.css('mat-paginator')).componentInstance
                .length
        ).toBe(50);
    });

    it('makes only one card tabbable so Tab can leave the grid', () => {
        fixture.componentRef.setInput(
            'items',
            Array.from({ length: 6 }, (_, index) => ({ name: `Item ${index}` }))
        );
        fixture.detectChanges();

        const tabbable = fixture.debugElement.queryAll(
            By.css('mat-card[tabindex="0"]')
        );
        expect(tabbable).toHaveLength(1);
        expect(tabbable[0].nativeElement.getAttribute('data-card-index')).toBe(
            '0'
        );
    });

    it.each([
        ['ArrowRight', 0, 1],
        ['ArrowLeft', 2, 1],
        ['End', 0, 5],
        ['Home', 4, 0],
    ] as const)(
        'moves the tab stop with %s',
        (key, from, expected) => {
            fixture.componentRef.setInput(
                'items',
                Array.from({ length: 6 }, (_, index) => ({
                    name: `Item ${index}`,
                }))
            );
            fixture.detectChanges();

            const cards = fixture.debugElement.queryAll(By.css('mat-card'));
            cards[from].nativeElement.dispatchEvent(new FocusEvent('focus'));
            cards[from].nativeElement.dispatchEvent(
                new KeyboardEvent('keydown', { key, cancelable: true })
            );
            fixture.detectChanges();

            expect(
                fixture.debugElement
                    .query(By.css('mat-card[tabindex="0"]'))
                    .nativeElement.getAttribute('data-card-index')
            ).toBe(String(expected));
        }
    );

    it('stays put when an arrow would leave the grid', () => {
        fixture.componentRef.setInput('items', [{ name: 'Only' }]);
        fixture.detectChanges();

        const card = fixture.debugElement.query(By.css('mat-card'));
        const event = new KeyboardEvent('keydown', {
            key: 'ArrowLeft',
            cancelable: true,
        });
        card.nativeElement.dispatchEvent(event);
        fixture.detectChanges();

        expect(event.defaultPrevented).toBe(false);
        expect(
            fixture.debugElement
                .query(By.css('mat-card[tabindex="0"]'))
                .nativeElement.getAttribute('data-card-index')
        ).toBe('0');
    });

    it('ignores other keys so typing stays available', () => {
        fixture.componentRef.setInput('items', [{ name: 'The Expanse' }]);
        fixture.detectChanges();

        const clicked: unknown[] = [];
        fixture.componentInstance.itemClicked.subscribe((emitted) =>
            clicked.push(emitted)
        );

        fixture.debugElement
            .query(By.css('mat-card'))
            .nativeElement.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'a', cancelable: true })
            );

        expect(clicked).toEqual([]);
    });
});
