import { Channel } from '@iptvnator/shared/interfaces';

/** Ceiling on the header-override IPC before playback starts without it. */
const REQUEST_HEADER_IPC_TIMEOUT_MS = 3000;

/**
 * Applies the channel's scoped user-agent/referer override in the main process.
 *
 * Awaiting this is the only thing between the user's click and the source
 * engine starting — the override only takes effect once the IPC lands, and
 * providers that gate on a user-agent reject a manifest requested without it.
 * The wait is therefore bounded: a main process wedged on a long import or a
 * dead bridge would otherwise leave the player permanently black with no
 * diagnostic, and playing with the default headers beats not playing at all.
 */
export async function configureRequestHeaders(channel: Channel): Promise<void> {
    if (!window.electron?.setUserAgent) {
        return;
    }

    try {
        await Promise.race([
            window.electron.setUserAgent(
                channel.http?.['user-agent'],
                channel.http?.referrer,
                channel.url
            ),
            new Promise((resolve) =>
                setTimeout(resolve, REQUEST_HEADER_IPC_TIMEOUT_MS)
            ),
        ]);
    } catch (error: unknown) {
        console.warn(
            '[HtmlVideoPlayer] Failed to configure Electron request headers:',
            error
        );
    }
}
