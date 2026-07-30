import { Channel } from '@iptvnator/shared/interfaces';

/**
 * A merged, canonical M3U category bucket. `key` is the canonical grouping key
 * (used for hidden-group matching and selection); `label` is the first-seen
 * human-readable display label. A channel that declares multiple groups appears
 * in one bucket per canonical key.
 */
export interface ChannelGroup {
    readonly key: string;
    readonly label: string;
    readonly channels: Channel[];
}
