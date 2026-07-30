import {
    createEmptyFollowedSeriesState,
    FollowedSeriesStorageService,
} from './followed-series-storage.service';

describe('FollowedSeriesStorageService', () => {
    const service = new FollowedSeriesStorageService();

    beforeEach(() => localStorage.clear());

    it('survives a service restart and merges newly introduced defaults', () => {
        const state = createEmptyFollowedSeriesState();
        state.followedSeries.push({
            id: 'series-1',
            source: 'epg',
            title: 'Show',
            normalizedTitle: 'show',
            aliases: ['Show'],
            priority: 3,
            autoSwitchDefault: true,
            followedAt: '2026-01-01T00:00:00Z',
        });
        state.preferences.switchCountdownSeconds = 45;

        expect(service.save(state)).toBe(true);

        const restored = new FollowedSeriesStorageService().load();
        expect(restored.followedSeries[0].id).toBe('series-1');
        expect(restored.preferences.switchCountdownSeconds).toBe(45);
        expect(restored.preferences.disableWhileRecording).toBe(true);
    });

    it('fails closed to an empty state for malformed data', () => {
        localStorage.setItem('iptvnator:followed-series:v1', '{broken');

        expect(service.load()).toEqual(createEmptyFollowedSeriesState());
    });

    it('clamps unsafe countdown values during restoration', () => {
        localStorage.setItem(
            'iptvnator:followed-series:v1',
            JSON.stringify({
                ...createEmptyFollowedSeriesState(),
                preferences: { switchCountdownSeconds: 99_999 },
            })
        );

        expect(service.load().preferences.switchCountdownSeconds).toBe(300);
    });
});
