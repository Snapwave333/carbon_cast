import { Channel } from '@iptvnator/shared/interfaces';

/**
 * Stable identity for a channel row across every channel list view.
 *
 * `id` is a random per-import value and is the only genuinely unique field:
 * playlists routinely repeat a URL across groups, which is why the container
 * de-duplicates by URL at all. `id` is not guaranteed though — channels built
 * outside the import path (global favorites, recently-viewed reconstruction)
 * fall back to the URL — and duplicate or `undefined` track keys make Angular
 * discard and rebuild rows, so the index closes the gap.
 */
export function channelTrackKey(
    channel: Channel | null | undefined,
    index: number
): string {
    return channel?.id || channel?.url || `index-${index}`;
}
