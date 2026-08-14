import { computed, inject, Injectable, signal } from '@angular/core';
import { RadioBrowserService } from './radio-browser.service';
import { RadioLibraryStore } from './radio-library.store';
import { RadioTrack } from './radio.types';

export type RadioPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * What the radio player is playing and what comes after it.
 *
 * The store owns intent (this track, from this queue); the player component
 * owns the `<audio>` element and reports back the status it observes. Keeping
 * them apart lets any part of the radio page start playback without reaching
 * into the player's view.
 */
@Injectable({ providedIn: 'root' })
export class RadioPlayerStore {
    private readonly radioBrowser = inject(RadioBrowserService);
    private readonly library = inject(RadioLibraryStore);

    private readonly queueState = signal<RadioTrack[]>([]);
    private readonly indexState = signal(-1);

    readonly queue = this.queueState.asReadonly();
    readonly status = signal<RadioPlaybackStatus>('idle');
    readonly errorMessage = signal<string | null>(null);

    readonly current = computed<RadioTrack | null>(() => {
        const index = this.indexState();
        return this.queueState()[index] ?? null;
    });
    readonly hasPrevious = computed(() => this.indexState() > 0);
    readonly hasNext = computed(
        () => this.indexState() >= 0 && this.indexState() < this.queueState().length - 1
    );

    isCurrent(trackId: string): boolean {
        return this.current()?.id === trackId;
    }

    /**
     * Starts `track`. When `queue` is given, it becomes the surrounding queue
     * so next/previous walk the list the user started from.
     */
    play(track: RadioTrack, queue?: readonly RadioTrack[]): void {
        const nextQueue = queue?.length ? [...queue] : [track];
        const index = nextQueue.findIndex(
            (entry) => entry.id === track.id && entry.kind === track.kind
        );

        this.queueState.set(nextQueue);
        this.indexState.set(index >= 0 ? index : 0);
        this.status.set('loading');
        this.errorMessage.set(null);

        this.library.rememberPlayed(track);
        if (track.kind === 'station') {
            void this.radioBrowser.reportStationClick(track.id);
        }
    }

    next(): void {
        if (this.hasNext()) {
            this.moveTo(this.indexState() + 1);
        }
    }

    previous(): void {
        if (this.hasPrevious()) {
            this.moveTo(this.indexState() - 1);
        }
    }

    stop(): void {
        this.queueState.set([]);
        this.indexState.set(-1);
        this.status.set('idle');
        this.errorMessage.set(null);
    }

    reportError(message: string): void {
        this.status.set('error');
        this.errorMessage.set(message);
    }

    private moveTo(index: number): void {
        const track = this.queueState()[index];
        if (!track) {
            return;
        }

        this.indexState.set(index);
        this.status.set('loading');
        this.errorMessage.set(null);
        this.library.rememberPlayed(track);
        if (track.kind === 'station') {
            void this.radioBrowser.reportStationClick(track.id);
        }
    }
}
