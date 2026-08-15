import { PodcastEpisode, PodcastFeed } from './radio.types';

/**
 * Parses a podcast RSS document into episodes.
 *
 * Feeds are the only universally available podcast episode source — no
 * directory API exposes episode audio without a key — so this has to cope with
 * the full spread of real-world feeds: RSS 2.0 and Atom, iTunes and Podcasting
 * 2.0 extensions, durations written as seconds or as `H:MM:SS`, and artwork
 * declared in any of four places.
 */

const ITUNES_NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
const ATOM_NS = 'http://www.w3.org/2005/Atom';
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|m4b)(\?|#|$)/i;

/**
 * Reads a core feed element. RSS 2.0 puts them in no namespace and Atom puts
 * them in its own, so both count as core; extension namespaces (iTunes, Media
 * RSS, Podcasting 2.0) deliberately do not, and are read explicitly instead.
 *
 * The first *non-empty* match wins, because RSS feeds routinely carry an empty
 * `<atom:link rel="self">` ahead of their real `<link>`.
 */
function text(parent: Element | null, tagName: string): string {
    if (!parent) {
        return '';
    }
    for (const child of Array.from(parent.children)) {
        if (
            child.localName !== tagName ||
            (child.namespaceURI !== null && child.namespaceURI !== ATOM_NS)
        ) {
            continue;
        }
        const value = (child.textContent ?? '').trim();
        if (value) {
            return value;
        }
    }
    return '';
}

function namespacedElement(
    parent: Element | null,
    namespace: string,
    tagName: string
): Element | null {
    if (!parent) {
        return null;
    }
    for (const child of Array.from(parent.children)) {
        if (child.localName === tagName && child.namespaceURI === namespace) {
            return child;
        }
    }
    return null;
}

function namespacedText(
    parent: Element | null,
    namespace: string,
    tagName: string
): string {
    const element = namespacedElement(parent, namespace, tagName);
    return element ? (element.textContent ?? '').trim() : '';
}

/**
 * `<itunes:duration>` is specified as seconds but is written in the wild as
 * `SS`, `MM:SS` and `HH:MM:SS`, sometimes with a fractional tail.
 */
export function parseDuration(value: string): number | null {
    const raw = value.trim();
    if (!raw) {
        return null;
    }

    const parts = raw.split(':').map((part) => Number.parseFloat(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
        return null;
    }

    const seconds =
        parts.length === 1
            ? parts[0]
            : parts.length === 2
              ? parts[0] * 60 + parts[1]
              : parts.length === 3
                ? parts[0] * 3600 + parts[1] * 60 + parts[2]
                : null;

    if (seconds === null || seconds <= 0) {
        return null;
    }
    return Math.round(seconds);
}

function parsePublishedAt(value: string): string | null {
    if (!value.trim()) {
        return null;
    }
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function stripMarkup(value: string): string {
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function itunesImage(parent: Element | null): string {
    const image = namespacedElement(parent, ITUNES_NS, 'image');
    return image?.getAttribute('href')?.trim() ?? '';
}

function channelArtwork(channel: Element): string {
    const fromItunes = itunesImage(channel);
    if (fromItunes) {
        return fromItunes;
    }

    for (const child of Array.from(channel.children)) {
        if (child.localName === 'image') {
            const url = text(child, 'url');
            if (url) {
                return url;
            }
            const href = child.getAttribute('href')?.trim();
            if (href) {
                return href;
            }
        }
    }

    return '';
}

function websiteUrl(channel: Element): string {
    const link = text(channel, 'link');
    if (link) {
        return link;
    }

    for (const child of Array.from(channel.children)) {
        if (child.localName === 'link' && child.namespaceURI === ATOM_NS) {
            const rel = child.getAttribute('rel');
            const href = child.getAttribute('href')?.trim();
            if (href && (!rel || rel === 'alternate')) {
                return href;
            }
        }
    }

    return '';
}

/**
 * Audio lives in `<enclosure>` for RSS, `<atom:link rel="enclosure">` for Atom,
 * or `<media:content>` for feeds that only use Media RSS.
 */
function audioUrl(item: Element): string {
    for (const child of Array.from(item.children)) {
        const url = child.getAttribute('url') ?? child.getAttribute('href');
        if (!url) {
            continue;
        }

        const type = child.getAttribute('type') ?? '';
        const isEnclosure =
            child.localName === 'enclosure' ||
            child.getAttribute('rel') === 'enclosure' ||
            child.localName === 'content';

        if (
            isEnclosure &&
            (type.startsWith('audio/') ||
                type === 'application/octet-stream' ||
                AUDIO_EXTENSIONS.test(url))
        ) {
            return url.trim();
        }
    }

    return '';
}

function itemElements(root: Element): Element[] {
    const items = Array.from(root.children).filter(
        (child) => child.localName === 'item'
    );
    if (items.length > 0) {
        return items;
    }
    return Array.from(root.children).filter(
        (child) => child.localName === 'entry'
    );
}

/**
 * Long-running shows publish feeds with thousands of entries. Episode ids key
 * the stored resume points, so this is the newest run the app keeps rather
 * than a display page size; RSS orders newest first.
 */
const MAX_EPISODES_PER_FEED = 500;

/**
 * Feeds do repeat `<guid>` values, and resume points are keyed by episode id —
 * two episodes sharing one meant playing either moved the other's progress.
 * First occurrence keeps the raw id so existing resume points still resolve.
 */
function uniqueEpisodeId(id: string, seen: Set<string>): string {
    let candidate = id;
    let suffix = 2;
    while (seen.has(candidate)) {
        candidate = `${id}#${suffix++}`;
    }

    seen.add(candidate);
    return candidate;
}

export interface PodcastFeedContext {
    showId: string;
    showTitle: string;
    artwork: string;
}

/**
 * @throws when the document is not parsable XML or carries no channel element.
 */
export function parsePodcastFeed(
    xml: string,
    context: PodcastFeedContext
): PodcastFeed {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) {
        throw new Error('Podcast feed is not valid XML');
    }

    const root = document.documentElement;
    const channel =
        Array.from(root.children).find(
            (child) => child.localName === 'channel'
        ) ?? root;

    const feedTitle = text(channel, 'title') || context.showTitle;
    const feedArtwork = channelArtwork(channel) || context.artwork;
    const showId = context.showId || websiteUrl(channel) || feedTitle;

    const episodes: PodcastEpisode[] = [];
    const seenIds = new Set<string>();
    for (const item of itemElements(channel)) {
        if (episodes.length >= MAX_EPISODES_PER_FEED) {
            break;
        }

        const url = audioUrl(item);
        if (!url) {
            continue;
        }

        const title = text(item, 'title') || feedTitle;
        const summary =
            namespacedText(item, ITUNES_NS, 'summary') ||
            text(item, 'description') ||
            text(item, 'summary');

        episodes.push({
            id: uniqueEpisodeId(
                text(item, 'guid') || text(item, 'id') || url,
                seenIds
            ),
            showId,
            showTitle: feedTitle,
            title,
            audioUrl: url,
            durationSeconds: parseDuration(
                namespacedText(item, ITUNES_NS, 'duration')
            ),
            publishedAt: parsePublishedAt(
                text(item, 'pubDate') ||
                    text(item, 'published') ||
                    text(item, 'updated')
            ),
            description: stripMarkup(summary),
            artwork: itunesImage(item) || feedArtwork,
        });
    }

    return {
        title: feedTitle,
        description: stripMarkup(
            namespacedText(channel, ITUNES_NS, 'summary') ||
                text(channel, 'description') ||
                text(channel, 'subtitle')
        ),
        artwork: feedArtwork,
        websiteUrl: websiteUrl(channel),
        episodes,
    };
}
