export interface GroupSelectionInputs {
    /** Keys currently visible in the rail, in display order. */
    readonly visibleKeys: readonly string[];
    readonly currentSelection: string | null;
    /** Group holding the playing channel, if any. */
    readonly activeGroupKey: string | null;
    /** Whether the playing channel changed since the last resolution. */
    readonly activeChannelChanged: boolean;
}

/**
 * The group the rail should show.
 *
 * Following the playing channel only wins when that channel *just* changed;
 * otherwise a manual selection would be yanked back to the playing group on
 * every unrelated recomputation.
 */
export function resolveGroupSelection({
    visibleKeys,
    currentSelection,
    activeGroupKey,
    activeChannelChanged,
}: GroupSelectionInputs): string | null {
    const visible = new Set(visibleKeys);

    if (activeChannelChanged && activeGroupKey && visible.has(activeGroupKey)) {
        return activeGroupKey;
    }

    if (currentSelection && visible.has(currentSelection)) {
        return currentSelection;
    }

    if (activeGroupKey && visible.has(activeGroupKey)) {
        return activeGroupKey;
    }

    return visibleKeys[0] ?? null;
}

/**
 * Centres the selected group in the rail. The rail is a plain scroll container
 * (not virtualized), so the row is addressed by its `data-group-key` rather
 * than an index.
 */
export function scrollGroupIntoView(host: HTMLElement, groupKey: string): void {
    const container = host.querySelector(
        '.groups-nav-list'
    ) as HTMLElement | null;
    const selected = Array.from(
        host.querySelectorAll<HTMLElement>('[data-group-key]')
    ).find((candidate) => candidate.dataset['groupKey'] === groupKey);

    if (!container || !selected) {
        return;
    }

    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const targetTop =
        container.scrollTop +
        (selectedRect.top - containerRect.top) -
        container.clientHeight / 2 +
        selectedRect.height / 2;
    const maxScrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight
    );

    container.scrollTo({
        behavior: 'smooth',
        top: Math.min(maxScrollTop, Math.max(0, targetTop)),
    });
}
