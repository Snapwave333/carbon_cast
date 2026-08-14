import { RadioTab } from './radio.component';

export interface RadioTabDef {
    id: RadioTab;
    icon: string;
    label: string;
}

export const RADIO_TABS: readonly RadioTabDef[] = [
    { id: 'stations', icon: 'radio', label: 'RADIO.TAB_STATIONS' },
    { id: 'podcasts', icon: 'podcasts', label: 'RADIO.TAB_PODCASTS' },
    { id: 'library', icon: 'favorite', label: 'RADIO.TAB_LIBRARY' },
];

/**
 * Maps a key press on the tablist to the tab index it should move to, or null
 * when the key is not a navigation key. Arrows wrap around the ends, Home/End
 * jump to them — the roving-tabindex behaviour the WAI-ARIA tabs pattern
 * expects. Kept pure so the keyboard contract can be asserted without a DOM.
 */
export function nextTabIndex(
    key: string,
    index: number,
    count: number
): number | null {
    const last = count - 1;
    switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
            return index === last ? 0 : index + 1;
        case 'ArrowLeft':
        case 'ArrowUp':
            return index === 0 ? last : index - 1;
        case 'Home':
            return 0;
        case 'End':
            return last;
        default:
            return null;
    }
}
