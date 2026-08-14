import { inject } from '@angular/core';
import { Route } from '@angular/router';
import {
    RuntimeCapabilitiesService,
    SettingsStore,
} from '@iptvnator/services';
import { M3uCollectionRouteComponent } from './m3u-collection-route/m3u-collection-route.component';
import { provideM3uWorkspaceRouteSession } from './m3u-workspace-route-session.service';
import { VideoPlayerComponent } from './video-player/video-player.component';

/**
 * Resolves which section a playlist opens on. The user picks it in settings
 * (TV guide by default); runtimes without the EPG stack fall back to the
 * channel list, since the guide would render an empty grid there. Settings are
 * loaded by the workspace shell's resolver before any child route activates.
 */
function resolveDefaultSection(): string {
    const settings = inject(SettingsStore);
    const runtime = inject(RuntimeCapabilitiesService);
    const preferred = settings.playlistDefaultSection?.() ?? 'guide';

    return preferred === 'guide' && !runtime.supportsEpg ? 'all' : preferred;
}

export function createM3uWorkspaceRoutes(): Route[] {
    return [
        {
            path: '',
            pathMatch: 'full',
            redirectTo: resolveDefaultSection,
        },
        {
            path: 'favorites',
            providers: provideM3uWorkspaceRouteSession(),
            component: M3uCollectionRouteComponent,
            data: {
                mode: 'favorites',
                portalType: 'm3u',
                defaultScope: 'playlist',
            },
        },
        {
            path: 'recent',
            providers: provideM3uWorkspaceRouteSession(),
            component: M3uCollectionRouteComponent,
            data: {
                mode: 'recent',
                portalType: 'm3u',
                defaultScope: 'playlist',
            },
        },
        {
            path: ':view',
            providers: provideM3uWorkspaceRouteSession(),
            component: VideoPlayerComponent,
        },
    ];
}
