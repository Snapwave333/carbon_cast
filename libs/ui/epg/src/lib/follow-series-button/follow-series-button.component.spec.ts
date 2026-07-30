import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import { FollowSeriesButtonComponent } from './follow-series-button.component';

describe('FollowSeriesButtonComponent', () => {
    let fixture: ComponentFixture<FollowSeriesButtonComponent>;
    const followed = {
        findFollowed: jest.fn(),
        follow: jest.fn(),
        unfollow: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        await TestBed.configureTestingModule({
            imports: [FollowSeriesButtonComponent],
            providers: [
                provideNoopAnimations(),
                { provide: FollowedSeriesService, useValue: followed },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(FollowSeriesButtonComponent);
        fixture.componentRef.setInput('source', 'xtream');
        fixture.componentRef.setInput('seriesTitle', 'The Show');
        fixture.componentRef.setInput('seriesId', 42);
    });

    it('follows the current series and exposes pressed state accessibly', () => {
        followed.findFollowed.mockReturnValue(undefined);
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('button');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        button.click();

        expect(followed.follow).toHaveBeenCalledWith(
            expect.objectContaining({
                source: 'xtream',
                sourceSeriesId: 42,
                title: 'The Show',
            })
        );
    });

    it('unfollows the matching series', () => {
        followed.findFollowed.mockReturnValue({ id: 'series-42' });
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector('button');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        button.click();

        expect(followed.unfollow).toHaveBeenCalledWith('series-42');
    });
});
