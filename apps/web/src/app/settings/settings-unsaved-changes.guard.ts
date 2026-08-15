import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '@iptvnator/ui/components';
import type { SettingsComponent } from './settings.component';

/**
 * Settings are only persisted by the Save button, so leaving the page with a
 * dirty form silently discarded every pending edit — including via the rail,
 * the panel's Back button and the browser's own back gesture. The form is
 * marked pristine again after a successful save, so this only fires on
 * genuinely unsaved work.
 */
export const settingsUnsavedChangesGuard: CanDeactivateFn<SettingsComponent> = (
    component
) => {
    if (!component.settingsForm.dirty) {
        return true;
    }

    const translate = inject(TranslateService);
    const instant = (key: string) => translate.instant(key) as string;

    return inject(MatDialog)
        .open<ConfirmDialogComponent, ConfirmDialogData, boolean | undefined>(
            ConfirmDialogComponent,
            {
                data: {
                    title: instant('SETTINGS.UNSAVED_CHANGES_TITLE'),
                    message: instant('SETTINGS.UNSAVED_CHANGES_MESSAGE'),
                    confirmLabel: instant('SETTINGS.UNSAVED_CHANGES_DISCARD'),
                    cancelLabel: instant('SETTINGS.UNSAVED_CHANGES_STAY'),
                    // The dialog result drives the guard; the service-style
                    // callback is unused here.
                    onConfirm: () => undefined,
                },
                width: '360px',
            }
        )
        .afterClosed()
        .pipe(map((discard) => discard === true));
};
