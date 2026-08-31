import {
    CHANNEL_SOURCE_PROVIDERS,
    ChannelSource,
} from './channel-source.model';

/**
 * Hand-picked entries that head the Discover list.
 *
 * These are kept out of the generated data file so regenerating the country
 * and category slices never clobbers a curated description or a hand-checked
 * EPG URL.
 */
export const FEATURED_CHANNEL_SOURCES: readonly ChannelSource[] = [
    {
        id: 'iptv-org:featured:all',
        kind: 'featured',
        name: 'iptv-org — all channels',
        url: 'https://iptv-org.github.io/iptv/index.m3u',
        provider: CHANNEL_SOURCE_PROVIDERS.iptvOrg,
        streamCount: 16955,
        descriptionKey: 'HOME.DISCOVER.FEATURED.IPTV_ORG_ALL',
    },
    {
        id: 'iptv-org:featured:by-country',
        kind: 'featured',
        name: 'iptv-org — grouped by country',
        url: 'https://iptv-org.github.io/iptv/index.country.m3u',
        provider: CHANNEL_SOURCE_PROVIDERS.iptvOrg,
        streamCount: 16955,
        descriptionKey: 'HOME.DISCOVER.FEATURED.IPTV_ORG_COUNTRY',
    },
    {
        id: 'iptv-org:featured:by-category',
        kind: 'featured',
        name: 'iptv-org — grouped by category',
        url: 'https://iptv-org.github.io/iptv/index.category.m3u',
        provider: CHANNEL_SOURCE_PROVIDERS.iptvOrg,
        streamCount: 16955,
        descriptionKey: 'HOME.DISCOVER.FEATURED.IPTV_ORG_CATEGORY',
    },
    {
        id: 'iptv-org:featured:by-language',
        kind: 'featured',
        name: 'iptv-org — grouped by language',
        url: 'https://iptv-org.github.io/iptv/index.language.m3u',
        provider: CHANNEL_SOURCE_PROVIDERS.iptvOrg,
        streamCount: 16955,
        descriptionKey: 'HOME.DISCOVER.FEATURED.IPTV_ORG_LANGUAGE',
    },
    {
        id: 'free-tv:featured:curated',
        kind: 'featured',
        name: 'Free-TV — curated worldwide list',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
        provider: CHANNEL_SOURCE_PROVIDERS.freeTv,
        streamCount: 1400,
        descriptionKey: 'HOME.DISCOVER.FEATURED.FREE_TV',
    },
    {
        // The only catalogue entry that ships with a guide: this provider
        // publishes matching XMLTV, so the imported playlist has a working EPG
        // immediately. The iptv-org lists carry no `x-tvg-url` at all.
        id: 'mjh:featured:world',
        kind: 'featured',
        name: 'i.mjh.nz — worldwide free-to-air',
        url: 'https://i.mjh.nz/world/raw-tv.m3u8',
        provider: CHANNEL_SOURCE_PROVIDERS.mjh,
        streamCount: 12,
        descriptionKey: 'HOME.DISCOVER.FEATURED.MJH_WORLD',
        epgUrls: ['https://i.mjh.nz/world/epg.xml'],
    },
];
