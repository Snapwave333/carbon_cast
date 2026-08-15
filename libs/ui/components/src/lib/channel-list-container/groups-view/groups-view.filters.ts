import { Channel } from '@iptvnator/shared/interfaces';
import { canonicalCategoryKey } from '@iptvnator/shared/m3u-utils';
import { ChannelGroup } from '../channel-group.model';

export interface GroupView {
    readonly channels: Channel[];
    readonly count: number;
    readonly key: string;
    readonly label: string;
}

export interface FilteredGroupView extends GroupView {
    readonly titleMatches: boolean;
}

const GROUP_KEY_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});

/**
 * Numeric rank of a group key, for playlists that number their groups
 * ("01 | Sports"). Only a *leading* run of digits counts: stripping every
 * non-digit instead ranked "Sports HD 2" as 2, ahead of "Action".
 */
function leadingGroupNumber(key: string): number {
    const match = /^\s*(\d+)/.exec(key);
    return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

/** Numbered groups first in numeric order, then everything else alphabetically. */
export function compareGroupKeys(
    a: { readonly key: string },
    b: { readonly key: string }
): number {
    const numberA = leadingGroupNumber(a.key);
    const numberB = leadingGroupNumber(b.key);
    const hasNumberA = !Number.isNaN(numberA);
    const hasNumberB = !Number.isNaN(numberB);

    if (hasNumberA && hasNumberB && numberA !== numberB) {
        return numberA - numberB;
    }

    if (hasNumberA !== hasNumberB) {
        return hasNumberA ? -1 : 1;
    }

    return GROUP_KEY_COLLATOR.compare(a.key, b.key);
}

export function toSortedGroupViews(
    groups: readonly ChannelGroup[]
): GroupView[] {
    return groups
        .map((group) => ({
            channels: group.channels,
            count: group.channels.length,
            key: group.key,
            label: group.label,
        }))
        .sort(compareGroupKeys);
}

export function filterHiddenGroups(
    groups: readonly GroupView[],
    hiddenGroupTitles: readonly string[]
): GroupView[] {
    // Stored hidden titles may be raw (pre-canonicalization) legacy values,
    // so coerce both sides to canonical keys before matching.
    const hiddenKeys = new Set(
        hiddenGroupTitles.map((title) => canonicalCategoryKey(title))
    );

    return groups.filter(
        (group) => !hiddenKeys.has(group.key) && group.channels.length > 0
    );
}

/**
 * Workspace search: a group whose title matches keeps all its channels,
 * otherwise it keeps only the channels that match and drops out when none do.
 */
export function filterGroupsByChannelSearch(
    groups: readonly GroupView[],
    searchTerm: string
): FilteredGroupView[] {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
        return groups.map((group) => ({ ...group, titleMatches: false }));
    }

    return groups.reduce<FilteredGroupView[]>((acc, group) => {
        const titleMatches = group.label.toLowerCase().includes(term);
        const channels = titleMatches
            ? group.channels
            : group.channels.filter((channel) =>
                  `${channel.name ?? ''}`.toLowerCase().includes(term)
              );

        if (channels.length === 0) {
            return acc;
        }

        acc.push({
            channels,
            count: channels.length,
            key: group.key,
            label: group.label,
            titleMatches,
        });
        return acc;
    }, []);
}

/** The groups rail's own search box, which only ever matches group titles. */
export function filterGroupsByLabel(
    groups: readonly FilteredGroupView[],
    searchTerm: string
): FilteredGroupView[] {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
        return groups as FilteredGroupView[];
    }

    return groups.filter((group) => group.label.toLowerCase().includes(term));
}

/**
 * First-seen wins, so a channel listed under several categories maps to its
 * first canonical group — matching how the active group is selected.
 */
export function buildGroupKeyByChannelUrl(
    groups: readonly ChannelGroup[]
): Map<string, string> {
    const groupKeys = new Map<string, string>();

    for (const group of groups) {
        for (const channel of group.channels) {
            const channelUrl = channel.url;
            if (!groupKeys.has(channelUrl)) {
                groupKeys.set(channelUrl, group.key);
            }
        }
    }

    return groupKeys;
}
