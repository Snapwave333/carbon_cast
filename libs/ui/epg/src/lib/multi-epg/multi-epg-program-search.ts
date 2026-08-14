import { signal } from '@angular/core';
import { EpgProgram } from '@iptvnator/shared/interfaces';

export interface ProgramSearchResult extends EpgProgram {
    channel_id?: string;
    channelName?: string | null;
    channel_name?: string | null;
    display_name?: string | null;
}

type SearchPrograms = (
    query: string,
    limit: number
) => Promise<EpgProgram[] | null>;

export class MultiEpgProgramSearch {
    readonly isOpen = signal(false);
    readonly query = signal('');
    readonly results = signal<ProgramSearchResult[]>([]);
    readonly isSearching = signal(false);
    readonly error = signal(false);

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private requestGeneration = 0;

    constructor(
        private readonly searchPrograms: SearchPrograms,
        private readonly canSearch: () => boolean,
        private readonly debounceMs = 350
    ) {}

    toggle(): void {
        this.isOpen.update((open) => !open);
        if (!this.isOpen()) this.clear();
    }

    update(query: string): void {
        const normalizedQuery = query.trim();
        this.query.set(normalizedQuery);
        this.cancelPendingRequest();
        this.results.set([]);
        this.isSearching.set(false);
        this.error.set(false);

        if (normalizedQuery.length < 2 || !this.canSearch()) {
            return;
        }

        const generation = this.requestGeneration;
        this.debounceTimer = setTimeout(
            () => void this.runSearch(normalizedQuery, generation),
            this.debounceMs
        );
    }

    clear(): void {
        this.cancelPendingRequest();
        this.query.set('');
        this.results.set([]);
        this.isSearching.set(false);
        this.error.set(false);
    }

    destroy(): void {
        this.clear();
    }

    private async runSearch(query: string, generation: number): Promise<void> {
        this.isSearching.set(true);
        this.error.set(false);
        try {
            const results = await this.searchPrograms(query, 20);
            if (generation !== this.requestGeneration) return;
            this.results.set((results as ProgramSearchResult[]) ?? []);
        } catch {
            if (generation !== this.requestGeneration) return;
            this.results.set([]);
            this.error.set(true);
        } finally {
            if (generation === this.requestGeneration) {
                this.isSearching.set(false);
            }
        }
    }

    private cancelPendingRequest(): void {
        this.requestGeneration += 1;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
    }
}
