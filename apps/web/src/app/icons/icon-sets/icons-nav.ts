/**
 * Navigation, arrows and wayfinding glyphs.
 *
 * Every body is inner SVG markup on a 24x24 grid; the registration wrapper
 * applies fill="none" stroke="currentColor" stroke-width="1.7" with round
 * caps/joins (see app-icons.provider.ts).
 */
export const NAV_ICONS: Record<string, string> = {
    arrow_back: '<path d="M20 12H5"/><path d="m11 18-6-6 6-6"/>',
    arrow_forward: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    arrow_upward: '<path d="M12 20V5"/><path d="m6 11 6-6 6 6"/>',
    arrow_downward: '<path d="M12 4v15"/><path d="m18 13-6 6-6-6"/>',
    arrow_outward: '<path d="M7 17 17 7"/><path d="M9 7h8v8"/>',
    chevron_left: '<path d="m14 6-6 6 6 6"/>',
    chevron_right: '<path d="m10 6 6 6-6 6"/>',
    expand_more: '<path d="m6 9 6 6 6-6"/>',
    expand_less: '<path d="m6 15 6-6 6 6"/>',
    arrow_drop_down:
        '<path d="M8 10h8l-4 5z" fill="currentColor" stroke="none"/>',
    unfold_more: '<path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>',
    unfold_less: '<path d="m8 4 4 4 4-4"/><path d="m8 20 4-4 4 4"/>',
    subdirectory_arrow_right:
        '<path d="M5 4v8h12"/><path d="m13 8 4 4-4 4"/>',
    keyboard_return:
        '<path d="M19 6v4a2 2 0 0 1-2 2H5"/><path d="m9 8-4 4 4 4"/>',
    swap_horiz:
        '<path d="M4 7h13"/><path d="m14 4 3 3-3 3"/><path d="M20 17H7"/><path d="m10 14-3 3 3 3"/>',
    my_location:
        '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    home: '<path d="m4 11 8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    explore:
        '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    public:
        '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9Z"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    zoom_in:
        '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/><path d="M11 8.5v5M8.5 11h5"/>',
    open_in_new:
        '<path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5"/><path d="M14 3h7v7"/><path d="M21 3 11.5 12.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
    search_off:
        '<circle cx="10.5" cy="10.5" r="6"/><path d="m15.5 15.5 5 5"/><path d="m8.3 8.3 4.4 4.4M12.7 8.3l-4.4 4.4"/>',
    manage_search:
        '<path d="M3 6.5h6M3 11.5h4.5M3 16.5h8"/><circle cx="15.5" cy="9.5" r="4.3"/><path d="m18.7 12.7 2.8 2.8"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
