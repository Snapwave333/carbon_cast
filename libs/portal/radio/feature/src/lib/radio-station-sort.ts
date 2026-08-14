import {
    RadioStation,
    RadioStationOrder,
} from '@iptvnator/portal/radio/data-access';

/**
 * How the station list is ordered, and — for the descriptive orders — how it
 * is broken into labelled runs so a long list stays readable.
 */

export type StationSort =
    | 'popular'
    | 'trending'
    | 'name'
    | 'country'
    | 'genre';

export const STATION_SORTS: readonly {
    id: StationSort;
    labelKey: string;
}[] = [
    { id: 'popular', labelKey: 'RADIO.SORT_POPULAR' },
    { id: 'trending', labelKey: 'RADIO.SORT_TRENDING' },
    { id: 'name', labelKey: 'RADIO.SORT_NAME' },
    { id: 'country', labelKey: 'RADIO.SORT_COUNTRY' },
    { id: 'genre', labelKey: 'RADIO.SORT_GENRE' },
];

/**
 * How each sort maps onto the catalogue's `order` parameter.
 *
 * Country and genre deliberately do *not* use the catalogue's own ordering for
 * those fields: a large share of stations carry a blank country or tag list,
 * and ordering by them ascending returns nothing but those blanks. Ranking by
 * popularity and then grouping locally yields a page worth reading instead.
 */
export const SORT_ORDERS: Record<
    StationSort,
    { order: RadioStationOrder; reverse: boolean }
> = {
    popular: { order: 'votes', reverse: true },
    trending: { order: 'clicktrend', reverse: true },
    name: { order: 'name', reverse: false },
    country: { order: 'votes', reverse: true },
    genre: { order: 'votes', reverse: true },
};

/** Sorts whose key repeats across stations, so runs of it can be labelled. */
const GROUPED_SORTS = new Set<StationSort>(['country', 'genre']);

/** Shown for stations the catalogue has no country or tag for. */
const UNLABELLED_GROUP = '—';

/** Consecutive stations sharing a sort key. */
export interface StationGroup {
    label: string;
    stations: RadioStation[];
}

export function isGroupedSort(sort: StationSort): boolean {
    return GROUPED_SORTS.has(sort);
}

/**
 * Station tags are free text. Most are comma-separated, but a fair number pack
 * several genres into one space-separated tag ("club dance electronic house"),
 * so both splittings are considered.
 */
function genreTokens(station: RadioStation): Set<string> {
    const tokens = new Set<string>();
    for (const tag of station.tags) {
        const lower = tag.trim().toLowerCase();
        if (!lower) {
            continue;
        }
        tokens.add(lower);
        if (lower.includes(' ')) {
            for (const word of lower.split(/\s+/)) {
                if (word) {
                    tokens.add(word);
                }
            }
        }
    }
    return tokens;
}

/**
 * Picks the station's most widely used genre.
 *
 * `knownGenres` is the catalogue's tag list ranked by station count, so the
 * first match is the most mainstream genre the station claims. Without it,
 * grouping on the raw first tag shatters a page into near-singleton runs.
 */
function genreKey(
    station: RadioStation,
    knownGenres: readonly string[]
): string {
    if (knownGenres.length > 0) {
        const tokens = genreTokens(station);
        for (const genre of knownGenres) {
            if (tokens.has(genre)) {
                return genre;
            }
        }
    }

    return (station.tags[0] ?? '').trim().toLowerCase();
}

function groupKey(
    station: RadioStation,
    sort: StationSort,
    knownGenres: readonly string[]
): string {
    return sort === 'country'
        ? station.country
        : genreKey(station, knownGenres);
}

/**
 * Orders a popularity-ranked page by country or genre, alphabetically within
 * each run. Stations the catalogue has no value for sink to the end rather
 * than leading the list.
 */
export function sortWithinGroups(
    stations: readonly RadioStation[],
    sort: StationSort,
    knownGenres: readonly string[] = []
): RadioStation[] {
    if (!isGroupedSort(sort)) {
        return [...stations];
    }

    return [...stations].sort((left, right) => {
        const leftKey = groupKey(left, sort, knownGenres);
        const rightKey = groupKey(right, sort, knownGenres);

        if (!leftKey !== !rightKey) {
            return leftKey ? -1 : 1;
        }

        const group = leftKey.localeCompare(rightKey);
        return group !== 0 ? group : left.name.localeCompare(right.name);
    });
}

/**
 * Splits an already-sorted list into labelled runs. Sorts that carry no
 * grouping collapse to a single unlabelled run, so callers render one grid
 * either way.
 */
export function groupStations(
    stations: readonly RadioStation[],
    sort: StationSort,
    knownGenres: readonly string[] = []
): StationGroup[] {
    if (!isGroupedSort(sort)) {
        return stations.length > 0
            ? [{ label: '', stations: [...stations] }]
            : [];
    }

    const groups: StationGroup[] = [];
    for (const station of stations) {
        const label = groupKey(station, sort, knownGenres) || UNLABELLED_GROUP;
        const current = groups[groups.length - 1];
        if (current?.label === label) {
            current.stations.push(station);
        } else {
            groups.push({ label, stations: [station] });
        }
    }
    return groups;
}
