import { Injectable, signal } from '@angular/core';
import {
    normalizeProxySettings,
    type ProxySettingsInput,
    type ProxyTestResult,
} from '@iptvnator/shared/interfaces';

/**
 * Drives the "Test connection" button. The probe runs in the main process
 * against a throwaway Chromium session, so a wrong host or password is caught
 * before it can be saved and take every stream offline.
 */
@Injectable({ providedIn: 'root' })
export class SettingsProxyFacade {
    private readonly testingState = signal(false);
    private readonly resultState = signal<ProxyTestResult | null>(null);

    readonly isTesting = this.testingState.asReadonly();
    readonly result = this.resultState.asReadonly();

    /** Clear a stale verdict as soon as any proxy field is edited. */
    clearResult(): void {
        this.resultState.set(null);
    }

    async test(proxy: ProxySettingsInput): Promise<void> {
        const settings = normalizeProxySettings(proxy);
        if (!window.electron?.testProxy) {
            this.resultState.set({ ok: false, error: 'proxy-desktop-only' });
            return;
        }
        if (!settings.host) {
            this.resultState.set({ ok: false, error: 'proxy-not-configured' });
            return;
        }

        this.testingState.set(true);
        this.resultState.set(null);
        try {
            this.resultState.set(await window.electron.testProxy(settings));
        } catch (error) {
            this.resultState.set({
                ok: false,
                error:
                    error instanceof Error ? error.message : 'proxy-test-failed',
            });
        } finally {
            this.testingState.set(false);
        }
    }
}
