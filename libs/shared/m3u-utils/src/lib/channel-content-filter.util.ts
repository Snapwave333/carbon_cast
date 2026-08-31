import type { Channel } from '@iptvnator/shared/interfaces';
import {
    canonicalCategoryKey,
    expandChannelCategories,
    getChannelCountryCodes,
} from './category-normalization.util';

/**
 * Content filters applied to an M3U channel list before it is rendered.
 *
 * Both filters read the provider's `group-title` and never re-classify a
 * channel from its name. That is the same rule the category normalizer
 * follows, and for the same reason: name matching turns "Newsmax", "News 12"
 * and "Good News Church TV" into one indistinguishable bucket, and a viewer
 * cannot tell why a channel vanished.
 */

/**
 * Group keys treated as religious programming.
 *
 * Deliberately explicit rather than a substring rule: "Christian Rock" is a
 * music group, and a `startsWith('christ')` test would hide it. Every entry
 * here is a category label aggregators actually publish.
 */
const RELIGIOUS_CATEGORY_KEYS: ReadonlySet<string> = new Set([
    'religious',
    'religion',
    'faith',
    'spiritual',
    'spirituality',
    'church',
    'gospel',
    'christian',
    'catholic',
    'evangelical',
    'islamic',
    'islam',
    'muslim',
    'quran',
    'koran',
    'hindu',
    'buddhist',
    'jewish',
    'judaism',
    'bible',
    'worship',
    'devotional',
    'preaching',
    'ministry',
]);

const NEWS_CATEGORY_KEYS: ReadonlySet<string> = new Set([
    'news',
    'news & politics',
    'news and politics',
    'breaking news',
    'business news',
    'local news',
]);

export interface ChannelContentFilterOptions {
    /** Drop channels the provider files under a religious category. */
    readonly hideReligious?: boolean;
    /** Keep only news channels broadcast from {@link homeCountry}. */
    readonly localNewsOnly?: boolean;
    /** ISO 3166-1 alpha-2 code of the viewer's country, lower-cased. */
    readonly homeCountry?: string;
}

type CategorizedChannel = Pick<Channel, 'group' | 'raw' | 'tvg'>;

export function isReligiousChannel(channel: CategorizedChannel): boolean {
    return hasCategoryIn(channel, RELIGIOUS_CATEGORY_KEYS);
}

export function isNewsChannel(channel: CategorizedChannel): boolean {
    return hasCategoryIn(channel, NEWS_CATEGORY_KEYS);
}

/**
 * True when a news channel should be hidden under the local-news-only rule.
 *
 * A channel whose metadata names no country at all is kept. Most single-country
 * playlists omit `tvg-country` entirely, and treating "unknown" as "foreign"
 * would empty the news group for exactly the users the filter is meant to help.
 */
export function isForeignNewsChannel(
    channel: CategorizedChannel,
    homeCountry: string | undefined
): boolean {
    if (!homeCountry || !isNewsChannel(channel)) {
        return false;
    }

    const countries = getChannelCountryCodes(channel);
    return (
        countries.length > 0 && !countries.includes(homeCountry.toLowerCase())
    );
}

export function applyChannelContentFilter<T extends CategorizedChannel>(
    channels: readonly T[],
    options: ChannelContentFilterOptions
): T[] {
    const hideReligious = options.hideReligious === true;
    const localNewsOnly = options.localNewsOnly === true;
    const homeCountry = options.homeCountry?.trim().toLowerCase() || undefined;

    if (!hideReligious && !(localNewsOnly && homeCountry)) {
        // Returning the input array unchanged lets the caller's memoization
        // see a stable reference when both filters are off.
        return channels as T[];
    }

    return channels.filter(
        (channel) =>
            !(hideReligious && isReligiousChannel(channel)) &&
            !(localNewsOnly && isForeignNewsChannel(channel, homeCountry))
    );
}

/**
 * Resolves the viewer's country from a BCP 47 locale such as `en-GB`.
 *
 * Returns undefined for a language-only locale (`en`) rather than guessing a
 * region — a wrong guess silently hides every news channel from the country
 * the viewer actually lives in.
 */
export function resolveHomeCountryFromLocale(
    locale: string | undefined
): string | undefined {
    const region = (locale ?? '').split(/[-_]/)[1]?.trim().toLowerCase();
    return region && /^[a-z]{2}$/.test(region) ? region : undefined;
}

function hasCategoryIn(
    channel: CategorizedChannel,
    keys: ReadonlySet<string>
): boolean {
    const title = channel.group?.title;
    if (!title) {
        return false;
    }

    // The fast path covers the single-group case, which is almost every
    // channel; only a `;`-joined title needs the full expansion.
    if (keys.has(canonicalCategoryKey(title))) {
        return true;
    }

    return expandChannelCategories(title).some((category) =>
        keys.has(category.key)
    );
}
