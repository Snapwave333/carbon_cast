import { signal } from '@angular/core';
import { ListboxCursor } from './listbox-cursor';

describe('ListboxCursor', () => {
    let count: ReturnType<typeof signal<number>>;
    let activated: number[];
    let scrolled: number[];
    let cursor: ListboxCursor;

    const press = (key: string) => {
        const event = new KeyboardEvent('keydown', { key });
        jest.spyOn(event, 'preventDefault');
        cursor.handleKeydown(event);
        return event;
    };

    beforeEach(() => {
        count = signal(5);
        activated = [];
        scrolled = [];
        cursor = new ListboxCursor({
            count: () => count(),
            optionId: (index) => `option-${index}`,
            activate: (index) => activated.push(index),
            scrollToIndex: (index) => scrolled.push(index),
        });
    });

    it('starts with no cursor and publishes no active descendant', () => {
        expect(cursor.focusedIndex()).toBe(-1);
        expect(cursor.activeDescendantId()).toBeNull();
    });

    it('walks the list and scrolls each step into view', () => {
        press('ArrowDown');
        expect(cursor.focusedIndex()).toBe(0);
        expect(cursor.activeDescendantId()).toBe('option-0');

        press('ArrowDown');
        expect(cursor.focusedIndex()).toBe(1);
        expect(scrolled).toEqual([0, 1]);
    });

    it('stops at both ends', () => {
        press('ArrowUp');
        expect(cursor.focusedIndex()).toBe(0);

        press('End');
        expect(cursor.focusedIndex()).toBe(count() - 1);

        press('ArrowDown');
        expect(cursor.focusedIndex()).toBe(count() - 1);

        press('Home');
        expect(cursor.focusedIndex()).toBe(0);
    });

    it('activates the focused option on Enter and Space', () => {
        press('ArrowDown');
        press('ArrowDown');
        press('Enter');
        press(' ');

        expect(activated).toEqual([1, 1]);
    });

    it('does not activate before the list has been navigated', () => {
        press('Enter');

        expect(activated).toEqual([]);
    });

    it('ignores keys it does not own', () => {
        const event = press('a');

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(cursor.focusedIndex()).toBe(-1);
    });

    it('does nothing while the list is empty', () => {
        count.set(0);
        press('ArrowDown');

        expect(cursor.focusedIndex()).toBe(-1);
    });

    it('clamps a cursor left past the end after the list shrinks', () => {
        press('End');
        expect(cursor.focusedIndex()).toBe(4);

        // A search narrows the list under the cursor.
        count.set(2);
        press('ArrowDown');

        expect(cursor.focusedIndex()).toBe(1);
    });

    it('publishes no active descendant once the cursor is past the end', () => {
        press('End');
        expect(cursor.activeDescendantId()).toBe('option-4');

        // A search narrows the list, leaving the cursor pointing at a row that
        // is no longer rendered.
        count.set(2);

        expect(cursor.activeDescendantId()).toBeNull();
    });

    it('accepts a cursor position set by the pointer', () => {
        cursor.focus(3);
        press('ArrowDown');

        expect(cursor.focusedIndex()).toBe(4);
    });
});
