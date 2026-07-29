import { HttpClientTestingModule } from '@angular/common/http/testing';
import { inject, TestBed } from '@angular/core/testing';
import { StorageMap } from '@ngx-pwa/local-storage';
import { of } from 'rxjs';
import { STORE_KEY } from '@iptvnator/shared/interfaces';
import { SettingsService } from './settings.service';

describe('Service: Settings', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [SettingsService],
            imports: [HttpClientTestingModule],
        });
    });

    it('should create a service instance', inject(
        [SettingsService],
        (service: SettingsService) => {
            expect(service).toBeTruthy();
        }
    ));

    it('should set key/value pair', inject(
        [SettingsService, StorageMap],
        (service: SettingsService, storage: StorageMap) => {
            const version = '2.1.0';
            jest.spyOn(storage, 'set').mockReturnValue(of(undefined));
            service.setValueToLocalStorage(STORE_KEY.Version, version);
            expect(storage.set).toHaveBeenCalledWith(
                STORE_KEY.Version,
                version
            );
        }
    ));

    it('should get value from the local storage', inject(
        [SettingsService],
        (service: SettingsService) => {
            const version = '2.1.0';
            service.setValueToLocalStorage(STORE_KEY.Version, version);
            service
                .getValueFromLocalStorage(STORE_KEY.Version)
                .subscribe((value) => {
                    expect(value).toBe(version);
                });
        }
    ));

    describe('Theme', () => {
        let spyOnAdd;
        beforeEach(() => {
            spyOnAdd = jest.spyOn(document.body.classList, 'add');
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it('applies the single carbon-fiber theme', inject(
            [SettingsService],
            (service: SettingsService) => {
                service.changeTheme();
                expect(spyOnAdd).toHaveBeenCalledWith(
                    'dark-theme',
                    'carbon-theme'
                );
            }
        ));
    });
});
