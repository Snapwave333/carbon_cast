import { Provider } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { of } from 'rxjs';

/**
 * Satisfies `<mat-icon svgIcon="…">` lookups in unit tests.
 *
 * The app registers a custom stroke SVG set at bootstrap
 * (apps/web/src/app/icons/app-icons.provider.ts), which library specs cannot
 * import. Without a registry that knows those names, MatIcon throws
 * "Unable to find icon with the name …" and renders nothing — which silently
 * breaks any assertion that reads an icon's content.
 */
export function provideStubIconRegistry(): Provider {
    return {
        provide: MatIconRegistry,
        useValue: {
            getNamedSvgIcon: (name: string) => {
                const svg = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'svg'
                );
                // Mirrors the real registry closely enough for assertions that
                // check which icon was requested.
                svg.setAttribute('data-mat-icon-name', name);
                return of(svg);
            },
            addSvgIconLiteral: () => undefined,
            addSvgIconResolver: () => undefined,
            setDefaultFontSetClass: () => undefined,
            getDefaultFontSetClass: () => ['material-icons'],
        },
    };
}
