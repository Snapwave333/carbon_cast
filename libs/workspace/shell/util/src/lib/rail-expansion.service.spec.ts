import { TestBed } from '@angular/core/testing';
import { RailExpansionService } from './rail-expansion.service';

const STORAGE_KEY = 'carboncast.rail.expanded';

function createService(): RailExpansionService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(RailExpansionService);
    // The persistence effect runs on the first change detection.
    TestBed.tick();
    return service;
}

describe('RailExpansionService', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.classList.remove('rail-expanded');
    });

    it('starts collapsed by default', () => {
        const service = createService();
        expect(service.expanded()).toBe(false);
        expect(document.body.classList.contains('rail-expanded')).toBe(false);
    });

    it('toggles, reflecting onto the body class and storage', () => {
        const service = createService();

        service.toggle();
        TestBed.tick();
        expect(service.expanded()).toBe(true);
        expect(document.body.classList.contains('rail-expanded')).toBe(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

        service.toggle();
        TestBed.tick();
        expect(service.expanded()).toBe(false);
        expect(document.body.classList.contains('rail-expanded')).toBe(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    });

    it('restores the expanded choice from storage', () => {
        localStorage.setItem(STORAGE_KEY, 'true');

        const service = createService();

        expect(service.expanded()).toBe(true);
        expect(document.body.classList.contains('rail-expanded')).toBe(true);
    });
});
