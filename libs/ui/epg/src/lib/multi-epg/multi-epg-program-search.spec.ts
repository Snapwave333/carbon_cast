import { MultiEpgProgramSearch } from './multi-epg-program-search';
import { EpgProgram } from '@iptvnator/shared/interfaces';

describe('MultiEpgProgramSearch', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('debounces searches and ignores a stale response', async () => {
        jest.useFakeTimers();
        const resolvers: Array<(value: EpgProgram[]) => void> = [];
        const search = jest.fn(
            () =>
                new Promise<EpgProgram[]>((resolve) => {
                    resolvers.push(resolve);
                })
        );
        const state = new MultiEpgProgramSearch(search, () => true, 100);

        state.update('news');
        jest.advanceTimersByTime(100);
        state.update('weather');
        jest.advanceTimersByTime(100);
        resolvers[1]([program('Weather')]);
        await Promise.resolve();
        resolvers[0]([program('Old news')]);
        await Promise.resolve();

        expect(state.results()).toEqual([
            expect.objectContaining({ title: 'Weather' }),
        ]);
        expect(state.isSearching()).toBe(false);
    });

    it('does not search unsupported runtimes or one-character queries', () => {
        jest.useFakeTimers();
        const search = jest.fn().mockResolvedValue([]);
        const state = new MultiEpgProgramSearch(search, () => false, 100);

        state.update('n');
        state.update('news');
        jest.runAllTimers();

        expect(search).not.toHaveBeenCalled();
    });
});

function program(title: string): EpgProgram {
    return {
        title,
        start: '2026-08-12T09:00:00',
        stop: '2026-08-12T09:30:00',
        channel: 'channel-1',
        desc: null,
        category: null,
    };
}
