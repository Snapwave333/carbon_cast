import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    convertToParamMap,
    ActivatedRoute,
    NavigationEnd,
    Router,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { StorageMap } from '@ngx-pwa/local-storage';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { EpgService } from '@iptvnator/epg/data-access';
import { PlaylistContextFacade } from '@iptvnator/playlist/shared/util';
import { selectFavorites } from '@iptvnator/m3u-state';
import {
    PlaylistsService,
    RuntimeCapabilitiesService,
    SettingsStore,
} from '@iptvnator/services';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { ChannelListContainerComponent } from './channel-list-container.component';

export interface ChannelListContainerHarness {
    activePlaylist: WritableSignal<PlaylistMeta | null>;
    dispatch: jest.Mock;
    epgService: {
        epgAvailable$: BehaviorSubject<boolean>;
        getChannelMetadataForChannels: jest.Mock;
        getCurrentProgramsForChannels: jest.Mock;
    };
    favoriteChannelIds: WritableSignal<string[]>;
    fixture: ComponentFixture<ChannelListContainerComponent>;
    runtimeCapabilities: { supportsEpg: boolean };
    storageGet: jest.Mock;
    settings: {
        hideNonUsChannels: WritableSignal<boolean>;
        hideSpanishChannels: WritableSignal<boolean>;
    };
}

/**
 * Builds the container with every collaborator stubbed and its template
 * stripped, so specs exercise the component's own state rather than the child
 * views. Collaborators are returned by reference: a spec can still change
 * `runtimeCapabilities` or the mock return values before the first
 * `detectChanges()`.
 */
export async function createChannelListContainerHarness(): Promise<ChannelListContainerHarness> {
    const routerEvents$ = new Subject<NavigationEnd>();
    const dispatch = jest.fn();
    const favoriteChannelIds = signal<string[]>([]);
    const runtimeCapabilities = { supportsEpg: true };
    const storageGet = jest.fn().mockReturnValue(of({}));
    const settings = {
        hideNonUsChannels: signal(true),
        hideSpanishChannels: signal(false),
    };
    const epgService = {
        epgAvailable$: new BehaviorSubject<boolean>(false),
        getChannelMetadataForChannels: jest.fn().mockReturnValue(of(new Map())),
        getCurrentProgramsForChannels: jest.fn().mockReturnValue(of(new Map())),
    };
    const activePlaylist = signal<PlaylistMeta | null>({
        _id: 'playlist-1',
        title: 'Playlist One',
        count: 0,
        importDate: '2026-04-11T00:00:00.000Z',
        hiddenGroupTitles: ['News'],
    } as PlaylistMeta);

    const route = {
        snapshot: {
            data: { layout: 'workspace' },
            paramMap: convertToParamMap({}),
            queryParamMap: convertToParamMap({}),
            params: {},
            queryParams: {},
        },
        pathFromRoot: [
            {
                snapshot: {
                    data: { layout: 'workspace' },
                    paramMap: convertToParamMap({}),
                    params: {},
                },
                paramMap: of(convertToParamMap({})),
            },
        ],
        paramMap: of(convertToParamMap({})),
        queryParamMap: of(convertToParamMap({})),
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
        imports: [ChannelListContainerComponent],
        providers: [
            {
                provide: EpgService,
                useValue: epgService,
            },
            {
                provide: PlaylistsService,
                useValue: {},
            },
            {
                provide: SettingsStore,
                useValue: {
                    openStreamOnDoubleClick: signal(false),
                    ...settings,
                },
            },
            {
                provide: StorageMap,
                useValue: {
                    get: storageGet,
                },
            },
            {
                provide: RuntimeCapabilitiesService,
                useValue: runtimeCapabilities,
            },
            {
                provide: Store,
                useValue: {
                    dispatch,
                    select: jest.fn().mockReturnValue(of([])),
                    selectSignal: jest.fn((selector) =>
                        selector === selectFavorites
                            ? favoriteChannelIds
                            : signal(undefined)
                    ),
                },
            },
            {
                provide: Router,
                useValue: {
                    url: '/workspace/playlists/demo/all',
                    events: routerEvents$.asObservable(),
                },
            },
            {
                provide: ActivatedRoute,
                useValue: route,
            },
            {
                provide: PlaylistContextFacade,
                useValue: {
                    activePlaylist,
                    resolvedPlaylistId: signal(null),
                },
            },
        ],
    })
        .overrideComponent(ChannelListContainerComponent, {
            set: {
                template: '',
                imports: [],
            },
        })
        .compileComponents();

    return {
        activePlaylist,
        dispatch,
        epgService,
        favoriteChannelIds,
        fixture: TestBed.createComponent(ChannelListContainerComponent),
        runtimeCapabilities,
        settings,
        storageGet,
    };
}
