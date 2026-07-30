import {
    descriptionSimilarity,
    normalizeFollowedSeriesTitle,
    parseSeasonEpisode,
} from './followed-series-normalization.util';

describe('followed series normalization', () => {
    it('normalizes punctuation, case, accents, channel prefixes, and release years', () => {
        expect(normalizeFollowedSeriesTitle('US | Thé Office (2005)')).toBe(
            'the office'
        );
        expect(normalizeFollowedSeriesTitle('THE-OFFICE')).toBe('the office');
    });

    it('parses XMLTV and common season/episode formats', () => {
        expect(parseSeasonEpisode('0.2.0/1')).toEqual({
            seasonNumber: 1,
            episodeNumber: 3,
        });
        expect(parseSeasonEpisode(null, 'Show Name S04E11')).toEqual({
            seasonNumber: 4,
            episodeNumber: 11,
        });
    });

    it('uses description similarity as a resilient duplicate signal', () => {
        expect(
            descriptionSimilarity(
                'A detective returns home to solve the final case.',
                'The detective returns home and solves the final case.'
            )
        ).toBeGreaterThan(0.7);
    });
});
