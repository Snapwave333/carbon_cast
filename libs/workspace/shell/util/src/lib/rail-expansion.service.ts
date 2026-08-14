import { effect, Injectable, signal } from '@angular/core';

/**
 * Tracks whether the workspace rail is expanded to show full labelled tiles.
 *
 * The state is mirrored onto a `body.rail-expanded` class so the shell grid can
 * widen its rail column in pure CSS, without every layout consumer needing to
 * read the signal. The choice persists across sessions.
 */

const STORAGE_KEY = 'carboncast.rail.expanded';

function readStored(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

@Injectable({ providedIn: 'root' })
export class RailExpansionService {
    private readonly state = signal(readStored());
    readonly expanded = this.state.asReadonly();

    constructor() {
        effect(() => {
            const expanded = this.state();
            document.body.classList.toggle('rail-expanded', expanded);
            try {
                localStorage.setItem(STORAGE_KEY, String(expanded));
            } catch {
                // The rail simply reverts to collapsed on the next boot.
            }
        });
    }

    toggle(): void {
        this.state.update((value) => !value);
    }
}
