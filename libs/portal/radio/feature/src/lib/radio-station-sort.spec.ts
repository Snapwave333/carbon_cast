import { RadioStation } from '@iptvnator/portal/radio/data-access';
import {
    groupStations,
    isGroupedSort,
    SORT_ORDERS,
    STATION_SORTS,
    sortWithinGroups,
} from './radio-station-sort';

const BASE: RadioStation = {
    id: 'x',
    name: 'Station',
    streamUrl: 'https://cdn.example/x',
    homepage: '',
    favicon: '',
    tags: [],
    country: '',
    countryCode: '',
    languages: [],
    codec: 'MP3',
    bitrate: 128,
    votes: 0,
    clickCount: 0,
    isHls: false,
    isOnline: true,
};

function station(overrides: Partial<RadioStation>): RadioStation {
    return { ...BASE, ...overrides };
}

/** Ordered most-used first, as the catalogue's tag facet returns them. */
const KNOWN_GENRES = ['pop', 'rock', 'jazz', 'electronic', 'dance', 'news'];

describe('station sort definitions', () => {
    it('offers a label for every sort', () => {
        expect(STATION_SORTS.map((sort) => sort.id)).toEqual([
            'popular',
            'trending',
            'name',
            'country',
            'genre',
        ]);
        for (const sort of STATION_SORTS) {
            expect(sort.labelKey).toMatch(/^RADIO\.SORT_/);
            expect(SORT_ORDERS[sort.id]).toBeDefined();
        }
    });

    it('ranks the descriptive sorts by popularity, not by their own field', () => {
        expect(SORT_ORDERS['country']).toEqual({
            order: 'votes',
            reverse: true,
        });
        expect(SORT_ORDERS['genre']).toEqual({ order: 'votes', reverse: true });
    });

    it.each([
        ['country', true],
        ['genre', true],
        ['popular', false],
        ['trending', false],
        ['name', false],
    ] as const)('marks %s as grouped=%s', (sort, expected) => {
        expect(isGroupedSort(sort)).toBe(expected);
    });
});

describe('sortWithinGroups', () => {
    it('leaves ungrouped sorts in catalogue order', () => {
        const input = [station({ id: 'b' }), station({ id: 'a' })];

        expect(sortWithinGroups(input, 'popular').map((s) => s.id)).toEqual([
            'b',
            'a',
        ]);
    });

    it('orders by country, then by name', () => {
        const input = [
            station({ id: '1', name: 'Zeta', country: 'Austria' }),
            station({ id: '2', name: 'Beta', country: 'Germany' }),
            station({ id: '3', name: 'Alpha', country: 'Austria' }),
        ];

        expect(sortWithinGroups(input, 'country').map((s) => s.name)).toEqual([
            'Alpha',
            'Zeta',
            'Beta',
        ]);
    });

    it('sinks blank keys to the end', () => {
        const input = [
            station({ id: '1', name: 'Unknown', country: '' }),
            station({ id: '2', name: 'Known', country: 'Austria' }),
        ];

        expect(sortWithinGroups(input, 'country').map((s) => s.name)).toEqual([
            'Known',
            'Unknown',
        ]);
    });

    it('does not mutate its input', () => {
        const input = [
            station({ id: '1', country: 'Zed' }),
            station({ id: '2', country: 'Alpha' }),
        ];
        const snapshot = [...input];

        sortWithinGroups(input, 'country');

        expect(input).toEqual(snapshot);
    });
});

describe('groupStations', () => {
    it('collapses ungrouped sorts into one unlabelled run', () => {
        const input = [station({ id: 'a' }), station({ id: 'b' })];

        expect(groupStations(input, 'popular')).toEqual([
            { label: '', stations: input },
        ]);
    });

    it('returns nothing for an empty list', () => {
        expect(groupStations([], 'popular')).toEqual([]);
        expect(groupStations([], 'country')).toEqual([]);
    });

    it('breaks a sorted list into consecutive runs', () => {
        const input = sortWithinGroups(
            [
                station({ id: '1', name: 'A', country: 'Austria' }),
                station({ id: '2', name: 'B', country: 'Germany' }),
                station({ id: '3', name: 'C', country: 'Austria' }),
            ],
            'country'
        );

        expect(
            groupStations(input, 'country').map((group) => [
                group.label,
                group.stations.length,
            ])
        ).toEqual([
            ['Austria', 2],
            ['Germany', 1],
        ]);
    });

    it('labels a missing key with a placeholder', () => {
        expect(
            groupStations([station({ id: '1' })], 'country')[0].label
        ).toBe('—');
    });

    it('snaps free-text tags onto the most-used known genre', () => {
        const input = [
            station({ id: '1', tags: ['#original', 'fm', 'rock'] }),
            station({ id: '2', tags: ['jazz'] }),
        ];

        expect(
            groupStations(
                sortWithinGroups(input, 'genre', KNOWN_GENRES),
                'genre',
                KNOWN_GENRES
            ).map((group) => group.label)
        ).toEqual(['jazz', 'rock']);
    });

    it('splits a space-packed tag so its genres are still recognized', () => {
        const input = [
            station({ id: '1', tags: ['club dance electronic house trance'] }),
        ];

        expect(
            groupStations(input, 'genre', KNOWN_GENRES)[0].label
        ).toBe('electronic');
    });

    it('falls back to the first raw tag when nothing is recognized', () => {
        const input = [station({ id: '1', tags: ['Very Niche Thing'] })];

        expect(groupStations(input, 'genre', KNOWN_GENRES)[0].label).toBe(
            'very niche thing'
        );
    });

    it('groups on the raw first tag when no vocabulary is available', () => {
        const input = [station({ id: '1', tags: ['Rock', 'pop'] })];

        expect(groupStations(input, 'genre')[0].label).toBe('rock');
    });

    it('merges stations that share a snapped genre', () => {
        const input = sortWithinGroups(
            [
                station({ id: '1', name: 'A', tags: ['classic rock'] }),
                station({ id: '2', name: 'B', tags: ['indie', 'rock'] }),
                station({ id: '3', name: 'C', tags: ['news', 'talk'] }),
            ],
            'genre',
            KNOWN_GENRES
        );

        expect(
            groupStations(input, 'genre', KNOWN_GENRES).map((group) => [
                group.label,
                group.stations.map((s) => s.name),
            ])
        ).toEqual([
            ['news', ['C']],
            ['rock', ['A', 'B']],
        ]);
    });
});
