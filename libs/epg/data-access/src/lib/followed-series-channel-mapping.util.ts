import {
    Channel,
    FollowedSeriesChannelMapping,
    Playlist,
} from '@iptvnator/shared/interfaces';
import {
    normalizeFollowedSeriesTitle,
    stableHash,
} from './followed-series-normalization.util';

export interface FollowedSeriesChannelInventoryEntry {
    mapping: FollowedSeriesChannelMapping;
    channel: Channel;
}

export function buildFollowedSeriesChannelInventory(
    playlists: readonly Playlist[]
): FollowedSeriesChannelInventoryEntry[] {
    const result: FollowedSeriesChannelInventoryEntry[] = [];
    for (const playlist of playlists) {
        const items = resolvePlaylistItems(playlist);
        items.forEach((channel, index) => {
            const epgChannelIds = Array.from(
                new Set(
                    [
                        channel.tvg?.id,
                        channel.epgParams,
                        channel.tvg?.name,
                        channel.name,
                    ]
                        .map((value) => value?.trim())
                        .filter((value): value is string => Boolean(value))
                )
            );
            const channelId = channel.id?.trim() || stableHash(channel.url);
            result.push({
                mapping: {
                    id: `channel-${stableHash(`${playlist._id}|${channelId}`)}`,
                    playlistId: playlist._id,
                    channelId,
                    epgChannelIds,
                    name: channel.name,
                    normalizedName: normalizeFollowedSeriesTitle(channel.name),
                    number: index + 1,
                    logo: channel.tvg?.logo?.trim() || null,
                    group: channel.group?.title?.trim() || null,
                    preferred: false,
                },
                channel,
            });
        });
    }
    return result;
}

export function isSupportedFollowedSeriesStreamUrl(value: string): boolean {
    return /^(?:https?|rtmps?|udp):\/\//i.test(value.trim());
}

export async function probeFollowedSeriesStream(
    url: string,
    probe?: (url: string, method: 'GET') => Promise<{ status: number }>
): Promise<boolean> {
    if (!isSupportedFollowedSeriesStreamUrl(url)) return false;
    if (!probe || !/^https?:/i.test(url)) return true;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const result = await probe(url, 'GET');
            if (result.status >= 200 && result.status < 400) return true;
        } catch {
            // The bounded second attempt is intentionally silent and redacted.
        }
    }
    return false;
}

function resolvePlaylistItems(playlist: Playlist): Channel[] {
    const parsedItems = (playlist.playlist as { items?: unknown[] } | undefined)
        ?.items;
    const items = parsedItems ?? playlist.items ?? [];
    return items.filter(isChannel);
}

function isChannel(value: unknown): value is Channel {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Channel>;
    return (
        typeof candidate.url === 'string' &&
        candidate.url.trim().length > 0 &&
        typeof candidate.name === 'string'
    );
}
