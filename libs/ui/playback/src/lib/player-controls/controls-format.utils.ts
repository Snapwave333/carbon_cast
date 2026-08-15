export function formatTime(value: number | null | undefined): string {
    const safeValue = Number.isFinite(value)
        ? Math.max(0, Math.floor(value as number))
        : 0;
    const hours = Math.floor(safeValue / 3600);
    const minutes = Math.floor((safeValue % 3600) / 60);
    const seconds = safeValue % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(
            seconds
        ).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function volumeIcon(value: number): string {
    if (value <= 0) {
        return 'volume_off';
    }
    return value < 0.5 ? 'volume_down' : 'volume_up';
}

/** Rounds and formats a playback rate as e.g. `1.5×` for tooltips. */
export function speedLabel(speed: number): string {
    const value = Math.round(speed * 100) / 100;
    return `${value}×`;
}

export function readStoredVolume(): number {
    // `Number('')` is 0, so a blank entry left behind by another writer would
    // otherwise start every player silently muted.
    const storedValue = localStorage.getItem('volume')?.trim();
    if (!storedValue) {
        return 1;
    }
    const rawValue = Number(storedValue);
    if (!Number.isFinite(rawValue)) {
        return 1;
    }
    return Math.max(0, Math.min(1, rawValue));
}

export function persistVolume(value: number): void {
    localStorage.setItem('volume', String(value));
}
