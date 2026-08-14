import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { MockModule } from 'ng-mocks';
import { EpgProgram } from '@iptvnator/shared/interfaces';
import { TmdbEnrichmentService } from '@iptvnator/services';
import { EpgItemDescriptionComponent } from './epg-item-description.component';

describe('EpgItemDescriptionComponent', () => {
    let component: EpgItemDescriptionComponent;
    let fixture: ComponentFixture<EpgItemDescriptionComponent>;
    const tmdbMock = {
        isEnabled: jest.fn().mockReturnValue(false),
        enrichMovie: jest.fn().mockResolvedValue(null),
        enrichTv: jest.fn().mockResolvedValue(null),
    };

    beforeEach(waitForAsync(() => {
        tmdbMock.isEnabled.mockReturnValue(false);
        tmdbMock.enrichMovie.mockResolvedValue(null);
        tmdbMock.enrichTv.mockResolvedValue(null);

        TestBed.configureTestingModule({
            imports: [
                EpgItemDescriptionComponent,
                MockModule(MatDialogModule),
                TranslateModule.forRoot(),
            ],
            providers: [
                { provide: TmdbEnrichmentService, useValue: tmdbMock },
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        start: '2026-04-05T11:30:00.000Z',
                        stop: '2026-04-05T12:30:00.000Z',
                        title: 'TV Show 1',
                        desc: 'Highly interesting show about pets',
                        category: 'Fun',
                    } as unknown as EpgProgram,
                },
            ],
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(EpgItemDescriptionComponent);
        component = fixture.componentInstance;
        component.epgProgram = TestBed.inject(MAT_DIALOG_DATA);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('does not query TMDB when enrichment is disabled', () => {
        expect(tmdbMock.enrichMovie).not.toHaveBeenCalled();
        expect(tmdbMock.enrichTv).not.toHaveBeenCalled();
    });

    it('falls back to a TMDB backdrop when the feed has no artwork', async () => {
        tmdbMock.isEnabled.mockReturnValue(true);
        tmdbMock.enrichTv.mockResolvedValue({
            id: 42,
            backdrop_path: '/show-backdrop.jpg',
        });

        const localFixture = TestBed.createComponent(
            EpgItemDescriptionComponent
        );
        await localFixture.whenStable();

        expect(tmdbMock.enrichTv).toHaveBeenCalledWith({ title: 'TV Show 1' });
        expect(localFixture.componentInstance.programArtwork).toBe(
            'https://image.tmdb.org/t/p/w780/show-backdrop.jpg'
        );
        localFixture.destroy();
    });

    it('should render epg details in the dialog', () => {
        fixture.detectChanges();
        const titleElement = fixture.debugElement.query(
            By.css('.epg-dialog__title')
        );
        expect(titleElement.nativeElement.textContent.trim()).toContain(
            'TV Show 1'
        );

        const metaElement = fixture.debugElement.query(
            By.css('.epg-dialog__meta')
        );
        expect(metaElement.nativeElement.textContent).toContain('Fun');

        const descElement = fixture.debugElement.query(
            By.css('.epg-dialog__desc')
        );
        expect(descElement.nativeElement.textContent.trim()).toContain(
            'Highly interesting show about pets'
        );
    });
});
