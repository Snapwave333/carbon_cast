import { isSpanishLanguageChannel } from './spanish-channel.util';

describe('isSpanishLanguageChannel', () => {
    it.each([
        'Comedy Central en español',
        'MTV en español',
        'AMC en Español (720p) [Geo-blocked]',
        'beIN Sports XTRA en Espanol (1080p)',
        'Cine en español',
        '3ABN Latino',
        'Vevo Latino (1080p)',
        'MTV Flow Latino (720p)',
        'Telemundo West (720p)',
        'Telemundo telenovelas clásicas',
        'Univision (1080p)',
        'ESPN Deportes (720p)',
    ])('detects %s as Spanish', (name) => {
        expect(isSpanishLanguageChannel(name)).toBe(true);
    });

    it.each([
        'MTV Classic (720p)',
        'Comedy Central (1080p)',
        'CBS 3 Omaha NE (KMTV) (720p)',
        'Latin Music Hits',
        'Deportivo FC Highlights',
        'Espanola Way Live Cam',
    ])('leaves %s alone', (name) => {
        expect(isSpanishLanguageChannel(name)).toBe(false);
    });

    it('matches on the group label too', () => {
        expect(isSpanishLanguageChannel('Canal 5', 'Latino')).toBe(true);
    });

    it('handles missing values', () => {
        expect(isSpanishLanguageChannel(null)).toBe(false);
        expect(isSpanishLanguageChannel(undefined, null)).toBe(false);
        expect(isSpanishLanguageChannel('   ')).toBe(false);
    });
});
