import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PROXY_PROTOCOLS, type ProxyTestResult } from '@iptvnator/shared/interfaces';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Per-app proxy for the built-in players. Only the app's own stream requests
 * are routed, which is what a geo-restricted channel needs; the rest of the
 * machine keeps its normal connection.
 */
@Component({
    selector: 'app-settings-network-section',
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslateModule,
    ],
    templateUrl: './settings-network-section.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: [':host { display: contents; }'],
})
export class SettingsNetworkSectionComponent {
    readonly form = input.required<FormGroup>();
    readonly activeSection = input.required<string>();
    readonly isTesting = input(false);
    readonly testResult = input<ProxyTestResult | null>(null);

    readonly testProxy = output<void>();

    readonly protocols = PROXY_PROTOCOLS;

    /**
     * Plain getters, not `computed()`: a reactive-forms value is not a signal,
     * so a computed over `control.value` caches the first read and the panel
     * never opens. Template expressions re-evaluate each change-detection pass,
     * which is how the sibling sections read their toggles too.
     */
    get proxyGroup(): FormGroup | null {
        return this.form().get('proxy') as FormGroup | null;
    }

    get enabled(): boolean {
        return this.proxyGroup?.get('enabled')?.value === true;
    }

    /**
     * Translation key for the probe verdict. Main-process failures arrive as
     * opaque strings, so anything unrecognised falls back to a generic message
     * with the raw reason shown alongside it.
     */
    readonly resultKey = computed(() => {
        const result = this.testResult();
        if (!result) return null;
        if (result.ok) return 'SETTINGS.PROXY_TEST_OK';
        switch (result.error) {
            case 'proxy-not-configured':
                return 'SETTINGS.PROXY_TEST_INCOMPLETE';
            case 'proxy-desktop-only':
                return 'SETTINGS.PROXY_TEST_DESKTOP_ONLY';
            default:
                return 'SETTINGS.PROXY_TEST_FAILED';
        }
    });

    /** Exit location line, e.g. "185.65.x.x (SE)". Empty until a pass. */
    readonly exitSummary = computed(() => {
        const result = this.testResult();
        if (!result?.ok) return '';
        return [result.ip, result.country ? `(${result.country})` : '']
            .filter(Boolean)
            .join(' ');
    });
}
