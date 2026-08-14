import { MatDialog } from '@angular/material/dialog';
import { EpgProgram } from '@iptvnator/shared/interfaces';
import { EpgItemDescriptionComponent } from '../epg-item-description/epg-item-description.component';
import { getProgramTimeMs } from '../epg-program.utils';
import { isWithinArchiveWindow } from '../epg-timeline/epg-archive.util';
import {
    getEpgChannelIcon,
    getEpgChannelName,
    MultiEpgLayoutChannel,
} from './multi-epg-layout.util';

/** Emitted when the user chooses "Watch live" / "Watch from start". */
export interface MultiEpgPlayRequest {
    channelId: string;
    channelName: string | null;
    mode: 'live' | 'timeshift';
    /** The programme to time-shift to (timeshift mode only). */
    program?: EpgProgram;
}

/** Per-channel catch-up capability supplied by the host playlist. */
export interface MultiEpgGuideCatchup {
    available: boolean;
    archiveDays: number;
}

export type MultiEpgCatchupResolver = (
    channelId: string,
    channelName: string | null
) => MultiEpgGuideCatchup | null;

/** Wall-clock check independent of the guide's day layout, so search
 * results from other days resolve correctly too. */
export function isProgramAiringNowByTime(
    program: EpgProgram,
    nowMs: number = Date.now()
): boolean {
    const startMs = getProgramTimeMs(program.start, program.startTimestamp);
    const stopMs = getProgramTimeMs(program.stop, program.stopTimestamp);
    return (
        Number.isFinite(startMs) &&
        Number.isFinite(stopMs) &&
        nowMs >= startMs &&
        nowMs < stopMs
    );
}

/**
 * Opens the programme details dialog from the guide. Programmes airing right
 * now get a "Watch live" primary action; past programmes on channels with
 * catch-up (within their archive window) get "Watch from start". Either
 * choice invokes `onPlay` so the host can start playback.
 */
export function openMultiEpgProgramDialog(options: {
    dialog: MatDialog;
    program: EpgProgram & { channel_id?: string };
    channel: MultiEpgLayoutChannel | undefined;
    catchupResolver: MultiEpgCatchupResolver | null;
    width: string;
    onPlay: (request: MultiEpgPlayRequest) => void;
}): void {
    const { dialog, program, channel, catchupResolver, width, onPlay } =
        options;
    const channelId = program.channel_id || program.channel;
    const channelName = channel ? getEpgChannelName(channel) : null;
    const catchup =
        channelId && catchupResolver
            ? catchupResolver(channelId, channelName)
            : null;
    const nowMs = Date.now();
    const startMs = getProgramTimeMs(program.start, program.startTimestamp);
    const stopMs = getProgramTimeMs(program.stop, program.stopTimestamp);
    const canPlayLive = !!channelId && isProgramAiringNowByTime(program, nowMs);
    const canTimeshift =
        !!channelId &&
        !canPlayLive &&
        Number.isFinite(stopMs) &&
        stopMs <= nowMs &&
        !!catchup?.available &&
        isWithinArchiveWindow(startMs, catchup.archiveDays, nowMs);

    dialog
        .open(EpgItemDescriptionComponent, {
            width,
            data: {
                ...program,
                channelName,
                channelLogo: channel
                    ? getEpgChannelIcon(channel) || null
                    : null,
                primaryAction: canPlayLive
                    ? 'live'
                    : canTimeshift
                      ? 'timeshift'
                      : null,
            },
        })
        .afterClosed()
        .subscribe((result) => {
            if (result === 'live' && canPlayLive) {
                onPlay({ channelId, channelName, mode: 'live' });
            } else if (result === 'timeshift' && canTimeshift) {
                onPlay({ channelId, channelName, mode: 'timeshift', program });
            }
        });
}
