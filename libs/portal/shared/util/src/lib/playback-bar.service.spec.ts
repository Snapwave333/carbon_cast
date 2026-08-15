import { TestBed } from '@angular/core/testing';
import {
    PLAYBACK_BAR_HEIGHTS,
    PlaybackBarService,
} from './playback-bar.service';

const SIZE_STORAGE_KEY = 'carboncast.playbackBar.size';

function createService(): PlaybackBarService {
    TestBed.resetTestingModule();
    return TestBed.inject(PlaybackBarService);
}

describe('PlaybackBarService', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('starts compact', () => {
        expect(createService().size()).toBe('compact');
    });

    it('cycles compact → medium → large → compact', () => {
        const service = createService();

        expect(service.cycleSize()).toBe('medium');
        expect(service.cycleSize()).toBe('large');
        expect(service.cycleSize()).toBe('compact');
    });

    it('restores the stored size on the next boot', () => {
        createService().setSize('large');

        expect(createService().size()).toBe('large');
    });

    it('ignores a stored value that is not a known size', () => {
        localStorage.setItem(SIZE_STORAGE_KEY, 'gigantic');

        expect(createService().size()).toBe('compact');
    });

    it('reports the height of the selected size', () => {
        const service = createService();
        service.setSize('medium');

        expect(service.height()).toBe(PLAYBACK_BAR_HEIGHTS.medium);
    });

    // While popped out the media is playing in its own window, so leaving the
    // bar at 75vh would hold three quarters of the workspace hostage for a
    // strip that only says "playing elsewhere".
    it('collapses to the compact height while popped out', () => {
        const service = createService();
        service.setSize('large');
        service.setPoppedOut(true);

        expect(service.height()).toBe(PLAYBACK_BAR_HEIGHTS.compact);
        expect(service.size()).toBe('large');

        service.setPoppedOut(false);
        expect(service.height()).toBe(PLAYBACK_BAR_HEIGHTS.large);
    });
});
