import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { PlaylistActions } from '@iptvnator/m3u-state';
import { RemoteTextService, resolvePlaylistParser } from '@iptvnator/services';
import { ParsedPlaylist, Playlist } from '@iptvnator/shared/interfaces';
import {
    createPlaylistObject,
    mergeParsedPlaylists,
    PlaylistMergeSource,
} from '@iptvnator/shared/m3u-utils';
import { ChannelSource } from './channel-source.model';

/**
 * Imports entries from the free-channel catalogue.
 *
 * Each source is fetched and parsed here rather than handed to the existing
 * `PLAYLIST_PARSE_BY_URL` path, because merging needs the parsed items in the
 * renderer before anything is written. Adding sources separately goes through
 * the same code, so both modes behave identically apart from the final
 * grouping.
 */

export type ChannelSourceImportMode = 'separate' | 'merged';

export interface ChannelSourceImportOptions {
    readonly mode: ChannelSourceImportMode;
    /** Title of the combined playlist; ignored in `separate` mode. */
    readonly mergedTitle?: string;
    /** Prefix each merged group with its source name. */
    readonly prefixGroupsWithSource?: boolean;
    readonly onProgress?: (progress: ChannelSourceImportProgress) => void;
    readonly signal?: AbortSignal;
}

export interface ChannelSourceImportProgress {
    readonly completed: number;
    readonly total: number;
    /** Source currently being fetched. */
    readonly current: string;
}

export interface ChannelSourceImportFailure {
    readonly source: ChannelSource;
    readonly message: string;
}

export interface ChannelSourceImportResult {
    readonly playlists: Playlist[];
    readonly failures: ChannelSourceImportFailure[];
    readonly channelCount: number;
    readonly duplicateCount: number;
}

export class ChannelSourceImportCancelledError extends Error {
    constructor() {
        super('Import cancelled');
        this.name = 'ChannelSourceImportCancelledError';
    }
}

@Injectable({ providedIn: 'root' })
export class ChannelSourceImportService {
    private readonly remoteText = inject(RemoteTextService);
    private readonly store = inject(Store);

    async import(
        sources: readonly ChannelSource[],
        options: ChannelSourceImportOptions
    ): Promise<ChannelSourceImportResult> {
        const fetched: Array<{
            source: ChannelSource;
            parsed: ParsedPlaylist;
        }> = [];
        const failures: ChannelSourceImportFailure[] = [];

        for (const [index, source] of sources.entries()) {
            this.throwIfAborted(options.signal);
            options.onProgress?.({
                completed: index,
                total: sources.length,
                current: source.name,
            });

            try {
                const text = await this.remoteText.fetchText(
                    source.url,
                    'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain'
                );
                fetched.push({ source, parsed: await parseM3u(text) });
            } catch (error) {
                // One dead mirror must not abort a ten-source import; the
                // failures are reported together at the end instead.
                failures.push({
                    source,
                    message: describeError(error),
                });
            }
        }

        this.throwIfAborted(options.signal);
        options.onProgress?.({
            completed: sources.length,
            total: sources.length,
            current: '',
        });

        if (fetched.length === 0) {
            return {
                playlists: [],
                failures,
                channelCount: 0,
                duplicateCount: 0,
            };
        }

        return options.mode === 'merged'
            ? this.dispatchMerged(fetched, failures, options)
            : this.dispatchSeparate(fetched, failures);
    }

    private dispatchMerged(
        fetched: ReadonlyArray<{
            source: ChannelSource;
            parsed: ParsedPlaylist;
        }>,
        failures: ChannelSourceImportFailure[],
        options: ChannelSourceImportOptions
    ): ChannelSourceImportResult {
        const mergeSources: PlaylistMergeSource[] = fetched.map((entry) => ({
            label: entry.source.name,
            playlist: entry.parsed,
        }));

        const merged = mergeParsedPlaylists(mergeSources, {
            prefixGroupsWithSource: options.prefixGroupsWithSource,
        });

        const title =
            options.mergedTitle?.trim() ||
            fetched.map((entry) => entry.source.name).join(' + ');

        const playlist = withCatalogEpgUrls(
            createPlaylistObject(title, merged.playlist),
            fetched.map((entry) => entry.source)
        );

        this.store.dispatch(PlaylistActions.addPlaylist({ playlist }));

        return {
            playlists: [playlist],
            failures,
            channelCount: merged.playlist.items.length,
            duplicateCount: merged.duplicateCount,
        };
    }

    private dispatchSeparate(
        fetched: ReadonlyArray<{
            source: ChannelSource;
            parsed: ParsedPlaylist;
        }>,
        failures: ChannelSourceImportFailure[]
    ): ChannelSourceImportResult {
        const playlists = fetched.map((entry) =>
            withCatalogEpgUrls(
                createPlaylistObject(
                    entry.source.name,
                    entry.parsed,
                    entry.source.url,
                    'URL'
                ),
                [entry.source]
            )
        );

        // `addPlaylist` is dispatched per playlist rather than through
        // `addManyPlaylists`: the single-playlist effect is what fetches the
        // playlist-scoped EPG and navigates to the import, and the bulk action
        // does neither.
        for (const playlist of playlists) {
            this.store.dispatch(PlaylistActions.addPlaylist({ playlist }));
        }

        return {
            playlists,
            failures,
            channelCount: playlists.reduce(
                (total, playlist) => total + playlist.count,
                0
            ),
            duplicateCount: 0,
        };
    }

    private throwIfAborted(signal: AbortSignal | undefined): void {
        if (signal?.aborted) {
            throw new ChannelSourceImportCancelledError();
        }
    }
}

/**
 * Adds the catalogue's own EPG URLs on top of whatever the playlist header
 * declared. Most catalogue entries publish no `x-tvg-url`, so without this a
 * hand-checked guide URL would be dropped on import.
 */
function withCatalogEpgUrls(
    playlist: Playlist,
    sources: readonly ChannelSource[]
): Playlist {
    const epgUrls = new Set(playlist.epgUrls ?? []);
    for (const source of sources) {
        for (const url of source.epgUrls ?? []) {
            epgUrls.add(url);
        }
    }

    return epgUrls.size > 0
        ? { ...playlist, epgUrls: Array.from(epgUrls) }
        : playlist;
}

async function parseM3u(text: string): Promise<ParsedPlaylist> {
    if (!text.trimStart().startsWith('#EXTM3U')) {
        throw new Error('The response is not an M3U playlist');
    }

    // Dynamic import keeps the parser out of the eager bundle, matching the
    // existing file and URL import paths.
    const parserModule = await import('iptv-playlist-parser');
    return resolvePlaylistParser(parserModule)(text);
}

function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
