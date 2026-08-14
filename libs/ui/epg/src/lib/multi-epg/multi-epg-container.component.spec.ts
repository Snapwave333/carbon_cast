import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayRef } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { SettingsStore, TmdbEnrichmentService } from '@iptvnator/services';
import { MultiEpgContainerComponent } from './multi-epg-container.component';
import { isSelectedEpgDayToday } from './multi-epg-layout.util';
import { COMPONENT_OVERLAY_REF } from './overlay-ref.token';

describe('isSelectedEpgDayToday', () => {
    it('returns true only when the selected EPG day is the actual current day', () => {
        const now = new Date('2026-05-21T20:00:00.000Z');

        expect(isSelectedEpgDayToday('20260521', now)).toBe(true);
        expect(isSelectedEpgDayToday('20260520', now)).toBe(false);
        expect(isSelectedEpgDayToday('20260522', now)).toBe(false);
    });
});

describe('MultiEpgContainerComponent runtime gates', () => {
    let fixture: ComponentFixture<MultiEpgContainerComponent>;
    let component: MultiEpgContainerComponent;
    let epgBridge: Partial<EpgRuntimeBridgeService>;
    let dialog: { open: jest.Mock };

    beforeEach(async () => {
        epgBridge = {
            getChannelsByRange: jest.fn().mockResolvedValue([]),
            searchPrograms: jest.fn().mockResolvedValue([]),
            supportsChannelBrowser: false,
            supportsProgramSearch: false,
        };
        dialog = {
            open: jest
                .fn()
                .mockReturnValue({ afterClosed: () => of(undefined) }),
        };

        await TestBed.configureTestingModule({
            imports: [MultiEpgContainerComponent],
            providers: [
                { provide: MatDialog, useValue: dialog },
                {
                    provide: COMPONENT_OVERLAY_REF,
                    useValue: { detach: jest.fn() },
                },
                {
                    provide: OverlayRef,
                    useValue: { detach: jest.fn() },
                },
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: epgBridge,
                },
                {
                    provide: TmdbEnrichmentService,
                    useValue: {
                        isEnabled: () => false,
                        enrichMovie: jest.fn(),
                        enrichTv: jest.fn(),
                    },
                },
                {
                    provide: SettingsStore,
                    useValue: { guideArtwork: () => true },
                },
                {
                    provide: TranslateService,
                    useValue: {
                        currentLang: 'en',
                        defaultLang: 'en',
                        onLangChange: of(null),
                    },
                },
            ],
        })
            .overrideComponent(MultiEpgContainerComponent, {
                set: { template: '' },
            })
            .compileComponents();

        fixture = TestBed.createComponent(MultiEpgContainerComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => {
        fixture.destroy();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('does not request EPG channel ranges when the EPG bridge cannot browse channels', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        await component.requestPrograms();

        expect(epgBridge.getChannelsByRange).not.toHaveBeenCalled();
        expect(component.isLoading()).toBe(false);
    });

    it('requests EPG channel ranges through the EPG runtime bridge', async () => {
        epgBridge.getChannelsByRange = jest.fn().mockResolvedValue([
            {
                channel_id: 'channel-1',
                display_name: 'Channel One',
                programs: [],
            },
        ]);
        epgBridge.supportsChannelBrowser = true;

        await component.requestPrograms();

        expect(epgBridge.getChannelsByRange).toHaveBeenCalledWith(0, 20);
        expect(component.isLoading()).toBe(false);
    });

    it('exposes a retryable error when the channel browser fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        epgBridge.getChannelsByRange = jest
            .fn()
            .mockRejectedValue(new Error('offline'));
        epgBridge.supportsChannelBrowser = true;

        await component.requestPrograms();

        expect(component.loadError()).toBe(true);
        expect(component.isLoading()).toBe(false);
    });

    it('updates the current-time label on the minute clock', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 7, 12, 9, 0));

        component.ngOnInit();
        jest.advanceTimersByTime(60_000);

        expect(component.currentTimeLabel()).toBe('09:01');
    });

    it('opens programme details from Enter and Space keyboard activation', () => {
        const program = {
            title: 'News',
            start: '2026-08-12T09:00:00',
            stop: '2026-08-12T09:30:00',
            channel: 'channel-1',
            desc: null,
            category: null,
        };
        const enter = {
            key: 'Enter',
            preventDefault: jest.fn(),
        } as unknown as KeyboardEvent;
        const space = {
            key: ' ',
            preventDefault: jest.fn(),
        } as unknown as KeyboardEvent;

        component.activateProgramFromKeyboard(enter, program);
        component.activateProgramFromKeyboard(space, program);

        expect(enter.preventDefault).toHaveBeenCalled();
        expect(space.preventDefault).toHaveBeenCalled();
        expect(dialog.open).toHaveBeenCalledTimes(2);
    });

    it('does not search EPG programs when the EPG bridge cannot search programs', () => {
        jest.useFakeTimers();

        component.onProgramSearchInput({
            target: { value: 'news' },
        } as unknown as Event);
        jest.advanceTimersByTime(600);

        expect(epgBridge.searchPrograms).not.toHaveBeenCalled();
        expect(component.isSearchingPrograms()).toBe(false);
        expect(component.programSearchResults()).toEqual([]);
    });

    it('searches EPG programs through the EPG runtime bridge', async () => {
        jest.useFakeTimers();
        const results = [
            {
                channelId: 'channel-1',
                start: '2026-05-22T10:00:00.000Z',
                stop: '2026-05-22T11:00:00.000Z',
                title: 'News',
            },
        ];
        epgBridge.searchPrograms = jest.fn().mockResolvedValue(results);
        epgBridge.supportsProgramSearch = true;

        component.onProgramSearchInput({
            target: { value: 'news' },
        } as unknown as Event);
        jest.advanceTimersByTime(500);
        await Promise.resolve();

        expect(epgBridge.searchPrograms).toHaveBeenCalledWith('news', 20);
        expect(component.programSearchResults()).toEqual(results);
        expect(component.isSearchingPrograms()).toBe(false);
    });
});
