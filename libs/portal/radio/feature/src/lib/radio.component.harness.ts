import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import {
    PodcastDirectoryService,
    PodcastEpisode,
    PodcastFeedService,
    PodcastShow,
    RadioBrowserService,
    RadioPlayerStore,
    RadioStation,
} from '@iptvnator/portal/radio/data-access';
import { RadioComponent } from './radio.component';

export const STATION: RadioStation = {
    id: 'station-1',
    name: 'Jazz FM',
    streamUrl: 'https://cdn.example/jazz',
    homepage: 'https://jazz.example',
    favicon: '',
    tags: ['jazz'],
    country: 'Germany',
    countryCode: 'DE',
    languages: ['german'],
    codec: 'MP3',
    bitrate: 128,
    votes: 10,
    clickCount: 5,
    isHls: false,
    isOnline: true,
};

export const SHOW: PodcastShow = {
    id: 'show-1',
    title: 'Deep Dive',
    author: 'Example Media',
    feedUrl: 'https://feeds.example/deep-dive.rss',
    artwork: '',
    genres: ['Technology'],
    episodeCount: 12,
    description: '',
    websiteUrl: '',
};

export const EPISODE: PodcastEpisode = {
    id: 'episode-1',
    showId: 'show-1',
    showTitle: 'Deep Dive',
    title: 'Episode One',
    audioUrl: 'https://cdn.example/1.mp3',
    durationSeconds: 1800,
    publishedAt: '2025-03-04T09:00:00.000Z',
    description: 'First episode',
    artwork: '',
};

export interface RadioHarness {
    fixture: ComponentFixture<RadioComponent>;
    component: RadioComponent;
    player: RadioPlayerStore;
    radioBrowser: {
        topStations: jest.Mock;
        trendingStations: jest.Mock;
        searchStations: jest.Mock;
        countries: jest.Mock;
        tags: jest.Mock;
        reportStationClick: jest.Mock;
    };
    directory: { topShows: jest.Mock; search: jest.Mock };
    feed: { load: jest.Mock };
}

/**
 * Builds the page against stubbed catalogues, with fake timers installed so
 * the search debounce can be stepped explicitly.
 */
export async function createRadioHarness(): Promise<RadioHarness> {
    jest.useFakeTimers();
    localStorage.clear();

    const radioBrowser = {
        topStations: jest.fn().mockResolvedValue([STATION]),
        trendingStations: jest.fn().mockResolvedValue([]),
        searchStations: jest.fn().mockResolvedValue([]),
        countries: jest
            .fn()
            .mockResolvedValue([
                { name: 'Germany', code: 'DE', stationCount: 120 },
            ]),
        tags: jest
            .fn()
            .mockResolvedValue([{ name: 'jazz', code: '', stationCount: 40 }]),
        reportStationClick: jest.fn().mockResolvedValue(undefined),
    };
    const directory = {
        topShows: jest.fn().mockResolvedValue([SHOW]),
        search: jest.fn().mockResolvedValue([]),
    };
    const feed = {
        load: jest.fn().mockResolvedValue({
            title: 'Deep Dive',
            description: '',
            artwork: '',
            websiteUrl: '',
            episodes: [EPISODE],
        }),
    };

    await TestBed.configureTestingModule({
        imports: [
            RadioComponent,
            NoopAnimationsModule,
            TranslateModule.forRoot(),
        ],
        providers: [
            { provide: RadioBrowserService, useValue: radioBrowser },
            { provide: PodcastDirectoryService, useValue: directory },
            { provide: PodcastFeedService, useValue: feed },
        ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RadioComponent);
    const harness: RadioHarness = {
        fixture,
        component: fixture.componentInstance,
        player: TestBed.inject(RadioPlayerStore),
        radioBrowser,
        directory,
        feed,
    };

    fixture.detectChanges();
    await flush(fixture);
    return harness;
}

/** Drains the microtask queue while fake timers are installed. */
export async function flush(
    fixture: ComponentFixture<unknown>
): Promise<void> {
    for (let index = 0; index < 5; index++) {
        await Promise.resolve();
    }
    fixture.detectChanges();
}
