import { ComponentFixture } from '@angular/core/testing';
import { RadioPlayerStore } from '@iptvnator/portal/radio/data-access';
import { RadioComponent } from './radio.component';
import {
    createRadioHarness,
    flush,
    RadioHarness,
    STATION,
} from './radio.component.harness';

describe('RadioComponent stations tab', () => {
    let harness: RadioHarness;
    let fixture: ComponentFixture<RadioComponent>;
    let component: RadioComponent;
    let player: RadioPlayerStore;
    let radioBrowser: RadioHarness['radioBrowser'];

    beforeEach(async () => {
        harness = await createRadioHarness();
        ({ fixture, component, player, radioBrowser } = harness);
    });

    afterEach(() => {
        player.stop();
        jest.useRealTimers();
    });

    it('loads the top stations and the filter facets on open', () => {
        expect(radioBrowser.topStations).toHaveBeenCalled();
        expect(component.stations().items).toEqual([STATION]);
        expect(component.countries()).toHaveLength(1);
        expect(component.tags()).toHaveLength(1);
    });

    it('renders a card per station', () => {
        expect(
            fixture.nativeElement.querySelectorAll('.station-card')
        ).toHaveLength(1);
    });

    it('wires the tablist for keyboard roving and selects with arrows', () => {
        const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
        expect(tabs).toHaveLength(3);
        // Only the active tab is in the tab order.
        expect([...tabs].map((tab: HTMLElement) => tab.getAttribute('tabindex'))).toEqual([
            '0',
            '-1',
            '-1',
        ]);

        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        jest.spyOn(event, 'preventDefault');
        component.onTabKeydown(event, 0);

        expect(component.tab()).toBe('podcasts');
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('wraps and jumps with Home/End across the tablist', () => {
        component.onTabKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), 0);
        expect(component.tab()).toBe('library');

        component.onTabKeydown(new KeyboardEvent('keydown', { key: 'Home' }), 2);
        expect(component.tab()).toBe('stations');

        component.onTabKeydown(new KeyboardEvent('keydown', { key: 'End' }), 0);
        expect(component.tab()).toBe('library');
    });

    it('ignores non-navigation keys on the tablist', () => {
        component.selectTab('stations');
        const event = new KeyboardEvent('keydown', { key: 'a' });
        jest.spyOn(event, 'preventDefault');

        component.onTabKeydown(event, 0);

        expect(component.tab()).toBe('stations');
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('debounces the station search into a single request', async () => {
        component.onStationSearchChange('ja');
        component.onStationSearchChange('jazz');
        jest.advanceTimersByTime(449);
        expect(radioBrowser.searchStations).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await flush(fixture);

        expect(radioBrowser.searchStations).toHaveBeenCalledTimes(1);
        expect(radioBrowser.searchStations).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'jazz' })
        );
    });

    it('switches the browse order to trending', async () => {
        component.setStationSort('trending');
        await flush(fixture);

        expect(radioBrowser.trendingStations).toHaveBeenCalled();
        expect(component.stationsHeading()).toBe('RADIO.TRENDING_STATIONS');
    });

    it('groups the top list rather than asking the catalogue to order by country', async () => {
        component.setStationSort('country');
        await flush(fixture);

        // Ordering by the catalogue's own `country` field returns only the
        // stations that have none, so the top list is grouped locally instead.
        expect(radioBrowser.topStations).toHaveBeenCalled();
        expect(radioBrowser.searchStations).not.toHaveBeenCalled();
        expect(component.stationsHeading()).toBe('RADIO.TOP_STATIONS');
    });

    it('groups the top list by genre the same way', async () => {
        component.setStationSort('genre');
        await flush(fixture);

        expect(radioBrowser.topStations).toHaveBeenCalled();
        expect(radioBrowser.searchStations).not.toHaveBeenCalled();
    });

    it('sorts alphabetically by name across the whole catalogue', async () => {
        component.setStationSort('name');
        await flush(fixture);

        expect(radioBrowser.searchStations).toHaveBeenCalledWith(
            expect.objectContaining({ order: 'name', reverse: false })
        );
        expect(component.stationsHeading()).toBe('RADIO.ALL_STATIONS');
    });

    it('groups a country sort into runs, alphabetical within each run', async () => {
        radioBrowser.topStations.mockResolvedValueOnce([
            { ...STATION, id: 'a', name: 'Zeta FM', country: 'Austria' },
            { ...STATION, id: 'b', name: 'Berlin FM', country: 'Germany' },
            { ...STATION, id: 'c', name: 'Alpha FM', country: 'Austria' },
            { ...STATION, id: 'd', name: 'Aachen FM', country: 'Germany' },
        ]);

        component.setStationSort('country');
        await flush(fixture);

        expect(
            component.stationGroups().map((group) => ({
                label: group.label,
                names: group.stations.map((station) => station.name),
            }))
        ).toEqual([
            { label: 'Austria', names: ['Alpha FM', 'Zeta FM'] },
            { label: 'Germany', names: ['Aachen FM', 'Berlin FM'] },
        ]);
    });

    it('renders a heading per group', async () => {
        radioBrowser.topStations.mockResolvedValueOnce([
            { ...STATION, id: 'a', name: 'A', country: 'Austria' },
            { ...STATION, id: 'b', name: 'B', country: 'Germany' },
        ]);

        component.setStationSort('country');
        await flush(fixture);

        const headings = [
            ...fixture.nativeElement.querySelectorAll('.radio__group-title'),
        ].map((node: HTMLElement) => node.textContent?.trim().split(/\s+/)[0]);

        expect(headings).toEqual(['Austria', 'Germany']);
    });

    it('sinks stations with no country into a placeholder run at the end', async () => {
        radioBrowser.topStations.mockResolvedValueOnce([
            { ...STATION, id: 'a', name: 'Nowhere FM', country: '' },
            { ...STATION, id: 'b', name: 'Vienna FM', country: 'Austria' },
        ]);

        component.setStationSort('country');
        await flush(fixture);

        expect(component.stationGroups().map((group) => group.label)).toEqual([
            'Austria',
            '—',
        ]);
    });

    it('keeps popularity sorts in one unlabelled run', () => {
        expect(component.stationGroups()).toEqual([
            { label: '', stations: [STATION] },
        ]);
        expect(
            fixture.nativeElement.querySelector('.radio__group-title')
        ).toBeNull();
    });

    it('has no groups when there are no stations', async () => {
        radioBrowser.topStations.mockResolvedValueOnce([]);
        component.retryStations();
        await flush(fixture);

        expect(component.stationGroups()).toEqual([]);
    });

    it('groups filtered results by genre too', async () => {
        component.setStationSort('genre');
        await flush(fixture);
        radioBrowser.searchStations.mockResolvedValueOnce([
            { ...STATION, id: 'a', name: 'Rock One', tags: ['rock'] },
            { ...STATION, id: 'b', name: 'Jazz One', tags: ['jazz'] },
        ]);
        component.countryFilter.set('DE');
        component.onStationFilterChange();
        await flush(fixture);

        expect(radioBrowser.searchStations).toHaveBeenLastCalledWith(
            expect.objectContaining({ countryCode: 'DE' })
        );
        expect(component.stationGroups().map((group) => group.label)).toEqual([
            'jazz',
            'rock',
        ]);
    });

    it('reports the search heading once a filter is active', () => {
        component.countryFilter.set('DE');

        expect(component.hasStationFilters()).toBe(true);
        expect(component.stationsHeading()).toBe('RADIO.SEARCH_RESULTS');
    });

    it('clears every station filter at once', async () => {
        component.onStationSearchChange('jazz');
        component.countryFilter.set('DE');
        component.tagFilter.set('jazz');

        component.clearStationFilters();
        await flush(fixture);

        expect(component.hasStationFilters()).toBe(false);
    });

    it('surfaces a station catalogue failure with a retry path', async () => {
        radioBrowser.topStations.mockRejectedValueOnce(new Error('offline'));
        component.retryStations();
        await flush(fixture);

        expect(component.stations().error).toBe('offline');

        radioBrowser.topStations.mockResolvedValueOnce([STATION]);
        component.retryStations();
        await flush(fixture);

        expect(component.stations().error).toBeNull();
        expect(component.stations().items).toEqual([STATION]);
    });

    it('plays a station with the visible results as its queue', () => {
        component.playStationFromResults(STATION);

        expect(player.current()).toMatchObject({
            kind: 'station',
            id: 'station-1',
            title: 'Jazz FM',
            streamUrl: 'https://cdn.example/jazz',
        });
        expect(radioBrowser.reportStationClick).toHaveBeenCalledWith(
            'station-1'
        );
    });

    // The dock is rendered by the workspace shell, not by this page, so that
    // playback survives navigating away from Radio. The page's job is only to
    // hand the track to the shared player store.
    it('hands playback to the shared store without rendering a dock', () => {
        component.playStationFromResults(STATION);
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('app-radio-player')
        ).toBeNull();
        expect(player.current()).toMatchObject({
            kind: 'station',
            title: 'Jazz FM',
        });
    });
});
