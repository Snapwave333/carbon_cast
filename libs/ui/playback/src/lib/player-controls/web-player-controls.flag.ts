import { InjectionToken } from '@angular/core';
import {
    DEFAULT_PLAYER_CONTROLS_SETTINGS,
    type PlayerControlsSettings,
} from '@iptvnator/shared/interfaces';

/**
 * Reserved rollout switch for shared `app-player-controls` chrome on the web
 * video engines (HTML5+hls.js, Video.js, ArtPlayer).
 *
 * DEFAULT OFF. The built-in HTML5, Video.js, and ArtPlayer implementations
 * consume the injectable {@link WEB_PLAYER_SHARED_CONTROLS} token and switch
 * atomically between their existing chrome and shared controls.
 */
export const WEB_PLAYER_SHARED_CONTROLS_ENABLED = false;

/**
 * Injectable view of {@link WEB_PLAYER_SHARED_CONTROLS_ENABLED}. Components
 * inject this token; specs override it via TestBed providers without mocking a
 * module-level constant.
 */
export const WEB_PLAYER_SHARED_CONTROLS = new InjectionToken<boolean>(
    'WEB_PLAYER_SHARED_CONTROLS',
    {
        providedIn: 'root',
        factory: () => WEB_PLAYER_SHARED_CONTROLS_ENABLED,
    }
);

/** Immutable player-bar preferences captured when a player host is created. */
export const PLAYER_CONTROLS_SETTINGS =
    new InjectionToken<PlayerControlsSettings>('PLAYER_CONTROLS_SETTINGS', {
        providedIn: 'root',
        factory: () => DEFAULT_PLAYER_CONTROLS_SETTINGS,
    });
