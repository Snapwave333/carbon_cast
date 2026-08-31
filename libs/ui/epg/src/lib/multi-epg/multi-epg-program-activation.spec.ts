import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { MultiEpgLayoutChannel } from './multi-epg-layout.util';
import {
    activateMultiEpgProgram,
    MultiEpgProgramActivator,
    openMultiEpgProgramDetails,
} from './multi-epg-program-activation';
import { MultiEpgPlayRequest } from './multi-epg-program-dialog';

function makeDialog() {
    const open = jest.fn().mockReturnValue({ afterClosed: () => of(null) });
    return { open } as unknown as MatDialog & { open: jest.Mock };
}

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

function channel(isPlayable: boolean): MultiEpgLayoutChannel {
    return {
        id: 'channel-1',
        displayName: 'Channel One',
        iconUrl: null,
        programs: [],
        safeIconUrl: '',
        isPlayable,
    } as unknown as MultiEpgLayoutChannel;
}

/** A window that always contains "now", so the programme is airing. */
function airingNow() {
    const now = Date.now();
    return program(
        new Date(now - 30 * 60_000).toISOString(),
        new Date(now + 30 * 60_000).toISOString()
    );
}

describe('activateMultiEpgProgram', () => {
    it('tunes straight to the channel for a programme airing now', () => {
        const dialog = makeDialog();
        const onPlay = jest.fn();

        activateMultiEpgProgram({
            dialog,
            program: airingNow(),
            channel: channel(true),
            channelName: 'Channel One',
            isPlayable: true,
            catchupResolver: null,
            width: '600px',
            onPlay,
        });

        expect(onPlay).toHaveBeenCalledWith({
            channelId: 'channel-1',
            channelName: 'Channel One',
            mode: 'live',
        });
        // Switching is the point; a dialog in between made it two clicks.
        expect(dialog.open).not.toHaveBeenCalled();
    });

    it('tunes to the channel for a programme that is not on now', () => {
        const dialog = makeDialog();
        const onPlay = jest.fn();
        const future = Date.now() + 3 * 60 * 60_000;

        activateMultiEpgProgram({
            dialog,
            program: program(
                new Date(future).toISOString(),
                new Date(future + 60 * 60_000).toISOString()
            ),
            channel: channel(true),
            channelName: 'Channel One',
            isPlayable: true,
            catchupResolver: null,
            width: '600px',
            onPlay,
        });

        // Selecting any cell picks the channel. Gating on "is this airing?"
        // meant clicking a show that started ten minutes ago opened a
        // description card instead of playing anything.
        expect(onPlay).toHaveBeenCalledWith({
            channelId: 'channel-1',
            channelName: 'Channel One',
            mode: 'live',
        });
        expect(dialog.open).not.toHaveBeenCalled();
    });

    it('never opens the card on a plain selection, even off-playlist', () => {
        const dialog = makeDialog();
        const onPlay = jest.fn();

        activateMultiEpgProgram({
            dialog,
            program: airingNow(),
            channel: channel(false),
            channelName: 'Channel One',
            isPlayable: false,
            catchupResolver: null,
            width: '600px',
            onPlay,
        });

        // The host owns resolution and reports the failure, so the guide does
        // not need to pre-judge it — and the card stays strictly opt-in.
        expect(dialog.open).not.toHaveBeenCalled();
        expect(onPlay).toHaveBeenCalled();
    });
});

describe('openMultiEpgProgramDetails', () => {
    it('opens the card, with play actions suppressed off-playlist', () => {
        const dialog = makeDialog();
        const onPlay = jest.fn();

        openMultiEpgProgramDetails({
            dialog,
            program: airingNow(),
            channel: channel(false),
            channelName: 'Channel One',
            isPlayable: false,
            catchupResolver: null,
            width: '600px',
            onPlay,
        });

        expect(dialog.open).toHaveBeenCalled();
        expect(dialog.open.mock.calls[0][1].data.primaryAction).toBeNull();
        expect(onPlay).not.toHaveBeenCalled();
    });
});

describe('MultiEpgProgramActivator', () => {
    it('reports channels as playable when no resolver is supplied', () => {
        const activator = new MultiEpgProgramActivator({
            dialog: makeDialog(),
            channels: () => [],
            catchupResolver: () => null,
            availabilityResolver: () => null,
            onPlay: jest.fn(),
        });

        expect(activator.isPlayable(channel(true))).toBe(true);
    });

    it('defers to the host resolver, reading it late', () => {
        let available = false;
        const activator = new MultiEpgProgramActivator({
            dialog: makeDialog(),
            channels: () => [],
            catchupResolver: () => null,
            availabilityResolver: () => () => available,
            onPlay: jest.fn(),
        });

        expect(activator.isPlayable(channel(true))).toBe(false);
        // The host input can change after construction.
        available = true;
        expect(activator.isPlayable(channel(true))).toBe(true);
    });

    it('passes the resolved channel through when activating', () => {
        const dialog = makeDialog();
        const onPlay = jest.fn<void, [MultiEpgPlayRequest]>();
        const activator = new MultiEpgProgramActivator({
            dialog,
            channels: () => [channel(true)],
            catchupResolver: () => null,
            availabilityResolver: () => () => true,
            onPlay,
        });

        activator.activate(airingNow(), '600px');

        expect(onPlay).toHaveBeenCalledWith(
            expect.objectContaining({
                channelId: 'channel-1',
                channelName: 'Channel One',
                mode: 'live',
            })
        );
    });
});
