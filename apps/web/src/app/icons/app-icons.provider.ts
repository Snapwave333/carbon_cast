import { inject, provideEnvironmentInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { ACTION_ICONS } from './icon-sets/icons-actions';
import { CATEGORY_ICONS } from './icon-sets/icons-categories';
import { CONTENT_ICONS } from './icon-sets/icons-content';
import { DEVICE_ICONS } from './icon-sets/icons-devices';
import { MEDIA_ICONS } from './icon-sets/icons-media';
import { NAV_ICONS } from './icon-sets/icons-nav';
import { STATUS_ICONS } from './icon-sets/icons-status';

/**
 * The app's custom icon set: hand-drawn stroke SVGs on a 24x24 grid,
 * replacing the Material Icons font. Icons are registered as inline literals
 * (no HTTP fetch), so they work identically under file:// in Electron and in
 * the PWA, and they inherit `currentColor` from the surrounding text styles.
 */
const ICON_BODIES: Record<string, string> = {
    ...NAV_ICONS,
    ...MEDIA_ICONS,
    ...ACTION_ICONS,
    ...STATUS_ICONS,
    ...DEVICE_ICONS,
    ...CONTENT_ICONS,
    ...CATEGORY_ICONS,
};

/**
 * Material ships filled/outlined variants as separate names; our stroke
 * language renders them identically, so variants alias to one glyph.
 */
const ICON_ALIASES: Record<string, string> = {
    add_circle_outline: 'add_circle',
    autorenew: 'sync',
    clear: 'close',
    star_outline: 'star',
    error_outline: 'error',
    favorite_border: 'favorite',
    file_download: 'download',
    info_outline: 'info',
    keyboard_arrow_down: 'expand_more',
    play_circle_outline: 'play_circle',
    star_border: 'star',
    warning_amber: 'warning',
};

const SVG_OPEN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">';

export function provideAppIcons() {
    return provideEnvironmentInitializer(() => {
        const registry = inject(MatIconRegistry);
        const sanitizer = inject(DomSanitizer);
        const register = (name: string, body: string) =>
            registry.addSvgIconLiteral(
                name,
                sanitizer.bypassSecurityTrustHtml(`${SVG_OPEN}${body}</svg>`)
            );

        for (const [name, body] of Object.entries(ICON_BODIES)) {
            register(name, body);
        }
        for (const [alias, target] of Object.entries(ICON_ALIASES)) {
            const body = ICON_BODIES[target];
            if (body) {
                register(alias, body);
            }
        }
    });
}
