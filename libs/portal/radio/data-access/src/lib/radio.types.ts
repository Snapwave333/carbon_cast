/**
 * Domain models for the Radio workspace section.
 *
 * Two catalogues feed it, both key-free and signup-free:
 * - Radio Browser (https://api.radio-browser.info) for live stations
 * - the Apple iTunes Search API plus the show's own RSS feed for podcasts
 *
 * The raw shapes of both services are normalized into the types below so the
 * UI never has to know which catalogue an item came from.
 */

export interface RadioStation {
    /** Radio Browser `stationuuid`. */
    id: string;
    name: string;
    /** Playable stream, already resolved through Radio Browser's redirects. */
    streamUrl: string;
    homepage: string;
    favicon: string;
    tags: string[];
    country: string;
    countryCode: string;
    languages: string[];
    codec: string;
    /** Advertised bitrate in kbps; 0 when the station does not report one. */
    bitrate: number;
    votes: number;
    clickCount: number;
    isHls: boolean;
    /** False when Radio Browser's last health check could not reach the stream. */
    isOnline: boolean;
}

export interface RadioFacet {
    name: string;
    /** ISO country code for country facets, empty for tags and languages. */
    code: string;
    stationCount: number;
}

/** Matches Radio Browser's `order` parameter; `tags` orders by genre. */
export type RadioStationOrder =
    | 'votes'
    | 'clickcount'
    | 'clicktrend'
    | 'name'
    | 'bitrate'
    | 'country'
    | 'tags';

export interface RadioStationQuery {
    name?: string;
    country?: string;
    countryCode?: string;
    language?: string;
    tag?: string;
    order?: RadioStationOrder;
    reverse?: boolean;
    limit?: number;
    offset?: number;
}

export interface PodcastShow {
    /** iTunes `collectionId`, or the feed URL for manually added shows. */
    id: string;
    title: string;
    author: string;
    feedUrl: string;
    artwork: string;
    genres: string[];
    episodeCount: number | null;
    description: string;
    websiteUrl: string;
}

export interface PodcastEpisode {
    /** Feed `<guid>`, falling back to the audio URL. */
    id: string;
    showId: string;
    showTitle: string;
    title: string;
    audioUrl: string;
    /** Null when the feed omits a duration or states it in an unparsable form. */
    durationSeconds: number | null;
    /** ISO 8601, or null when `<pubDate>` is missing or unparsable. */
    publishedAt: string | null;
    description: string;
    artwork: string;
}

export interface PodcastFeed {
    title: string;
    description: string;
    artwork: string;
    websiteUrl: string;
    episodes: PodcastEpisode[];
}

export type RadioTrackKind = 'station' | 'episode';

/**
 * What the player is playing. Stations are endless streams (no seeking);
 * episodes are finite files (seekable, resumable).
 */
export interface RadioTrack {
    kind: RadioTrackKind;
    id: string;
    title: string;
    subtitle: string;
    artwork: string;
    streamUrl: string;
    homepage: string;
    /** Known duration in seconds for episodes; null for live stations. */
    durationSeconds: number | null;
}

export function stationToTrack(station: RadioStation): RadioTrack {
    return {
        kind: 'station',
        id: station.id,
        title: station.name,
        subtitle: [station.country, station.tags[0]].filter(Boolean).join(' · '),
        artwork: station.favicon,
        streamUrl: station.streamUrl,
        homepage: station.homepage,
        durationSeconds: null,
    };
}

export function episodeToTrack(episode: PodcastEpisode): RadioTrack {
    return {
        kind: 'episode',
        id: episode.id,
        title: episode.title,
        subtitle: episode.showTitle,
        artwork: episode.artwork,
        streamUrl: episode.audioUrl,
        homepage: '',
        durationSeconds: episode.durationSeconds,
    };
}
