import { resolveChannelEpgLookupKey } from '@iptvnator/m3u-state';
import { Channel } from '@iptvnator/shared/interfaces';

const lookupKeyCache = new WeakMap<Channel, string>();

/**
 * Memoized {@link resolveChannelEpgLookupKey}.
 *
 * Every visible row resolves the key several times per change-detection pass
 * (logo, programme, progress) and resolution trims/normalizes strings, so on a
 * 90,000-channel playlist the repeat work is significant. Channel objects are
 * replaced rather than mutated once parsed, which makes the result cacheable
 * per object.
 */
export function channelEpgLookupKey(
    channel: Channel | null | undefined
): string {
    if (!channel) {
        return '';
    }

    const cached = lookupKeyCache.get(channel);
    if (cached !== undefined) {
        return cached;
    }

    const key = resolveChannelEpgLookupKey(channel) ?? '';
    lookupKeyCache.set(channel, key);
    return key;
}
