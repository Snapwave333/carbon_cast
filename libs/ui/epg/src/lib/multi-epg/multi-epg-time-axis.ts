import { computed, signal, Signal } from '@angular/core';
import { addDays, format, parse, subDays } from 'date-fns';
import { isSelectedEpgDayToday } from './multi-epg-layout.util';

/**
 * The guide's time model: which day is shown, the live "now" playhead, and the
 * minute clock that drives it. Pure signals with no DOM — the container keeps
 * ownership of scrolling to the playhead — so the coordinator stays thin and
 * this logic is unit-testable on its own.
 */
export class MultiEpgTimeAxis {
    /** Selected day as `yyyyMMdd`, defaulting to the actual current day. */
    readonly today = signal(format(new Date(), 'yyyyMMdd'));

    /** Bumped every minute so the "now"-derived signals below stay live. */
    private readonly clockTick = signal(Date.now());

    private interval?: ReturnType<typeof setInterval>;

    /** Reads the guide's current pixels-per-hour to place the playhead. */
    constructor(private readonly hourWidth: Signal<number>) {}

    readonly selectedDayDate = computed(() =>
        parse(this.today(), 'yyyyMMdd', new Date())
    );

    readonly isToday = computed(() => {
        this.clockTick();
        return isSelectedEpgDayToday(this.today());
    });

    /** Horizontal offset of the "now" line, in guide pixels. */
    readonly playheadX = computed(() => {
        const now = new Date(this.clockTick());
        return (now.getHours() + now.getMinutes() / 60) * this.hourWidth();
    });

    /** "HH:mm" badge sitting on the now-line. */
    readonly nowLabel = computed(() => {
        const now = new Date(this.clockTick());
        return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    });

    /** Starts the minute clock. Call from `ngOnInit`. */
    start(): void {
        this.interval = setInterval(
            () => this.clockTick.set(Date.now()),
            60_000
        );
    }

    /** Stops the minute clock. Call from `ngOnDestroy`. */
    stop(): void {
        if (this.interval) clearInterval(this.interval);
    }

    /** Steps the shown day one earlier or later. */
    switchDay(direction: 'prev' | 'next'): void {
        const current = parse(this.today(), 'yyyyMMdd', new Date());
        const next =
            direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
        this.today.set(format(next, 'yyyyMMdd'));
    }

    /** Returns to the current day and re-reads the clock. */
    returnToToday(): void {
        this.today.set(format(new Date(), 'yyyyMMdd'));
        this.clockTick.set(Date.now());
    }
}

function pad(value: number): string {
    return value.toString().padStart(2, '0');
}
