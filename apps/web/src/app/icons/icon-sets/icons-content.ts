/**
 * Content, documents, folders and layout-view glyphs. Same stroke grammar
 * as the rest of the set (see app-icons.provider.ts).
 */
export const CONTENT_ICONS: Record<string, string> = {
    folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4L12 7h6.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
    folder_open:
        '<path d="M3.5 18.5v-12a2 2 0 0 1 2-2h4L12 7h6.5a2 2 0 0 1 2 2v1.5"/><path d="M3.5 18.5 6 11.5h15.5l-2.6 7Z"/>',
    article:
        '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    description:
        '<path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h7"/>',
    subject: '<path d="M4 7h16M4 11h16M4 15h16M4 19h10"/>',
    list_alt:
        '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 8h.01M8 12h.01M8 16h.01"/><path d="M11 8h5.5M11 12h5.5M11 16h5.5"/>',
    format_list_bulleted:
        '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.15" fill="currentColor" stroke="none"/>',
    menu_book:
        '<path d="M12 6.5C10 4.8 7 4.5 3.5 4.7v14c3.5-.2 6.5.1 8.5 1.8 2-1.7 5-2 8.5-1.8v-14C17 4.5 14 4.8 12 6.5Z"/><path d="M12 6.5v14"/>',
    library_books:
        '<rect x="7" y="3.5" width="14" height="14" rx="2"/><path d="M3.5 7.5V18a2 2 0 0 0 2 2H17"/><path d="M10.5 8h7M10.5 11.5h7"/>',
    tag: '<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h16M3.5 15h16"/>',
    coffee:
        '<path d="M4 8.5h13v6a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 14.5Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7.5 3v2.5M11 3v2.5M14.5 3v2.5"/>',
    dashboard:
        '<rect x="3.5" y="3.5" width="7.5" height="10" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="6" rx="1.5"/><rect x="13.5" y="12" width="7" height="8.5" rx="1.5"/><rect x="3.5" y="16" width="7.5" height="4.5" rx="1.5"/>',
    grid_view:
        '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    view_module:
        '<rect x="3.5" y="5" width="5" height="6" rx="1"/><rect x="9.5" y="5" width="5" height="6" rx="1"/><rect x="15.5" y="5" width="5" height="6" rx="1"/><rect x="3.5" y="13" width="5" height="6" rx="1"/><rect x="9.5" y="13" width="5" height="6" rx="1"/><rect x="15.5" y="13" width="5" height="6" rx="1"/>',
    view_comfy:
        '<rect x="3.5" y="4" width="17" height="7" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7" rx="1.5"/><rect x="13" y="13" width="7.5" height="7" rx="1.5"/>',
    view_quilt:
        '<rect x="3.5" y="4.5" width="6.5" height="15" rx="1.5"/><rect x="12" y="4.5" width="8.5" height="6.5" rx="1.5"/><rect x="12" y="13" width="8.5" height="6.5" rx="1.5"/>',
    view_list:
        '<rect x="4" y="4.5" width="4" height="4" rx="1"/><path d="M10.5 6.5H20"/><rect x="4" y="10" width="4" height="4" rx="1"/><path d="M10.5 12H20"/><rect x="4" y="15.5" width="4" height="4" rx="1"/><path d="M10.5 17.5H20"/>',
    view_sidebar:
        '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M15.5 4.5v15"/>',
    view_timeline:
        '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7 8.5h5.5M11.5 12H17M7 15.5h5.5"/>',
    layers: '<path d="m12 3.5 8.5 5L12 13.5l-8.5-5Z"/><path d="m3.8 12.8 8.2 4.8 8.2-4.8"/><path d="m3.8 16.6 8.2 4.8 8.2-4.8"/>',
};
