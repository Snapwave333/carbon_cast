import { bootstrapApplication } from '@angular/platform-browser';
import { registerAppDateLocales } from './app/app-date-locales';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

registerAppDateLocales();

/**
 * Minimum time the splash stays up. Bootstrapping from a warm cache can finish
 * in well under a frame, and a brand mark that flashes for 80ms reads as a
 * glitch rather than a launch — so a fast start still gets a deliberate beat.
 */
const SPLASH_MINIMUM_MS = 900;
/** Matches the opacity/transform transition declared on #initial-splash. */
const SPLASH_FADE_MS = 420;

const splashShownAt = performance.now();

function dismissSplash(): void {
    const splash = document.getElementById('initial-splash');
    if (!splash) {
        return;
    }

    const wait = Math.max(0, SPLASH_MINIMUM_MS - (performance.now() - splashShownAt));
    setTimeout(() => {
        // Hands off by fading over the already-painted app rather than
        // cutting to it.
        splash.classList.add('is-ready');
        setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, wait);
}

bootstrapApplication(AppComponent, appConfig)
    .then(() => {
        // Splash is rendered eagerly by index.html so the user sees something
        // immediately instead of a blank Material-grey background. The
        // requestAnimationFrame ensures the swap happens after the first
        // AppComponent paint, so the app is behind the splash before it fades.
        requestAnimationFrame(dismissSplash);
    })
    .catch((err) => {
        // A failed bootstrap must not leave the user staring at a splash that
        // never resolves.
        console.error(err);
        dismissSplash();
    });
