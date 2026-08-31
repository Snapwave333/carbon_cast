import { MatDialog } from '@angular/material/dialog';
import {
    ElectronBridgeEpgChannelWithPrograms,
    EpgProgram,
} from '@iptvnator/shared/interfaces';
import {
    getEpgChannelName,
    MultiEpgLayoutChannel,
} from './multi-epg-layout.util';
import {
    MultiEpgCatchupResolver,
    MultiEpgPlayRequest,
    openMultiEpgProgramDialog,
} from './multi-epg-program-dialog';

/**
 * Whether an EPG channel maps onto something the host playlist can actually
 * play. The guide lists channels from the EPG store, which is not scoped to
 * the open playlist, so a row may have no playable counterpart at all.
 *
 * Resolution stays with the host (it owns the playlist's `Channel[]`) so the
 * guide and the play handler can never disagree about what is playable.
 */
export type MultiEpgChannelAvailabilityResolver = (
    channelId: string,
    channelName: string | null
) => boolean;

export interface MultiEpgActivationOptions {
    dialog: MatDialog;
    program: EpgProgram & { channel_id?: string };
    channel: MultiEpgLayoutChannel | undefined;
    channelName: string | null;
    /** False when the channel has no counterpart in the open playlist. */
    isPlayable: boolean;
    catchupResolver: MultiEpgCatchupResolver | null;
    width: string;
    onPlay: (request: MultiEpgPlayRequest) => void;
}

/**
 * Selecting a programme tunes to its channel. Always — not only when the
 * programme is on right now.
 *
 * Clicking a cell is how users pick a channel in a TV guide, and gating that
 * on "is this airing?" meant picking a show that started ten minutes ago
 * opened a description card instead of playing anything. The details card is
 * now strictly opt-in via the cell's info button (`openMultiEpgProgramDetails`),
 * which is also where catch-up ("Watch from start") lives.
 *
 * The request is emitted even for channels outside the playlist: the host owns
 * resolution and reports the failure, so the guide never has to guess.
 */
export function activateMultiEpgProgram(
    options: MultiEpgActivationOptions
): void {
    const channelId = options.program.channel_id || options.program.channel;
    if (!channelId) {
        return;
    }

    options.onPlay({
        channelId,
        channelName: options.channelName,
        mode: 'live',
    });
}

/** Explicit "info" affordance: the programme description card. */
export function openMultiEpgProgramDetails(
    options: MultiEpgActivationOptions
): void {
    openMultiEpgProgramDialog({
        dialog: options.dialog,
        program: options.program,
        channel: options.channel,
        catchupResolver: options.catchupResolver,
        isPlayable: options.isPlayable,
        width: options.width,
        onPlay: options.onPlay,
    });
}

/**
 * Owns the guide's "what does clicking a programme do?" decision, keeping the
 * container thin. Dependencies are read through getters because the host
 * inputs behind them can change after construction.
 */
export class MultiEpgProgramActivator {
    constructor(
        private readonly deps: {
            dialog: MatDialog;
            channels: () => MultiEpgLayoutChannel[];
            catchupResolver: () => MultiEpgCatchupResolver | null;
            availabilityResolver: () => MultiEpgChannelAvailabilityResolver | null;
            onPlay: (request: MultiEpgPlayRequest) => void;
        }
    ) {}

    isPlayable(channel: ElectronBridgeEpgChannelWithPrograms): boolean {
        const resolver = this.deps.availabilityResolver();
        return resolver
            ? resolver(channel.id, getEpgChannelName(channel))
            : true;
    }

    activate(
        program: EpgProgram & { channel_id?: string },
        width: string
    ): void {
        activateMultiEpgProgram(this.optionsFor(program, width));
    }

    /** Info button on the cell; never reached by a plain click. */
    openDetails(
        program: EpgProgram & { channel_id?: string },
        width: string
    ): void {
        openMultiEpgProgramDetails(this.optionsFor(program, width));
    }

    private optionsFor(
        program: EpgProgram & { channel_id?: string },
        width: string
    ): MultiEpgActivationOptions {
        const channelId = program.channel_id || program.channel;
        const channel = this.deps
            .channels()
            .find((item) => item.id === channelId);

        return {
            dialog: this.deps.dialog,
            program,
            channel,
            channelName: channel ? getEpgChannelName(channel) : null,
            isPlayable: channel ? channel.isPlayable : true,
            catchupResolver: this.deps.catchupResolver(),
            width,
            onPlay: this.deps.onPlay,
        };
    }
}
