/**
 * Category glyphs for channel-group tiles (sports, music, news, ...).
 * Same stroke grammar as the rest of the set (see app-icons.provider.ts).
 */
export const CATEGORY_ICONS: Record<string, string> = {
    sparkles:
        '<path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z"/><path d="m18.5 15 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
    car: '<path d="M4.5 16v-3.5L6.5 7h11l2 5.5V16"/><path d="M4.5 12.5h15"/><circle cx="8" cy="16.5" r="1.8"/><circle cx="16" cy="16.5" r="1.8"/>',
    briefcase:
        '<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"/><path d="M3.5 12.5h17"/>',
    film_strip:
        '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14"/><path d="M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
    mask: '<path d="M5 4.5c4.7 1.6 9.3 1.6 14 0V11a7 7 0 0 1-14 0Z"/><path d="M8.5 9h.01M15.5 9h.01"/><path d="M9 12.3a3.6 3.6 0 0 0 6 0"/>',
    cooking_pot:
        '<path d="M9 3.5c0 1.2 1 1.4 1 2.6M13.5 3.5c0 1.2 1 1.4 1 2.6"/><path d="M2.5 10h19"/><path d="M4.5 10v3.5A5.5 5.5 0 0 0 10 19h4a5.5 5.5 0 0 0 5.5-5.5V10"/>',
    palette:
        '<path d="M12 3a9 9 0 1 0 .6 18c1.5 0 2-.9 1.4-2-.6-1.2-.2-2.5 1.5-2.5h1.8A3.7 3.7 0 0 0 21 12.8 10 10 0 0 0 12 3Z"/><circle cx="7.6" cy="10.6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none"/><circle cx="16.4" cy="10.2" r="1" fill="currentColor" stroke="none"/>',
    videocam:
        '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 11 6-3v8l-6-3"/>',
    grad_cap:
        '<path d="m12 4 10 4.5L12 13 2 8.5Z"/><path d="M6.5 10.8V15c3.7 2 7.3 2 11 0v-4.2"/><path d="M22 8.5V13"/>',
    ticket: '<path d="M3.5 9V5.5h17V9a2.5 2.5 0 0 0 0 5v3.5h-17V14a2.5 2.5 0 0 0 0-5Z"/><path d="M14 5.5v13" stroke-dasharray="2.4 2.6"/>',
    family: '<circle cx="8.5" cy="8" r="3"/><path d="M2.5 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M14.8 13.4A4.8 4.8 0 0 1 21.5 18"/>',
    balloon:
        '<ellipse cx="12" cy="8.5" rx="5" ry="5.7"/><path d="m11.2 14 .8 1.2 1-.9"/><path d="M12 15.2c-1.4 1.8.8 3 .1 5.3"/>',
    landmark:
        '<path d="m12 3 8.5 4.5H3.5Z"/><path d="M5.5 7.5V16M10 7.5V16M14 7.5V16M18.5 7.5V16"/><path d="M3 16h18M3.5 19.5h17"/>',
    leaf: '<path d="M20 4c.5 9-4 16-12 16-1.5-6 2-14.5 12-16Z"/><path d="M4.5 19.5C8 14 12 10.5 17 8"/>',
    music_note:
        '<path d="M9 18.5V5.5l10-2v12.5"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    newspaper:
        '<path d="M4 5.5h13v12.5a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z"/><path d="M17 8.5h2.5v9.5a1.5 1.5 0 0 1-1.5 1.5"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
    mountains:
        '<path d="m3 18 5.5-9 3.5 5.5L15 9l6 9Z"/><circle cx="7.5" cy="6" r="1.8"/>',
    crescent:
        '<path d="M20 13.5A8.5 8.5 0 1 1 10.5 4 7 7 0 0 0 20 13.5Z"/>',
    church: '<path d="M12 2.5V7M10 4.5h4"/><path d="M6.5 12 12 7.5l5.5 4.5"/><path d="M7 11.5V20h10v-8.5"/><path d="M12 20v-4"/>',
    flask: '<path d="M9.5 3h5"/><path d="M10.5 3v5.5L5 17.5a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3L13.5 8.5V3"/><path d="M7.8 14.5h8.4"/>',
    cart: '<circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/><path d="M3 4h2.5l2.5 11h9.5l2.5-8H6.5"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="m12 8 3.4 2.5-1.3 4h-4.2l-1.3-4Z"/><path d="M12 3v5M5.2 7.3l3.5 3.2M18.8 7.3l-3.5 3.2M8.5 20l1.4-3.5M15.5 20l-1.4-3.5"/>',
    plane: '<path d="m21 3-9.5 18-2-7.5L2 11.5Z"/><path d="M21 3 9.5 13.5"/>',
    sun_cloud:
        '<circle cx="8" cy="8.5" r="3.2"/><path d="M8 2.5v1.6M2 8.5h1.6M3.8 4.3l1.1 1.1M12.2 4.3l-1.1 1.1"/><path d="M11.5 19.5h6.3a3.2 3.2 0 0 0 .6-6.4 4.6 4.6 0 0 0-8.9-1.3 3.6 3.6 0 0 0 2 7.7Z"/>',
};
