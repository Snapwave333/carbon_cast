import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
    isProgramAiringNowByTime,
    openMultiEpgProgramDialog,
} from './multi-epg-program-dialog';

describe('isProgramAiringNowByTime', () => {
    const nowMs = Date.parse('2026-08-13T12:30:00.000Z');

    function program(start: string, stop: string) {
        return {
            start,
            stop,
            channel: 'channel-1',
            title: 'Show',
            desc: null,
            category: null,
        };
    }

    it('is true only while now is inside the programme window', () => {
        expect(
            isProgramAiringNowByTime(
                program('2026-08-13T12:00:00.000Z', '2026-08-13T13:00:00.000Z'),
                nowMs
            )
        ).toBe(true);
        expect(
            isProgramAiringNowByTime(
                program('2026-08-13T13:00:00.000Z', '2026-08-13T14:00:00.000Z'),
                nowMs
            )
        ).toBe(false);
        expect(
            isProgramAiringNowByTime(
                program('2026-08-13T11:00:00.000Z', '2026-08-13T12:30:00.000Z'),
                nowMs
            )
        ).toBe(false);
    });

    it('offers "Watch from start" for past programmes with catch-up', () => {
        const realNow = Date.now();
        const pastProgram = {
            ...program(
                new Date(realNow - 3 * 3_600_000).toISOString(),
                new Date(realNow - 2 * 3_600_000).toISOString()
            ),
            title: 'Yesterday Movie',
        };
        const onPlay = jest.fn();
        const dialog = {
            open: jest.fn().mockReturnValue({
                afterClosed: () => of('timeshift'),
            }),
        } as unknown as MatDialog;

        openMultiEpgProgramDialog({
            dialog,
            program: pastProgram,
            channel: undefined,
            catchupResolver: () => ({ available: true, archiveDays: 7 }),
            width: '600px',
            onPlay,
        });

        expect(
            (dialog.open as jest.Mock).mock.calls[0][1].data.primaryAction
        ).toBe('timeshift');
        expect(onPlay).toHaveBeenCalledWith({
            channelId: 'channel-1',
            channelName: null,
            mode: 'timeshift',
            program: pastProgram,
        });
    });

    it('offers no action for past programmes outside the archive window or without catch-up', () => {
        const realNow = Date.now();
        const twelveDaysMs = 12 * 24 * 3_600_000;
        const pastProgram = program(
            new Date(realNow - twelveDaysMs).toISOString(),
            new Date(realNow - twelveDaysMs + 3_600_000).toISOString()
        );
        const dialogActions: (string | null)[] = [];
        const dialog = {
            open: jest.fn((_, config) => {
                dialogActions.push(config.data.primaryAction);
                return { afterClosed: () => of(undefined) };
            }),
        } as unknown as MatDialog;

        // 12 days old with a 7-day window → outside archive.
        openMultiEpgProgramDialog({
            dialog,
            program: pastProgram,
            channel: undefined,
            catchupResolver: () => ({ available: true, archiveDays: 7 }),
            width: '600px',
            onPlay: jest.fn(),
        });
        // No catch-up capability at all.
        openMultiEpgProgramDialog({
            dialog,
            program: pastProgram,
            channel: undefined,
            catchupResolver: null,
            width: '600px',
            onPlay: jest.fn(),
        });

        expect(dialogActions).toEqual([null, null]);
    });

    it('prefers unix timestamps and rejects invalid dates', () => {
        expect(
            isProgramAiringNowByTime(
                {
                    ...program('invalid', 'invalid'),
                    startTimestamp: nowMs / 1000 - 60,
                    stopTimestamp: nowMs / 1000 + 60,
                },
                nowMs
            )
        ).toBe(true);
        expect(
            isProgramAiringNowByTime(program('invalid', 'also-invalid'), nowMs)
        ).toBe(false);
    });
});
