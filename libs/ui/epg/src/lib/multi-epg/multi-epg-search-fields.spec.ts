import { ApplicationRef, ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MultiEpgProgramSearch } from './multi-epg-program-search';
import { MultiEpgSearchFields } from './multi-epg-search-fields';

function makeInput() {
    const focus = jest.fn();
    const ref = signal<ElementRef<HTMLInputElement> | undefined>(undefined);
    return {
        focus,
        ref,
        /** Simulate the `@if` finally stamping the input into the DOM. */
        present: () =>
            ref.set({
                nativeElement: { focus },
            } as unknown as ElementRef<HTMLInputElement>),
    };
}

describe('MultiEpgSearchFields', () => {
    let programSearch: MultiEpgProgramSearch;
    let channelInput: ReturnType<typeof makeInput>;
    let programInput: ReturnType<typeof makeInput>;

    beforeEach(() => {
        programSearch = new MultiEpgProgramSearch(
            jest.fn().mockResolvedValue([]),
            () => true
        );
        channelInput = makeInput();
        programInput = makeInput();
    });

    function create(): MultiEpgSearchFields {
        // Construction registers focus effects, so it must run in an injection
        // context.
        return TestBed.runInInjectionContext(
            () =>
                new MultiEpgSearchFields(programSearch, {
                    channelFilter: channelInput.ref,
                    programSearch: programInput.ref,
                })
        );
    }

    it('clears the channel query when the field closes', () => {
        const fields = create();

        fields.toggleChannelFilter();
        fields.channelFilter.set('bbc');
        expect(fields.isChannelFilterOpen()).toBe(true);

        fields.toggleChannelFilter();

        expect(fields.isChannelFilterOpen()).toBe(false);
        expect(fields.channelFilter()).toBe('');
    });

    it('closes an open channel filter on Escape and stops propagation', () => {
        const fields = create();
        fields.toggleChannelFilter();
        const event = { stopPropagation: jest.fn() } as unknown as Event;

        fields.onChannelFilterEscape(event);

        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(fields.isChannelFilterOpen()).toBe(false);
    });

    it('lets Escape bubble when no field is open, to close a host overlay', () => {
        const fields = create();
        const event = { stopPropagation: jest.fn() } as unknown as Event;

        fields.onChannelFilterEscape(event);

        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it('closes an open programme search on Escape and stops propagation', () => {
        const fields = create();
        programSearch.toggle();
        const event = { stopPropagation: jest.fn() } as unknown as Event;

        fields.onProgramSearchEscape(event);

        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(programSearch.isOpen()).toBe(false);
    });

    it('moves focus into the channel filter once it opens', () => {
        const fields = create();

        fields.toggleChannelFilter();
        channelInput.present();
        TestBed.inject(ApplicationRef).tick();

        expect(channelInput.focus).toHaveBeenCalled();
        expect(programInput.focus).not.toHaveBeenCalled();
    });
});
