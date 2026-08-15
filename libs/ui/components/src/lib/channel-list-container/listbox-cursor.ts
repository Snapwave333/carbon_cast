import { computed, signal } from '@angular/core';

export interface ListboxCursorOptions {
    /** Number of options currently in the list. */
    readonly count: () => number;
    /** DOM id of the option at an index, for aria-activedescendant. */
    readonly optionId: (index: number) => string;
    /** Runs when the user presses Enter or Space on the focused option. */
    readonly activate: (index: number) => void;
    /** Brings an off-screen option into view (virtualized lists). */
    readonly scrollToIndex?: (index: number) => void;
}

/**
 * Roving cursor for a listbox whose DOM focus stays on the container.
 *
 * The channel lists are virtualized, so rows are recycled as they scroll —
 * moving real focus into a row would lose it the moment that row left the
 * rendered range. Instead the container keeps focus and publishes the current
 * row through `aria-activedescendant`, which this cursor tracks.
 */
export class ListboxCursor {
    /** -1 until the list has been keyboard-navigated. */
    readonly focusedIndex = signal(-1);
    readonly activeDescendantId = computed(() => {
        const index = this.focusedIndex();
        return index >= 0 ? this.options.optionId(index) : null;
    });

    constructor(private readonly options: ListboxCursorOptions) {}

    /** Keeps the cursor where the pointer last acted. */
    focus(index: number): void {
        this.focusedIndex.set(index);
    }

    handleKeydown(event: KeyboardEvent): void {
        const count = this.options.count();
        if (count === 0) {
            return;
        }

        // Clamp first: the list can shrink under the cursor while filtering.
        const current = Math.min(this.focusedIndex(), count - 1);
        let next: number;

        switch (event.key) {
            case 'ArrowDown':
                next = Math.min(count - 1, current + 1);
                break;
            case 'ArrowUp':
                next = current <= 0 ? 0 : current - 1;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = count - 1;
                break;
            case 'Enter':
            case ' ':
                if (current < 0) {
                    return;
                }
                event.preventDefault();
                this.options.activate(current);
                return;
            default:
                return;
        }

        event.preventDefault();
        this.focusedIndex.set(next);
        this.options.scrollToIndex?.(next);
    }
}
