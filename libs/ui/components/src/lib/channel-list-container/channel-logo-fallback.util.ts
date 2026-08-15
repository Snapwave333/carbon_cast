import { Channel } from '@iptvnator/shared/interfaces';
import { channelEpgLookupKey } from './channel-epg-key.util';

export function resolveChannelLogo(
    channel: Channel | null | undefined,
    channelIconMap: ReadonlyMap<string, string | null | undefined>
): string {
    const playlistLogo = channel?.tvg?.logo?.trim();
    if (playlistLogo) {
        return playlistLogo;
    }

    const channelId = channelEpgLookupKey(channel);
    const epgIcon = channelId ? channelIconMap.get(channelId)?.trim() : '';

    return epgIcon || '';
}
