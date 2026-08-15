import { signal } from '@angular/core';

interface GridCardFocusDeps {
    /** Number of cards currently rendered. */
    readonly count: () => number;
    /** Component host, searched for the card to focus. */
    readonly host: () => HTMLElement;
    /** Enter/Space on a card. */
    readonly activate: (index: number) => void;
}

/**
 * Roving tabindex and arrow-key movement across the poster grid.
 *
 * A page holds up to 100 cards, so leaving every one tabbable meant Tab could
 * not get past the grid in any reasonable number of presses. One card is
 * tabbable at a time and the arrows move between them; up/down step a whole
 * row, which is read from the live `grid-template-columns` rather than assumed,
 * since the grid is `auto-fill` and its column count changes with the window.
 */
export class GridCardFocus {
    readonly focusedIndex = signal<number | null>(null);

    constructor(private readonly deps: GridCardFocusDeps) {}

    isFocusTarget(index: number): boolean {
        const focused = this.focusedIndex();
        if (focused === null) {
            return index === 0;
        }

        // The focused card can leave the grid on a page or filter change;
        // fall back to the first card so the grid never loses its tab stop.
        return focused < this.deps.count() ? focused === index : index === 0;
    }

    onFocus(index: number): void {
        this.focusedIndex.set(index);
    }

    onKeydown(event: KeyboardEvent, index: number): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.deps.activate(index);
            return;
        }

        const target = this.resolveNeighbour(event.key, index);
        if (target === null) {
            return;
        }

        event.preventDefault();
        this.focusedIndex.set(target);
        // The tabindex swap lands on the next change detection, so focus the
        // card after the template has caught up.
        queueMicrotask(() => this.focusCard(target));
    }

    private resolveNeighbour(key: string, index: number): number | null {
        const count = this.deps.count();
        if (count === 0) {
            return null;
        }

        const columns = this.columnCount();
        const candidate = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            ArrowDown: index + columns,
            ArrowUp: index - columns,
            Home: 0,
            End: count - 1,
        }[key];

        if (candidate === undefined || candidate === index) {
            return null;
        }

        // A down press on the last, partly filled row has nowhere to go; stay
        // put rather than jumping back to the start of the row.
        return candidate >= 0 && candidate < count ? candidate : null;
    }

    private columnCount(): number {
        const grid = this.deps.host().querySelector('.grid-list__grid');
        if (!grid) {
            return 1;
        }

        const columns = getComputedStyle(grid)
            .gridTemplateColumns.split(' ')
            .filter(Boolean).length;

        return Math.max(1, columns);
    }

    private focusCard(index: number): void {
        this.deps
            .host()
            .querySelector<HTMLElement>(`[data-card-index="${index}"]`)
            ?.focus();
    }
}
