import { signal } from '@angular/core';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { ElectronBridgeEpgChannelWithPrograms } from '@iptvnator/shared/interfaces';

/**
 * Paged loading of EPG channels for the guide grid. Generation-gated so a
 * reset (playlist refresh) invalidates any in-flight page instead of letting
 * stale results repopulate the cleared grid.
 */
export class MultiEpgChannelBrowser {
    readonly data = signal<ElectronBridgeEpgChannelWithPrograms[]>([]);
    readonly isLoading = signal(false);
    readonly loadError = signal(false);
    readonly isLastPage = signal(false);
    visibleChannels = 20;

    private lowerRange = 0;
    private dataGeneration = 0;
    private loadingGeneration: number | null = null;

    constructor(private readonly epgBridge: EpgRuntimeBridgeService) {}

    async requestPrograms(): Promise<void> {
        if (!this.epgBridge.supportsChannelBrowser) {
            console.warn('Multi-EPG not available in this runtime');
            return;
        }

        const generation = this.dataGeneration;
        if (this.loadingGeneration === generation || this.isLastPage()) {
            return;
        }

        this.loadingGeneration = generation;
        this.isLoading.set(true);
        this.loadError.set(false);

        try {
            const response = await this.epgBridge.getChannelsByRange(
                this.lowerRange,
                this.visibleChannels
            );

            if (generation !== this.dataGeneration) return;
            if (response && Array.isArray(response)) {
                this.data.update((data) => [...data, ...response]);
                this.isLastPage.set(response.length < this.visibleChannels);
                this.lowerRange += response.length;
            }
        } catch (error) {
            console.error('Error fetching EPG data:', error);
            if (generation === this.dataGeneration) this.loadError.set(true);
        } finally {
            if (this.loadingGeneration === generation) {
                this.loadingGeneration = null;
                this.isLoading.set(false);
            }
        }
    }

    reset(): void {
        this.dataGeneration += 1;
        this.loadingGeneration = null;
        this.lowerRange = 0;
        this.data.set([]);
        this.isLoading.set(false);
        this.loadError.set(false);
        this.isLastPage.set(false);
    }

    /** Drops any in-flight page without clearing the data (destroy path). */
    invalidate(): void {
        this.dataGeneration += 1;
    }
}
