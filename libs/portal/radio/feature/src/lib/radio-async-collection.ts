import { signal } from '@angular/core';

export interface AsyncState<T> {
    items: T[];
    isLoading: boolean;
    error: string | null;
}

/**
 * A list fetched from a remote catalogue, together with its loading and error
 * state.
 *
 * Every panel in the radio page issues requests the user can outrun — typing
 * further into a search box, switching browse modes, opening another show.
 * `run` tags each request and drops the answer to any request that a newer one
 * has already superseded, so a slow early response can never overwrite the
 * results the user is actually looking at.
 */
export class AsyncCollection<T> {
    readonly state = signal<AsyncState<T>>({
        items: [],
        isLoading: false,
        error: null,
    });

    private requestId = 0;

    async run(
        load: () => Promise<T[]>,
        onError?: (error: unknown) => void
    ): Promise<void> {
        const requestId = ++this.requestId;
        this.state.update((current) => ({
            ...current,
            isLoading: true,
            error: null,
        }));

        try {
            const items = await load();
            if (requestId === this.requestId) {
                this.state.set({ items, isLoading: false, error: null });
            }
        } catch (error) {
            if (requestId !== this.requestId) {
                return;
            }

            onError?.(error);
            // Keep whatever the user is already looking at: a failed refresh
            // (one more keystroke, a mirror returning 503) must not clear a
            // list that is still perfectly usable.
            this.state.update((current) => ({
                ...current,
                isLoading: false,
                error: error instanceof Error ? error.message : String(error),
            }));
        }
    }

    reset(): void {
        this.requestId++;
        this.state.set({ items: [], isLoading: false, error: null });
    }
}

/** Collapses a burst of calls into the last one. */
export class Debouncer {
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly delayMs: number) {}

    schedule(run: () => void): void {
        this.cancel();
        this.timer = setTimeout(() => {
            this.timer = null;
            run();
        }, this.delayMs);
    }

    cancel(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
