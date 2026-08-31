import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { PlaylistActions } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import {
    ParsedPlaylist,
    Playlist,
    PlaylistMeta,
} from '@iptvnator/shared/interfaces';
import {
    createPlaylistObject,
    mergeParsedPlaylists,
    normalizeEpgUrls,
    PlaylistMergeSource,
} from '@iptvnator/shared/m3u-utils';

/**
 * Combines playlists the user has already imported into one new playlist.
 *
 * The sources are left untouched. Merging destructively would throw away the
 * per-playlist favourites, watch history and EPG settings attached to each
 * one, and there is no undo for that.
 */

export interface PlaylistMergeRequest {
    readonly playlistIds: readonly string[];
    readonly title: string;
    readonly prefixGroupsWithSource?: boolean;
}

export interface PlaylistMergeOutcome {
    readonly playlist: Playlist;
    readonly channelCount: number;
    readonly duplicateCount: number;
    /** Ids that held no parsable M3U content, e.g. an Xtream portal. */
    readonly skippedIds: string[];
}

@Injectable({ providedIn: 'root' })
export class PlaylistMergeService {
    private readonly playlistsService = inject(PlaylistsService);
    private readonly store = inject(Store);

    /**
     * Only M3U playlists can be merged: an Xtream or Stalker entry is a set of
     * credentials, not a channel list, and its content lives in the database
     * behind a portal session rather than in `playlist.items`.
     */
    static isMergeable(playlist: PlaylistMeta): boolean {
        return !playlist.serverUrl && !playlist.macAddress;
    }

    async merge(request: PlaylistMergeRequest): Promise<PlaylistMergeOutcome> {
        const sources: PlaylistMergeSource[] = [];
        const skippedIds: string[] = [];
        const epgUrls = new Set<string>();

        for (const playlistId of request.playlistIds) {
            const playlist = await firstValueFrom(
                this.playlistsService.getPlaylist(playlistId)
            );
            const parsed = toParsedPlaylist(playlist);

            if (!parsed) {
                skippedIds.push(playlistId);
                continue;
            }

            for (const url of normalizeEpgUrls(playlist?.epgUrls)) {
                epgUrls.add(url);
            }

            sources.push({
                label: playlist?.title ?? playlist?.filename ?? playlistId,
                playlist: parsed,
            });
        }

        if (sources.length === 0) {
            throw new Error('None of the selected playlists could be read');
        }

        const merged = mergeParsedPlaylists(sources, {
            prefixGroupsWithSource: request.prefixGroupsWithSource,
        });

        const base = createPlaylistObject(request.title, merged.playlist);
        const playlist: Playlist =
            epgUrls.size > 0
                ? {
                      ...base,
                      epgUrls: normalizeEpgUrls([
                          ...(base.epgUrls ?? []),
                          ...epgUrls,
                      ]),
                  }
                : base;

        this.store.dispatch(PlaylistActions.addPlaylist({ playlist }));

        return {
            playlist,
            channelCount: merged.playlist.items.length,
            duplicateCount: merged.duplicateCount,
            skippedIds,
        };
    }
}

function toParsedPlaylist(
    playlist: Partial<Playlist> | undefined
): ParsedPlaylist | undefined {
    const parsed = playlist?.playlist as ParsedPlaylist | undefined;
    return Array.isArray(parsed?.items) ? parsed : undefined;
}
