import type {
    PlayerControlsCapabilities,
    PlayerTrack,
} from './player-controls.model';

/**
 * Structural comparators used as `computed({ equal })` for the controls
 * adapters. Adapters recompute on every native media event — `timeupdate` and
 * `progress` alone fire several times a second — while capabilities and track
 * lists change only when the source or its tracks do. Without these, each tick
 * hands every downstream computed and template binding a fresh object identity.
 */
export function playerCapabilitiesEqual(
    a: PlayerControlsCapabilities,
    b: PlayerControlsCapabilities
): boolean {
    return (
        a.seek === b.seek &&
        a.volume === b.volume &&
        a.audioTracks === b.audioTracks &&
        a.subtitles === b.subtitles &&
        a.quality === b.quality &&
        a.playbackSpeed === b.playbackSpeed &&
        a.aspectRatio === b.aspectRatio &&
        a.recording === b.recording &&
        a.pictureInPicture === b.pictureInPicture &&
        a.fullscreen === b.fullscreen &&
        a.seriesNavigation === b.seriesNavigation
    );
}

export function playerTracksEqual(
    a: readonly PlayerTrack[],
    b: readonly PlayerTrack[]
): boolean {
    return (
        a.length === b.length &&
        a.every((track, index) => {
            const other = b[index];
            return (
                track.id === other.id &&
                track.label === other.label &&
                track.selected === other.selected
            );
        })
    );
}
