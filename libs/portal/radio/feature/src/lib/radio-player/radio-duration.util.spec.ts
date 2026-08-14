import { formatEpisodeLength, formatPlaybackTime } from './radio-duration.util';

describe('formatPlaybackTime', () => {
    it.each([
        [0, '0:00'],
        [7, '0:07'],
        [65, '1:05'],
        [599.9, '9:59'],
        [3600, '1:00:00'],
        [3725, '1:02:05'],
    ])('formats %p as %s', (input, expected) => {
        expect(formatPlaybackTime(input)).toBe(expected);
    });

    it.each([null, undefined, NaN, Infinity, -1])(
        'returns a placeholder for %p',
        (input) => {
            expect(formatPlaybackTime(input)).toBe('--:--');
        }
    );
});

describe('formatEpisodeLength', () => {
    it.each([
        [59, '1 min'],
        [90, '2 min'],
        [2700, '45 min'],
        [3600, '1 h'],
        [4800, '1 h 20 min'],
    ])('formats %p as %s', (input, expected) => {
        expect(formatEpisodeLength(input)).toBe(expected);
    });

    it.each([null, 0, -10, NaN])('returns an empty string for %p', (input) => {
        expect(formatEpisodeLength(input)).toBe('');
    });
});
