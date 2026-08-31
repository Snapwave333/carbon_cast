import { signal } from '@angular/core';
import { MultiEpgTimeAxis } from './multi-epg-time-axis';

describe('MultiEpgTimeAxis', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    function axisAt(date: Date, hourWidth = 150): MultiEpgTimeAxis {
        jest.useFakeTimers().setSystemTime(date);
        return new MultiEpgTimeAxis(signal(hourWidth));
    }

    it('steps the shown day forward and back', () => {
        const axis = axisAt(new Date(2026, 4, 15, 12, 0));

        expect(axis.today()).toBe('20260515');
        axis.switchDay('next');
        expect(axis.today()).toBe('20260516');
        axis.switchDay('prev');
        axis.switchDay('prev');
        expect(axis.today()).toBe('20260514');
    });

    it('reports whether the shown day is the real current day', () => {
        const axis = axisAt(new Date(2026, 4, 15, 12, 0));

        expect(axis.isToday()).toBe(true);
        axis.switchDay('next');
        expect(axis.isToday()).toBe(false);
    });

    it('returns to the current day from another day', () => {
        const axis = axisAt(new Date(2026, 4, 15, 12, 0));

        axis.switchDay('prev');
        axis.returnToToday();

        expect(axis.today()).toBe('20260515');
        expect(axis.isToday()).toBe(true);
    });

    it('places the playhead and now-label from the wall clock and zoom', () => {
        const hourWidth = signal(150);
        jest.useFakeTimers().setSystemTime(new Date(2026, 4, 15, 9, 30));
        const axis = new MultiEpgTimeAxis(hourWidth);

        // 9.5 hours * 150px/hour.
        expect(axis.playheadX()).toBeCloseTo(1425);
        expect(axis.nowLabel()).toBe('09:30');

        hourWidth.set(200);
        expect(axis.playheadX()).toBeCloseTo(1900);
    });

    it('advances the playhead on the minute clock and freezes once stopped', () => {
        const axis = axisAt(new Date(2026, 4, 15, 9, 30), 60);
        axis.start();

        // Advancing the fake clock a minute both moves `Date.now()` forward and
        // fires the interval, so the label tracks the wall clock.
        jest.advanceTimersByTime(60_000);
        expect(axis.nowLabel()).toBe('09:31');

        axis.stop();
        jest.advanceTimersByTime(60_000);
        // The clock is stopped, so the label stays at the last tick.
        expect(axis.nowLabel()).toBe('09:31');
    });
});
