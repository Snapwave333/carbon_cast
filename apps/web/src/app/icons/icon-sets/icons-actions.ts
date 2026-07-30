/**
 * Action, editing and manipulation glyphs. Same stroke grammar as the rest
 * of the set (see app-icons.provider.ts).
 */
export const ACTION_ICONS: Record<string, string> = {
    add: '<path d="M12 5v14M5 12h14"/>',
    add_circle:
        '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    remove: '<path d="M5 12h14"/>',
    check: '<path d="m4.5 12.5 5 5L19.5 7"/>',
    check_circle:
        '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8 5.7-6.2"/>',
    check_box:
        '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="m8.5 12.3 2.6 2.6 4.9-5.2"/>',
    check_box_outline_blank:
        '<rect x="4" y="4" width="16" height="16" rx="2.5"/>',
    edit: '<path d="M16.8 3.7a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15Z"/><path d="m14.5 6 3.5 3.5"/>',
    delete: '<path d="M4.5 6.5h15"/><path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6"/><path d="m6.3 6.5.9 12.6a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9l.9-12.6"/><path d="M10 10.5v6M14 10.5v6"/>',
    delete_sweep:
        '<path d="M3.5 5.5h9"/><path d="M6.5 5.2V4.4a1.4 1.4 0 0 1 1.4-1.4h.9a1.4 1.4 0 0 1 1.4 1.4v.8"/><path d="m4.7 5.5.7 9.7A1.8 1.8 0 0 0 7.2 17h1.9a1.8 1.8 0 0 0 1.8-1.8l.7-9.7"/><path d="M15.5 8.5H21M15.5 12.5H20M15.5 16.5H21"/>',
    content_copy:
        '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M5.5 15.5h-.7A1.8 1.8 0 0 1 3 13.7V4.8A1.8 1.8 0 0 1 4.8 3h8.9a1.8 1.8 0 0 1 1.8 1.8v.7"/>',
    save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 3v5h7V3"/><path d="M7 21v-7h10v7"/>',
    download:
        '<path d="M12 4v10"/><path d="m7.5 10 4.5 4.5L16.5 10"/><path d="M5 19h14"/>',
    downloading:
        '<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 3.2"/><path d="M12 7v7"/><path d="m8.8 10.8 3.2 3.2 3.2-3.2"/>',
    download_for_offline:
        '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="m9 10.5 3 3 3-3"/><path d="M8 16h8"/>',
    backup: '<path d="M17.5 18.5H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18.3 12a3.3 3.3 0 0 1-.8 6.5Z"/><path d="M12 16.5V11"/><path d="M9.5 13.5 12 11l2.5 2.5"/>',
    refresh:
        '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3.5v5h-5"/>',
    sync: '<path d="M4.6 9A8 8 0 0 1 18 6.3l2 2.2"/><path d="M20 3.5v5h-5"/><path d="M19.4 15A8 8 0 0 1 6 17.7L4 15.5"/><path d="M4 20.5v-5h5"/>',
    restart_alt:
        '<path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5"/><path d="m9.2 2 3-2.5"/><path d="m9.2 2 3 2.5"/>',
    sort: '<path d="M4 6h16M4 12h11M4 18h6"/>',
    sort_by_alpha:
        '<path d="M8 20V5"/><path d="m5 8 3-3 3 3"/><path d="M16 4v15"/><path d="m13 16 3 3 3-3"/>',
    filter_list: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    filter_list_off:
        '<path d="M4 7h9M17 7h3M7 12h10M10 17h4"/><path d="m4 4 16 16"/>',
    tune: '<path d="M4 6h8M16 6h4"/><circle cx="14" cy="6" r="1.9"/><path d="M4 12h2M10 12h10"/><circle cx="8" cy="12" r="1.9"/><path d="M4 18h8M16 18h4"/><circle cx="14" cy="18" r="1.9"/>',
    drag_indicator:
        '<circle cx="9.2" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.2" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="9.2" cy="18" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    more_vert:
        '<circle cx="12" cy="5.5" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.35" fill="currentColor" stroke="none"/>',
    settings:
        '<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.5M12 18.7v2.5M21.2 12h-2.5M5.3 12H2.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4"/>',
    swap_vert:
        '<path d="M8 4v15"/><path d="m5 16 3 3 3-3"/><path d="M16 20V5"/><path d="m13 8 3-3 3 3"/>',
    radio_button_unchecked: '<circle cx="12" cy="12" r="8.5"/>',
};
