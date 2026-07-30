/**
 * Playback, audio/video and broadcast glyphs. Same stroke grammar as the
 * rest of the set (see app-icons.provider.ts).
 */
export const MEDIA_ICONS: Record<string, string> = {
    play_arrow: '<path d="M8 5.5v13l11-6.5Z"/>',
    pause: '<rect x="7" y="5" width="3.4" height="14" rx="1.2"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    stop_circle:
        '<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none"/>',
    play_circle:
        '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
    skip_next: '<path d="M6 6.5v11l8-5.5z"/><path d="M17.5 6v12"/>',
    skip_previous: '<path d="M18 6.5v11l-8-5.5z"/><path d="M6.5 6v12"/>',
    replay: '<path d="M4.2 12a7.8 7.8 0 1 0 2.6-5.6"/><path d="M7.2 2.8v3.8H3.4"/>',
    replay_10:
        '<path d="M4.2 12a7.8 7.8 0 1 0 2.6-5.6"/><path d="M7.2 2.8v3.8H3.4"/><path d="m10 11 1.2-.7v5"/><path d="M14.7 10.3c1 0 1.7.9 1.7 2.4s-.7 2.4-1.7 2.4S13 14.2 13 12.7s.7-2.4 1.7-2.4Z"/>',
    forward_10:
        '<path d="M19.8 12a7.8 7.8 0 1 1-2.6-5.6"/><path d="M16.8 2.8v3.8h3.8"/><path d="m10 11 1.2-.7v5"/><path d="M14.7 10.3c1 0 1.7.9 1.7 2.4s-.7 2.4-1.7 2.4S13 14.2 13 12.7s.7-2.4 1.7-2.4Z"/>',
    speed: '<path d="M5 18a9 9 0 1 1 14 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/>',
    network_check:
        '<path d="M5 18a9 9 0 1 1 14 0"/><path d="m12 13 4.5-4.5"/><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none"/>',
    volume_up:
        '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
    volume_down:
        '<path d="M6 9v6h4l5 4V5l-5 4z"/><path d="M18.5 8.5a5 5 0 0 1 0 7"/>',
    volume_off:
        '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
    graphic_eq: '<path d="M5 9v6M8.5 6v12M12 3v18M15.5 6v12M19 9v6"/>',
    equalizer: '<path d="M6 18v-6M12 18V6M18 18v-9"/>',
    cast: '<path d="M4 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 14a7 7 0 0 1 7 7"/><path d="M2 17.5A3.5 3.5 0 0 1 5.5 21"/><circle cx="2.6" cy="20.4" r=".9" fill="currentColor" stroke="none"/>',
    live_tv:
        '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m8 3 4 4 4-4"/><path d="M10.5 11.5v5l4.5-2.5z"/>',
    tv: '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M9 21h6"/>',
    tv_off: '<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M9 21h6"/><path d="m4 3.5 16 16"/>',
    radio: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="m5 9 11-5"/><circle cx="8.5" cy="14.5" r="2.2"/><path d="M14 12.5h4M14 16.5h4"/>',
    movie: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="m7 5 2 4M12 5l2 4M17 5l2 4"/>',
    video_library:
        '<rect x="7" y="7" width="14" height="13" rx="2"/><path d="M3 17V5a2 2 0 0 1 2-2h12"/><path d="M12 10.5v6l5-3z"/>',
    queue: '<path d="M3 6h13M3 10h13M3 14h8"/><path d="M18 12v6M15 15h6"/>',
    playlist_play:
        '<path d="M3 6h13M3 10h13M3 14h7"/><path d="M14 13v6l5-3z"/>',
    playlist_add:
        '<path d="M3 6h13M3 10h13M3 14h8"/><path d="M18 13v6M15 16h6"/>',
    settings_remote:
        '<rect x="8" y="8" width="8" height="13" rx="2"/><circle cx="12" cy="12.5" r="1.4"/><path d="M8.5 5.5a5 5 0 0 1 7 0"/><path d="M6 3a8.5 8.5 0 0 1 12 0"/>',
    aspect_ratio:
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 11.5v-3h3"/><path d="M17.5 12.5v3h-3"/>',
    fullscreen_exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    picture_in_picture:
        '<rect x="3" y="4.5" width="18" height="15" rx="2"/><rect x="12.5" y="7.5" width="5.5" height="4" rx="1" fill="currentColor" stroke="none"/>',
    picture_in_picture_alt:
        '<rect x="3" y="4.5" width="18" height="15" rx="2"/><rect x="12.5" y="12" width="5.5" height="4" rx="1" fill="currentColor" stroke="none"/>',
    subtitles:
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 12h2M11 12h6.5M6.5 15.5h6.5M15.5 15.5h2"/>',
    subtitles_off:
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 12h2M11 12h6.5M6.5 15.5h6.5M15.5 15.5h2"/><path d="m4 3.5 16 16"/>',
    smart_display:
        '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9v6l5.5-3z"/>',
    fiber_manual_record:
        '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',
};
