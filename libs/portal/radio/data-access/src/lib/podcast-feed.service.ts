import { inject, Injectable } from '@angular/core';
import { parsePodcastFeed } from './podcast-feed.parser';
import { PodcastFeed, PodcastShow } from './radio.types';
import { RemoteTextService } from './remote-text.service';

const FEED_CACHE_TTL_MS = 30 * 60 * 1000;
const FEED_CACHE_MAX_ENTRIES = 20;

interface CacheEntry {
    feed: PodcastFeed;
    expiresAt: number;
}

/**
 * Loads a show's episode list from its RSS feed, with a short-lived in-memory
 * cache so re-opening a show during a session does not refetch it.
 */
@Injectable({ providedIn: 'root' })
export class PodcastFeedService {
    private readonly remoteText = inject(RemoteTextService);
    private readonly cache = new Map<string, CacheEntry>();
    private readonly inFlight = new Map<string, Promise<PodcastFeed>>();

    async load(show: PodcastShow, forceRefresh = false): Promise<PodcastFeed> {
        const key = show.feedUrl;
        const cached = this.cache.get(key);
        if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
            return cached.feed;
        }

        const pending = this.inFlight.get(key);
        if (pending && !forceRefresh) {
            return pending;
        }

        const request = this.fetchFeed(show).finally(() => {
            this.inFlight.delete(key);
        });
        this.inFlight.set(key, request);
        return request;
    }

    private async fetchFeed(show: PodcastShow): Promise<PodcastFeed> {
        const xml = await this.remoteText.fetchText(show.feedUrl);
        const feed = parsePodcastFeed(xml, {
            showId: show.id,
            showTitle: show.title,
            artwork: show.artwork,
        });

        this.cache.set(show.feedUrl, {
            feed,
            expiresAt: Date.now() + FEED_CACHE_TTL_MS,
        });
        this.evictOldestEntries();

        return feed;
    }

    private evictOldestEntries(): void {
        while (this.cache.size > FEED_CACHE_MAX_ENTRIES) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey === undefined) {
                return;
            }
            this.cache.delete(oldestKey);
        }
    }
}
