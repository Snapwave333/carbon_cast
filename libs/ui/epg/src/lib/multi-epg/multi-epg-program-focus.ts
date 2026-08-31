import { signal } from '@angular/core';
import {
    MultiEpgLayoutChannel,
    MultiEpgLayoutProgram,
} from './multi-epg-layout.util';

interface MultiEpgProgramFocusDeps {
    /** Rows currently rendered, in template order. */
    readonly channels: () => readonly MultiEpgLayoutChannel[];
    /** Same key the template stamps into `data-program-key`. */
    readonly keyOf: (program: MultiEpgLayoutProgram) => string;
    /** Component host, searched for the cell to focus. */
    readonly host: () => HTMLElement;
    /** Enter/Space on a cell. */
    readonly activate: (program: MultiEpgLayoutProgram) => void;
    /** Optional: keyboard route to the details card ("i"). */
    readonly openDetails?: (program: MultiEpgLayoutProgram) => void;
}

/**
 * Roving tabindex across the programme grid.
 *
 * Every cell used to be `tabindex="0"`, so reaching anything after the guide
 * meant tabbing through every programme on the page (120+ stops for ten
 * channels). One cell is tabbable at a time and the arrow keys move between
 * them, which is the grid pattern assistive tech expects.
 */
export class MultiEpgProgramFocus {
    /** Cell the roving tabindex currently points at. */
    readonly focusedKey = signal<string | null>(null);

    constructor(private readonly deps: MultiEpgProgramFocusDeps) {}

    isFocusTarget(
        program: MultiEpgLayoutProgram,
        channelIndex: number,
        programIndex: number
    ): boolean {
        const focused = this.focusedKey();
        if (focused) {
            return focused === this.deps.keyOf(program);
        }

        // Nothing focused yet: the first cell is the way in.
        return channelIndex === 0 && programIndex === 0;
    }

    onFocus(program: MultiEpgLayoutProgram): void {
        this.focusedKey.set(this.deps.keyOf(program));
    }

    onKeydown(
        event: KeyboardEvent,
        program: MultiEpgLayoutProgram,
        channelIndex: number,
        programIndex: number
    ): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.deps.activate(program);
            return;
        }

        // The cell's info button is tabindex="-1" so it cannot break the
        // roving-tabindex grid, which leaves keyboard users without a way to
        // reach the details card. "i" is that way.
        if ((event.key === 'i' || event.key === 'I') && this.deps.openDetails) {
            event.preventDefault();
            this.deps.openDetails(program);
            return;
        }

        const target = this.resolveNeighbour(
            event.key,
            program,
            channelIndex,
            programIndex
        );
        if (!target) {
            return;
        }

        event.preventDefault();
        this.focusedKey.set(this.deps.keyOf(target));
        // The tabindex swap lands on the next change detection, so focus the
        // element after the template has caught up.
        queueMicrotask(() => this.focusCell(target));
    }

    private resolveNeighbour(
        key: string,
        program: MultiEpgLayoutProgram,
        channelIndex: number,
        programIndex: number
    ): MultiEpgLayoutProgram | null {
        const channels = this.deps.channels();
        const row = channels[channelIndex]?.programs ?? [];

        if (key === 'ArrowRight') {
            return row[programIndex + 1] ?? null;
        }
        if (key === 'ArrowLeft') {
            return row[programIndex - 1] ?? null;
        }
        if (key !== 'ArrowDown' && key !== 'ArrowUp') {
            return null;
        }

        const nextIndex =
            key === 'ArrowDown' ? channelIndex + 1 : channelIndex - 1;
        const neighbourRow = channels[nextIndex]?.programs ?? [];
        if (neighbourRow.length === 0) {
            return null;
        }

        // Land on whatever is airing at the same point on the timeline rather
        // than the same ordinal, since rows rarely line up.
        return neighbourRow.reduce((closest, candidate) =>
            Math.abs(candidate.startPosition - program.startPosition) <
            Math.abs(closest.startPosition - program.startPosition)
                ? candidate
                : closest
        );
    }

    private focusCell(program: MultiEpgLayoutProgram): void {
        const key = this.deps.keyOf(program);
        this.deps
            .host()
            .querySelector<SVGGElement>(
                `[data-program-key="${CSS.escape(key)}"]`
            )
            ?.focus();
    }
}
