/**
 * Devices, connectivity and hardware glyphs. Same stroke grammar as the
 * rest of the set (see app-icons.provider.ts).
 */
export const DEVICE_ICONS: Record<string, string> = {
    smartphone:
        '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
    system_update:
        '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M12 8v6"/><path d="m9.5 11.5 2.5 2.5 2.5-2.5"/>',
    desktop_windows:
        '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>',
    laptop_mac:
        '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M2.5 18h19"/>',
    keyboard:
        '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 13h.01M9 13h.01M15 13h.01M18 13h.01M8 15.5h8"/>',
    terminal:
        '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12.5 15H17"/>',
    router: '<rect x="3" y="13" width="18" height="7" rx="2"/><circle cx="7" cy="16.5" r=".9" fill="currentColor" stroke="none"/><circle cx="10.5" cy="16.5" r=".9" fill="currentColor" stroke="none"/><path d="M17 13V6.5"/><path d="M14.2 4.6a4.3 4.3 0 0 1 5.6 0"/>',
    dns: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><circle cx="8" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="16.5" r="1" fill="currentColor" stroke="none"/>',
    cable: '<rect x="3" y="3" width="5" height="7" rx="1.2"/><rect x="16" y="14" width="5" height="7" rx="1.2"/><path d="M5.5 10v4.5a3.5 3.5 0 0 0 3.5 3.5h3"/><path d="M18.5 14V9.5A3.5 3.5 0 0 0 15 6h-3"/>',
    cell_tower:
        '<path d="M8.5 8.5a5 5 0 0 1 7 0"/><path d="M6 6a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="11.5" r="1.6"/><path d="m9.5 21 2.5-8 2.5 8"/><path d="M10.4 18h3.2"/>',
    qr_code_2:
        '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v2M17 20h3"/>',
    dialpad:
        '<circle cx="6" cy="4.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="4.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="4.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="6" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="21" r="1.4" fill="currentColor" stroke="none"/>',
    vpn_key:
        '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21v3.5"/><path d="M17 12v3"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    account_circle:
        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.7" r="3"/><path d="M5.6 18.7a8 8 0 0 1 12.8 0"/>',
    local_cafe:
        '<path d="M4.5 4.5h13v6.5a5.5 5.5 0 0 1-5.5 5.5h-2A5.5 5.5 0 0 1 4.5 11Z"/><path d="M17.5 6H19a2.5 2.5 0 0 1 0 5h-1.5"/><path d="M4 20.5h15"/>',
    web_asset:
        '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18"/><circle cx="6" cy="6.8" r=".8" fill="currentColor" stroke="none"/><circle cx="8.7" cy="6.8" r=".8" fill="currentColor" stroke="none"/>',
};
