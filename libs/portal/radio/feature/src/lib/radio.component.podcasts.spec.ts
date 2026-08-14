import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    RadioLibraryStore,
    RadioPlayerStore,
    RemoteTextUnavailableError,
} from '@iptvnator/portal/radio/data-access';
import { RadioComponent } from './radio.component';
import {
    createRadioHarness,
    EPISODE,
    flush,
    RadioHarness,
    SHOW,
    STATION,
} from './radio.component.harness';

describe('RadioComponent podcasts and library tabs', () => {
    let harness: RadioHarness;
    let fixture: ComponentFixture<RadioComponent>;
    let component: RadioComponent;
    let player: RadioPlayerStore;
    let directory: RadioHarness['directory'];
    let feed: RadioHarness['feed'];
    let radioBrowser: RadioHarness['radioBrowser'];

    beforeEach(async () => {
        harness = await createRadioHarness();
        ({ fixture, component, player, directory, feed, radioBrowser } =
            harness);
    });

    afterEach(() => {
        player.stop();
        jest.useRealTimers();
    });

    it('loads the top charts the first time the podcasts tab opens', async () => {
        expect(directory.topShows).not.toHaveBeenCalled();

        component.selectTab('podcasts');
        fixture.detectChanges();
        await flush(fixture);

        expect(directory.topShows).toHaveBeenCalledTimes(1);
        expect(component.shows().items).toEqual([SHOW]);

        component.selectTab('stations');
        component.selectTab('podcasts');
        fixture.detectChanges();
        await flush(fixture);

        expect(directory.topShows).toHaveBeenCalledTimes(1);
    });

    it('debounces the podcast search', async () => {
        component.onPodcastSearchChange('dee');
        component.onPodcastSearchChange('deep dive');
        jest.advanceTimersByTime(450);
        await flush(fixture);

        expect(directory.search).toHaveBeenCalledTimes(1);
        expect(directory.search).toHaveBeenCalledWith('deep dive');
        expect(component.podcastsHeading()).toBe('RADIO.SEARCH_RESULTS');
    });

    it('opens a show and lists its episodes', async () => {
        component.openShow(SHOW);
        await flush(fixture);

        expect(feed.load).toHaveBeenCalledWith(SHOW, false);
        expect(component.episodes().items).toEqual([EPISODE]);

        component.closeShow();
        expect(component.selectedShow()).toBeNull();
        expect(component.episodes().items).toEqual([]);
    });

    it('forces a refetch when the feed is refreshed', async () => {
        component.openShow(SHOW);
        await flush(fixture);
        component.refreshShow();
        await flush(fixture);

        expect(feed.load).toHaveBeenLastCalledWith(SHOW, true);
    });

    it('flags a CORS-blocked feed separately from other feed errors', async () => {
        feed.load.mockRejectedValueOnce(
            new RemoteTextUnavailableError(
                'https://feeds.example/deep-dive.rss'
            )
        );
        component.openShow(SHOW);
        await flush(fixture);

        expect(component.episodesBlocked()).toBe(true);

        feed.load.mockRejectedValueOnce(new Error('boom'));
        component.refreshShow();
        await flush(fixture);

        expect(component.episodesBlocked()).toBe(false);
        expect(component.episodes().error).toBe('boom');
    });

    it('plays an episode with the whole episode list as its queue', async () => {
        component.openShow(SHOW);
        await flush(fixture);
        component.playEpisode(EPISODE);

        expect(player.current()).toMatchObject({
            kind: 'episode',
            id: 'episode-1',
            durationSeconds: 1800,
        });
        expect(radioBrowser.reportStationClick).not.toHaveBeenCalled();
    });

    it('tracks favorites and subscriptions in the library tab', () => {
        expect(component.isLibraryEmpty()).toBe(true);

        component.toggleFavoriteStation(STATION);
        component.toggleSubscription(SHOW);

        expect(component.isFavoriteStation()('station-1')).toBe(true);
        expect(component.isSubscribed()('show-1')).toBe(true);
        expect(component.isLibraryEmpty()).toBe(false);

        component.toggleFavoriteStation(STATION);
        expect(component.favoriteStations()).toEqual([]);
    });

    it('records plays as recent entries and clears them on request', () => {
        component.playStationFromResults(STATION);

        expect(component.recentTracks()).toHaveLength(1);

        component.clearRecent();
        expect(component.recentTracks()).toEqual([]);
    });

    it('reports an episode resume point as a percentage', () => {
        expect(component.episodeResumePercent()('episode-1')).toBe(0);

        TestBed.inject(RadioLibraryStore).saveEpisodeProgress(
            'episode-1',
            450,
            1800
        );

        expect(component.episodeResumePercent()('episode-1')).toBe(25);
        expect(component.episodeResumePercent()('missing')).toBe(0);
    });
});
