import { FormBuilder } from '@angular/forms';
import { Settings } from '@iptvnator/shared/interfaces';
import {
    createSettingsForm,
    createSettingsFromFormValue,
} from './settings-form.utils';

describe('settings form utils — strip country prefix', () => {
    const formBuilder = new FormBuilder();

    it('defaults the form control to false', () => {
        const form = createSettingsForm(formBuilder, true);

        expect(form.getRawValue().stripCountryPrefix).toBe(false);
    });

    it('carries an enabled toggle into the settings object', () => {
        const form = createSettingsForm(formBuilder, true);
        form.patchValue({ stripCountryPrefix: true });

        const settings = createSettingsFromFormValue(form, {} as Settings);

        expect(settings.stripCountryPrefix).toBe(true);
    });

    it('falls back to false when the form value is missing', () => {
        const form = createSettingsForm(formBuilder, true);
        form.patchValue({
            stripCountryPrefix: null as unknown as boolean,
        });

        const settings = createSettingsFromFormValue(form, {} as Settings);

        expect(settings.stripCountryPrefix).toBe(false);
    });

    it('defaults to showing U.S. channels first and preserves an explicit opt-out', () => {
        const form = createSettingsForm(formBuilder, true);

        expect(form.getRawValue().hideNonUsChannels).toBe(true);

        form.patchValue({ hideNonUsChannels: false });
        expect(
            createSettingsFromFormValue(form, {} as Settings).hideNonUsChannels
        ).toBe(false);
    });

    it('uses the left-player layout for a fresh form but preserves an explicit choice', () => {
        const form = createSettingsForm(formBuilder, true);

        expect(form.getRawValue().mirrorLayout).toBe(true);

        form.patchValue({ mirrorLayout: false });
        expect(
            createSettingsFromFormValue(form, {} as Settings).mirrorLayout
        ).toBe(false);
    });

    it('normalizes persisted bottom-control preferences from the form', () => {
        const form = createSettingsForm(formBuilder, true);
        form.patchValue({
            playerControls: {
                visible: false,
                autoHideDelayMs: -10,
                density: 'compact',
            },
        });

        expect(
            createSettingsFromFormValue(form, {} as Settings).playerControls
        ).toEqual({
            visible: false,
            autoHideDelayMs: 0,
            density: 'compact',
            opacity: 'translucent',
            size: 'medium',
        });
    });
});
