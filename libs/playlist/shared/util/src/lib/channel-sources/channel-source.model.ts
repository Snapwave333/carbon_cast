/**
 * The free-channel catalogue: a browsable index of public, no-signup IPTV
 * playlists that can be imported in one click.
 *
 * Every entry points at a playlist published by a third party. The app hosts
 * no streams and re-publishes nothing; the catalogue is a set of bookmarks,
 * which is why each entry names its provider and links to that provider's
 * page.
 */

export type ChannelSourceKind =
    'featured' | 'country' | 'region' | 'category' | 'language';

/** Shape written by `tools/channel-sources/build-catalog.mjs`. */
export interface GeneratedChannelSource {
    readonly id: string;
    readonly kind: Exclude<ChannelSourceKind, 'featured'>;
    readonly code: string;
    readonly name: string;
    readonly flag?: string;
    readonly url: string;
    readonly streamCount: number;
}

export interface ChannelSource {
    /** Stable across regenerations; used as the selection key. */
    readonly id: string;
    readonly kind: ChannelSourceKind;
    readonly name: string;
    /** ISO country / region / category / language code, when the kind has one. */
    readonly code?: string;
    readonly flag?: string;
    readonly url: string;
    /** Attribution — shown on every row, never inferred from the URL. */
    readonly provider: ChannelSourceProvider;
    /** Stream count at snapshot time. Indicative, not a promise. */
    readonly streamCount: number;
    /** Translation key for the one-line description of a featured entry. */
    readonly descriptionKey?: string;
    /** EPG sources to enable on import, when the provider publishes one. */
    readonly epgUrls?: readonly string[];
}

export interface ChannelSourceProvider {
    readonly id: string;
    readonly name: string;
    readonly homepage: string;
}

export const CHANNEL_SOURCE_PROVIDERS = {
    iptvOrg: {
        id: 'iptv-org',
        name: 'iptv-org',
        homepage: 'https://github.com/iptv-org/iptv',
    },
    freeTv: {
        id: 'free-tv',
        name: 'Free-TV',
        homepage: 'https://github.com/Free-TV/IPTV',
    },
    mjh: {
        id: 'mjh',
        name: 'i.mjh.nz',
        homepage: 'https://i.mjh.nz/',
    },
} as const satisfies Record<string, ChannelSourceProvider>;
