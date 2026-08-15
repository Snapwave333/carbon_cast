import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import type { SettingsComponent } from './settings.component';
import { settingsUnsavedChangesGuard } from './settings-unsaved-changes.guard';

describe('settingsUnsavedChangesGuard', () => {
    let open: jest.Mock;

    const componentWithDirtyForm = (dirty: boolean) =>
        ({ settingsForm: { dirty } }) as SettingsComponent;

    const runGuard = (component: SettingsComponent) =>
        TestBed.runInInjectionContext(() =>
            settingsUnsavedChangesGuard(
                component,
                null as never,
                null as never,
                null as never
            )
        );

    beforeEach(() => {
        open = jest.fn();

        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [{ provide: MatDialog, useValue: { open } }],
        });
    });

    it('leaves immediately when nothing was edited', () => {
        expect(runGuard(componentWithDirtyForm(false))).toBe(true);
        expect(open).not.toHaveBeenCalled();
    });

    it('asks before discarding when the form has unsaved edits', () => {
        open.mockReturnValue({ afterClosed: () => of(true) });

        runGuard(componentWithDirtyForm(true));

        expect(open).toHaveBeenCalledTimes(1);
    });

    it('keeps the user on the page when the dialog is dismissed', (done) => {
        open.mockReturnValue({ afterClosed: () => of(undefined) });

        const result = runGuard(componentWithDirtyForm(true)) as {
            subscribe: (fn: (value: boolean) => void) => void;
        };

        result.subscribe((canLeave) => {
            expect(canLeave).toBe(false);
            done();
        });
    });

    it('allows navigation away once the user picks discard', (done) => {
        open.mockReturnValue({ afterClosed: () => of(true) });

        const result = runGuard(componentWithDirtyForm(true)) as {
            subscribe: (fn: (value: boolean) => void) => void;
        };

        result.subscribe((canLeave) => {
            expect(canLeave).toBe(true);
            done();
        });
    });
});
