import { queryFollowedSeriesProgramBatches } from './followed-series-query.util';

describe('queryFollowedSeriesProgramBatches', () => {
    it('queries large follow lists in bounded batches and deduplicates rows', async () => {
        const getFollowedSeriesPrograms = jest.fn().mockResolvedValue([
            {
                databaseId: 1,
                channel: 'channel',
                start: '2026-08-01T10:00:00Z',
                stop: '2026-08-01T10:30:00Z',
                title: 'Show',
                desc: null,
                category: null,
            },
        ]);

        const result = await queryFollowedSeriesProgramBatches(
            { getFollowedSeriesPrograms },
            {
                from: '2026-08-01T00:00:00Z',
                to: '2026-08-15T00:00:00Z',
                titleHints: Array.from(
                    { length: 205 },
                    (_, index) => `show-${index}`
                ),
                limit: 5_000,
            }
        );

        expect(getFollowedSeriesPrograms).toHaveBeenCalledTimes(3);
        expect(
            getFollowedSeriesPrograms.mock.calls.map(
                ([request]) => request.titleHints.length
            )
        ).toEqual([100, 100, 5]);
        expect(result).toHaveLength(1);
    });

    it('propagates unavailable lookup support without partial results', async () => {
        await expect(
            queryFollowedSeriesProgramBatches(
                {
                    getFollowedSeriesPrograms: jest
                        .fn()
                        .mockResolvedValue(null),
                },
                {
                    from: '2026-08-01T00:00:00Z',
                    to: '2026-08-15T00:00:00Z',
                    titleHints: ['show'],
                }
            )
        ).resolves.toBeNull();
    });
});
