import { effect, ElementRef, signal, Signal } from '@angular/core';
import { MultiEpgProgramSearch } from './multi-epg-program-search';

type InputRef = Signal<ElementRef<HTMLInputElement> | undefined>;

/**
 * The guide toolbar's two text fields — the channel-column filter and the
 * programme search — with their open/close state, focus-on-open, and
 * Escape-to-close.
 *
 * Extracted from the container so that component stays a thin coordinator. The
 * focus effects are created here, so instances must be constructed inside an
 * Angular injection context (a component field initializer or constructor).
 */
export class MultiEpgSearchFields {
    /** Channel-column substring filter. */
    readonly channelFilter = signal('');
    /** Whether the channel filter field is expanded. */
    readonly isChannelFilterOpen = signal(false);

    constructor(
        readonly programSearch: MultiEpgProgramSearch,
        inputs: { channelFilter: InputRef; programSearch: InputRef }
    ) {
        // Move focus into each field as it opens, so it is usable from the
        // keyboard without a second click. Each effect re-runs when its panel
        // toggles and again when the `@if` finally stamps the input, so it
        // focuses the element on the pass where it actually exists.
        effect(() => {
            if (this.isChannelFilterOpen()) {
                inputs.channelFilter()?.nativeElement.focus();
            }
        });
        effect(() => {
            if (programSearch.isOpen()) {
                inputs.programSearch()?.nativeElement.focus();
            }
        });
    }

    toggleChannelFilter(): void {
        this.isChannelFilterOpen.update((open) => !open);
        if (!this.isChannelFilterOpen()) this.channelFilter.set('');
    }

    /**
     * Escape while typing closes that field. Propagation is stopped only when a
     * field is actually open, so a guide rendered inside a CDK overlay closes
     * the field first and the overlay only on the next Escape.
     */
    onChannelFilterEscape(event: Event): void {
        if (!this.isChannelFilterOpen()) return;
        event.stopPropagation();
        this.toggleChannelFilter();
    }

    onProgramSearchEscape(event: Event): void {
        if (!this.programSearch.isOpen()) return;
        event.stopPropagation();
        this.programSearch.toggle();
    }
}
