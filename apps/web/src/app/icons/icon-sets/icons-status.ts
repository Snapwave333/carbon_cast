/**
 * Status, feedback and time glyphs. Same stroke grammar as the rest of the
 * set (see app-icons.provider.ts).
 */
export const STATUS_ICONS: Record<string, string> = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V13"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/>',
    warning:
        '<path d="M10.3 4.6 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9.5V14"/><circle cx="12" cy="17.2" r="1.05" fill="currentColor" stroke="none"/>',
    help_outline:
        '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2.1-2.4 3.6"/><circle cx="12" cy="16.8" r="1.05" fill="currentColor" stroke="none"/>',
    schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    history:
        '<path d="M3.8 8.2A9 9 0 1 1 3 12"/><path d="M3.8 3.5v4.7h4.7"/><path d="M12 8v4.3l3 1.8"/>',
    history_toggle_off:
        '<circle cx="12" cy="12" r="9" stroke-dasharray="3.4 3.4"/><path d="M12 8v4.3l3 1.8"/>',
    event: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><rect x="13.5" y="13" width="3.5" height="3.5" rx=".8" fill="currentColor" stroke="none"/>',
    event_note:
        '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13.5h9M7.5 17h5.5"/>',
    event_busy:
        '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m9.5 12.5 5 5M14.5 12.5l-5 5"/>',
    calendar_month:
        '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>',
    visibility_off:
        '<path d="M10.7 5.4A9.8 9.8 0 0 1 12 5.3c5.8 0 9.5 6.7 9.5 6.7a17.6 17.6 0 0 1-2.6 3.5"/><path d="M6.5 6.9C4 8.8 2.5 12 2.5 12S6 18.7 12 18.7a9 9 0 0 0 4.3-1.1"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/><path d="m4 4 16 16"/>',
    cloud: '<path d="M17.5 18.5H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18.3 12a3.3 3.3 0 0 1-.8 6.5Z"/>',
    cloud_off:
        '<path d="M17.5 18.5H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18.3 12a3.3 3.3 0 0 1-.8 6.5Z"/><path d="m4.5 4.5 15 15"/>',
    folder_off:
        '<path d="M3.5 6.5a2 2 0 0 1 2-2h4L12 7h6.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><path d="m4 4 16 16"/>',
    desktop_access_disabled:
        '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="m4.5 2.5 15 15"/>',
    signal_wifi_connected_no_internet_4:
        '<path d="M2.5 9C8 4 16 4 21.5 9l-7.1 8.2"/><path d="M12 20 5 12"/><path d="m16.5 15.5 5 5M21.5 15.5l-5 5"/>',
    new_releases:
        '<path d="m12 2.8 1.9 2.4 3-.6.3 3.1 2.8 1.2-1.6 2.6 1.6 2.6-2.8 1.2-.3 3.1-3-.6-1.9 2.4-1.9-2.4-3 .6-.3-3.1-2.8-1.2 1.6-2.6-1.6-2.6 2.8-1.2.3-3.1 3 .6Z"/><path d="M12 7.8v4.5"/><circle cx="12" cy="15.6" r="1" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13 3 5 13.5h5.5L10 21l8-10.5h-5.5Z"/>',
    star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.9Z"/>',
    favorite:
        '<path d="M12 20.5S3.5 15.4 3.5 9.5a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 5.9-8.5 11-8.5 11Z"/>',
};
