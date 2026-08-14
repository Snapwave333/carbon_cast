import { TestBed } from '@angular/core/testing';
import { RadioLibraryStore } from './radio-library.store';
import { PodcastShow, RadioStation, RadioTrack } from './radio.types';

const STORAGE_KEY = 'carboncast.radio.library.v1';

const STATION: RadioStation = {
    id: 'station-1',
    name: 'Jazz FM',
    streamUrl: 'https://cdn.example/jazz',
    homepage: '',
    favicon: '',
    tags: ['jazz'],
    country: 'Germany',
    countryCode: 'DE',
    languages: ['german'],
    codec: 'MP3',
    bitrate: 128,
    votes: 1,
    clickCount: 1,
    isHls: false,
    isOnline: true,
};

const SHOW: PodcastShow = {
    id: 'show-1',
    title: 'Deep Dive',
    author: 'Example',
    feedUrl: 'https://feeds.example/rss',
    artwork: '',
    genres: [],
    episodeCount: null,
    description: '',
    websiteUrl: '',
};

const TRACK: RadioTrack = {
    kind: 'station',
    id: 'station-1',
    title: 'Jazz FM',
    subtitle: 'Germany',
    artwork: '',
    streamUrl: 'https://cdn.example/jazz',
    homepage: '',
    durationSeconds: null,
};

function createStore(): RadioLibraryStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(RadioLibraryStore);
}

describe('RadioLibraryStore', () => {
    let store: RadioLibraryStore;

    beforeEach(() => {
        localStorage.clear();
        store = createStore();
    });

    it('toggles a station favourite and reports the new state', () => {
        expect(store.toggleFavoriteStation(STATION)).toBe(true);
        expect(store.isFavoriteStation('station-1')).toBe(true);
        expect(store.favoriteStations()).toEqual([STATION]);

        expect(store.toggleFavoriteStation(STATION)).toBe(false);
        expect(store.favoriteStations()).toEqual([]);
    });

    it('toggles a podcast subscription', () => {
        expect(store.toggleSubscription(SHOW)).toBe(true);
        expect(store.isSubscribed('show-1')).toBe(true);

        expect(store.toggleSubscription(SHOW)).toBe(false);
        expect(store.subscribedShows()).toEqual([]);
    });

    it('keeps recent plays newest-first without duplicates', () => {
        const other = { ...TRACK, id: 'station-2' };

        store.rememberPlayed(TRACK);
        store.rememberPlayed(other);
        store.rememberPlayed(TRACK);

        expect(store.recentTracks().map((track) => track.id)).toEqual([
            'station-1',
            'station-2',
        ]);
    });

    it('caps the recent list', () => {
        for (let index = 0; index < 45; index++) {
            store.rememberPlayed({ ...TRACK, id: `station-${index}` });
        }

        expect(store.recentTracks()).toHaveLength(40);
        expect(store.recentTracks()[0].id).toBe('station-44');
    });

    it('clears the recent list', () => {
        store.rememberPlayed(TRACK);
        store.clearRecent();

        expect(store.recentTracks()).toEqual([]);
    });

    it('stores a mid-episode resume point', () => {
        store.saveEpisodeProgress('episode-1', 600, 3600);

        expect(store.episodeProgress('episode-1')).toMatchObject({
            positionSeconds: 600,
            durationSeconds: 3600,
        });
    });

    it('ignores a position near the start', () => {
        store.saveEpisodeProgress('episode-1', 12, 3600);

        expect(store.episodeProgress('episode-1')).toBeNull();
    });

    it('clears the resume point once the episode is finished', () => {
        store.saveEpisodeProgress('episode-1', 600, 3600);
        store.saveEpisodeProgress('episode-1', 3550, 3600);

        expect(store.episodeProgress('episode-1')).toBeNull();
    });

    it('persists across instances', () => {
        store.toggleFavoriteStation(STATION);
        store.saveEpisodeProgress('episode-1', 600, 3600);

        const reloaded = createStore();

        expect(reloaded.isFavoriteStation('station-1')).toBe(true);
        expect(reloaded.episodeProgress('episode-1')?.positionSeconds).toBe(600);
    });

    it('starts empty when the stored payload is corrupt', () => {
        localStorage.setItem(STORAGE_KEY, '{not json');

        const reloaded = createStore();

        expect(reloaded.favoriteStations()).toEqual([]);
        expect(reloaded.recentTracks()).toEqual([]);
    });

    it('survives a failing storage write', () => {
        const setItem = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

        expect(() => store.toggleFavoriteStation(STATION)).not.toThrow();
        expect(store.isFavoriteStation('station-1')).toBe(true);

        setItem.mockRestore();
    });
});
