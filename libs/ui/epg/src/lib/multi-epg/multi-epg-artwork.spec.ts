import { MultiEpgArtwork } from './multi-epg-artwork';
import { MultiEpgLayoutProgram } from './multi-epg-layout.util';

function layoutProgram(
    width: number,
    iconUrl: string | null
): MultiEpgLayoutProgram {
    return {
        title: 'Show',
        start: '2026-08-12T10:00:00',
        stop: '2026-08-12T11:00:00',
        channel: 'channel-1',
        desc: null,
        category: null,
        iconUrl,
        startDate: new Date('2026-08-12T10:00:00'),
        stopDate: new Date('2026-08-12T11:00:00'),
        startPosition: 0,
        width,
        timeLabel: '10:00 – 11:00',
    } as MultiEpgLayoutProgram;
}

describe('MultiEpgArtwork', () => {
    const url = 'https://img.example/still.jpg';

    it('returns cell artwork only for cells wide enough to keep the title', () => {
        const artwork = new MultiEpgArtwork();
        expect(artwork.cellArtworkUrl(layoutProgram(200, url))).toBe(url);
        expect(artwork.cellArtworkUrl(layoutProgram(120, url))).toBeNull();
    });

    it('drops unsafe or missing URLs', () => {
        const artwork = new MultiEpgArtwork();
        expect(artwork.cellArtworkUrl(layoutProgram(200, null))).toBeNull();
        expect(
            artwork.cellArtworkUrl(layoutProgram(200, 'javascript:alert(1)'))
        ).toBeNull();
    });

    it('never retries a URL that already failed to load', () => {
        const artwork = new MultiEpgArtwork();
        artwork.markFailed(url);
        expect(artwork.cellArtworkUrl(layoutProgram(200, url))).toBeNull();
        expect(artwork.resultArtworkUrl({ iconUrl: url })).toBeNull();
    });

    it('falls back to the channel icon when the programme has no artwork', () => {
        const artwork = new MultiEpgArtwork();
        const icon = 'https://img.example/logo.png';
        expect(artwork.cellArtworkUrl(layoutProgram(200, null), icon)).toBe(
            icon
        );
        expect(artwork.cellArtworkUrl(layoutProgram(200, url), icon)).toBe(url);
        artwork.markFailed(icon);
        expect(
            artwork.cellArtworkUrl(layoutProgram(200, null), icon)
        ).toBeNull();
    });

    it('serves search-result artwork without a width constraint', () => {
        const artwork = new MultiEpgArtwork();
        expect(artwork.resultArtworkUrl({ iconUrl: url })).toBe(url);
    });

    it('shows the time label only from a medium cell width up', () => {
        const artwork = new MultiEpgArtwork();
        expect(artwork.showsTimeLabel(layoutProgram(120, null))).toBe(true);
        expect(artwork.showsTimeLabel(layoutProgram(80, null))).toBe(false);
    });

    it('returns no cell artwork when the guide-artwork setting is off', () => {
        const artwork = new MultiEpgArtwork(() => false);
        expect(
            artwork.cellArtworkUrl(layoutProgram(200, url), 'https://x/l.png')
        ).toBeNull();
    });

    it('hides all text in sliver cells that cannot fit it', () => {
        const artwork = new MultiEpgArtwork();
        expect(artwork.showsTitle(layoutProgram(44, null))).toBe(true);
        expect(artwork.showsTitle(layoutProgram(30, null))).toBe(false);
    });
});
