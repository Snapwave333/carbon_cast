import { Component, computed, input, OnDestroy, signal } from '@angular/core';

@Component({
    selector: 'app-broadcast-remaining-time',
    template: `<span [attr.aria-label]="label()">{{ label() }}</span>`,
})
export class BroadcastRemainingTimeComponent implements OnDestroy {
    readonly startAt = input.required<string>();
    readonly endAt = input.required<string>();
    private readonly now = signal(Date.now());
    private readonly timerId = setInterval(
        () => this.now.set(Date.now()),
        1_000
    );

    readonly label = computed(() => {
        const now = this.now();
        const start = Date.parse(this.startAt());
        const end = Date.parse(this.endAt());
        if (now >= end) return 'Ended';
        if (now >= start) return `${formatDuration(end - now)} remaining`;
        return `Starts in ${formatDuration(start - now)}`;
    });

    ngOnDestroy(): void {
        clearInterval(this.timerId);
    }
}

function formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(durationMs / 1_000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
}
