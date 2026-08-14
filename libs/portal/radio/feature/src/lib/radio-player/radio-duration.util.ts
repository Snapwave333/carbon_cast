/**
 * Formats a playback offset as `M:SS`, or `H:MM:SS` once it passes an hour.
 * Returns `--:--` for values that are not a usable position (a live stream has
 * no duration, and `<audio>` reports `NaN`/`Infinity` before metadata lands).
 */
export function formatPlaybackTime(seconds: number | null | undefined): string {
    if (
        seconds === null ||
        seconds === undefined ||
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return '--:--';
    }

    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const padded = String(secs).padStart(2, '0');

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${padded}`
        : `${minutes}:${padded}`;
}

/** Compact episode length for list rows: `45 min`, `1 h 20 min`. */
export function formatEpisodeLength(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
        return '';
    }

    const totalMinutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    }
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
