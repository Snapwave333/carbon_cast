import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import { SettingsStore } from '@iptvnator/services';
import {
    selectActive,
    selectActivePlaylistId,
    selectChannels,
} from '@iptvnator/m3u-state';
import { AgentControlRuntimeService } from './agent-control-runtime.service';

type Selector = unknown;

describe('AgentControlRuntimeService channel operations', () => {
    let service: AgentControlRuntimeService;
    let channels: unknown[];
    let activePlaylistId: string | null;
    const dispatch = jest.fn();

    function createService() {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: Store,
                    useValue: {
                        dispatch,
                        select: (selector: Selector) => {
                            if (selector === selectChannels) return of(channels);
                            if (selector === selectActivePlaylistId)
                                return of(activePlaylistId);
                            if (selector === selectActive) return of(null);
                            return of(null);
                        },
                    },
                },
                { provide: Router, useValue: { navigateByUrl: jest.fn() } },
                {
                    provide: SettingsStore,
                    useValue: {
                        player: () => 'videojs',
                        mirrorLayout: () => false,
                        showCaptions: () => false,
                        webPlayerSharedControls: () => false,
                        playerControls: () => ({}),
                    },
                },
                {
                    provide: FollowedSeriesService,
                    useValue: { list: () => [], scheduled: () => [] },
                },
            ],
        });
        return TestBed.inject(AgentControlRuntimeService);
    }

    const run = (operation: string, params: Record<string, unknown> = {}) =>
        (
            service as unknown as {
                execute: (request: unknown) => Promise<unknown>;
            }
        ).execute({ operation, params, correlationId: 'test' });

    beforeEach(() => {
        dispatch.mockClear();
        channels = [];
        activePlaylistId = null;
        service = createService();
    });

    it('reports channels as loaded when no playlist is open', async () => {
        const result = (await run('channel.list')) as {
            count: number;
            loaded: boolean;
        };

        expect(result).toMatchObject({ count: 0, loaded: true });
    });

    it('flags an open playlist whose channels this route never loaded', async () => {
        activePlaylistId = 'playlist-1';

        const result = (await run('channel.list')) as { loaded: boolean };

        // The guide is one such route; without this an agent cannot tell an
        // empty playlist from an unloaded one.
        expect(result.loaded).toBe(false);
    });

    it('reports channels as loaded once the store has them', async () => {
        activePlaylistId = 'playlist-1';
        channels = [{ id: 'a', name: 'Cartoon Classics' }];

        const result = (await run('channel.list')) as {
            count: number;
            loaded: boolean;
        };

        expect(result).toMatchObject({ count: 1, loaded: true });
    });

    it('explains an unloaded route instead of claiming the channel is missing', async () => {
        activePlaylistId = 'playlist-1';

        await expect(
            run('channel.switch', { channelId: 'a' })
        ).rejects.toMatchObject({
            code: 'operation-unsupported',
            message: expect.stringContaining('has not loaded its channels'),
        });
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('still reports a genuinely missing channel as not found', async () => {
        activePlaylistId = 'playlist-1';
        channels = [{ id: 'a', name: 'Cartoon Classics' }];

        await expect(
            run('channel.switch', { channelId: 'nope' })
        ).rejects.toMatchObject({ code: 'not-found' });
    });

    it('switches to a channel that is present', async () => {
        activePlaylistId = 'playlist-1';
        channels = [{ id: 'a', name: 'Cartoon Classics' }];

        const result = (await run('channel.switch', { channelId: 'a' })) as {
            channel: { name: string };
        };

        expect(result.channel.name).toBe('Cartoon Classics');
        expect(dispatch).toHaveBeenCalled();
    });
    it.each(['//evil.example/x', '/\\evil.example', 'https://evil.example', 'workspace/dashboard'])(
        'rejects the protocol-relative or external route %s',
        async (route) => {
            // `//host` passes a bare startsWith('/') check but reads as an
            // external authority to a URL parser.
            await expect(run('app.navigate', { route })).rejects.toMatchObject({
                code: 'invalid-request',
            });
        }
    );
});
