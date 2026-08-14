import { Injector } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import { of, Subject } from 'rxjs';
import { Language, Settings } from '@iptvnator/shared/interfaces';
import { SettingsStore } from './settings-store.service';

describe('SettingsStore storage failure reporting', () => {
    let injector: Injector;
    let storage: {
        get: jest.Mock;
        set: jest.Mock;
    };
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        storage = {
            get: jest.fn(() => of(null)),
            set: jest.fn(() => of(undefined)),
        };
        consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        injector = Injector.create({
            providers: [
                SettingsStore,
                {
                    provide: StorageMap,
                    useValue: storage,
                },
            ],
        });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('reports no failure while storage works', async () => {
        const store = injector.get(SettingsStore);

        await store.loadSettings();
        await store.updateSettings({ language: Language.FRENCH });

        expect(store.storageFailure()).toBeNull();
    });

    it('flags a failed initial load so defaults are not mistaken for saved values', async () => {
        const failingSettings = new Subject<Partial<Settings> | null>();
        storage.get.mockReturnValueOnce(failingSettings.asObservable());
        const store = injector.get(SettingsStore);

        const initialLoad = store.loadSettings();
        failingSettings.error(new Error('storage unavailable'));
        await initialLoad;

        expect(store.storageFailure()).toBe('load');
        expect(store.getSettings().language).toBe(Language.ENGLISH);
    });

    it('flags a failed save and rethrows instead of silently keeping the in-memory change', async () => {
        storage.set.mockImplementationOnce(() => {
            throw new Error('quota exceeded');
        });
        const store = injector.get(SettingsStore);
        await store.loadSettings();

        await expect(
            store.updateSettings({ language: Language.FRENCH })
        ).rejects.toThrow('quota exceeded');

        expect(store.storageFailure()).toBe('save');
        // The in-memory patch still applied — that is exactly why the flag
        // matters: the UI shows French but nothing reached disk.
        expect(store.getSettings().language).toBe(Language.FRENCH);
    });

    it('clears the failure once a later save succeeds', async () => {
        storage.set.mockImplementationOnce(() => {
            throw new Error('quota exceeded');
        });
        const store = injector.get(SettingsStore);
        await store.loadSettings();

        await expect(
            store.updateSettings({ language: Language.FRENCH })
        ).rejects.toThrow('quota exceeded');
        expect(store.storageFailure()).toBe('save');

        await store.updateSettings({ language: Language.GERMAN });

        expect(store.storageFailure()).toBeNull();
    });

    it('clears a load failure once the retried load succeeds', async () => {
        const failingSettings = new Subject<Partial<Settings> | null>();
        storage.get
            .mockReturnValueOnce(failingSettings.asObservable())
            .mockReturnValueOnce(of({ language: Language.FRENCH }));
        const store = injector.get(SettingsStore);

        const initialLoad = store.loadSettings();
        failingSettings.error(new Error('storage unavailable'));
        await initialLoad;
        expect(store.storageFailure()).toBe('load');

        await store.loadSettings();

        expect(store.storageFailure()).toBeNull();
        expect(store.getSettings().language).toBe(Language.FRENCH);
    });
});
