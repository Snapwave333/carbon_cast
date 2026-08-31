import {
    AUTO_QUALITY_ID,
    buildQualityTracks,
    formatQualityLabel,
    pickPreferredQualityId,
    sortQualityLevelsDescending,
    type PlayerQualityLevel,
} from './player-quality.util';

function level(
    id: number,
    height: number | null,
    bitrateBps: number | null = null
): PlayerQualityLevel {
    return { id, height, bitrateBps };
}

const LADDER = [
    level(0, 480, 800_000),
    level(1, 720, 2_000_000),
    level(2, 1080, 5_000_000),
    level(3, 2160, 16_000_000),
];

describe('formatQualityLabel', () => {
    it('names the 4K and 2K renditions', () => {
        expect(formatQualityLabel(level(0, 2160))).toBe('2160p (4K)');
        expect(formatQualityLabel(level(0, 1440))).toBe('1440p (2K)');
    });

    it('uses a bare pixel height below the aliased renditions', () => {
        expect(formatQualityLabel(level(0, 1080))).toBe('1080p');
        expect(formatQualityLabel(level(0, 720))).toBe('720p');
    });

    it('falls back to bitrate when the height is unknown', () => {
        expect(formatQualityLabel(level(0, null, 1_500_000))).toBe('1500 kbps');
        expect(formatQualityLabel(level(0, null, null))).toBe('Unknown');
    });
});

describe('sortQualityLevelsDescending', () => {
    it('orders by height, then bitrate', () => {
        const sorted = sortQualityLevelsDescending([
            level(0, 1080, 4_000_000),
            level(1, 2160, 16_000_000),
            level(2, 1080, 6_000_000),
        ]);
        expect(sorted.map((entry) => entry.id)).toEqual([1, 2, 0]);
    });

    it('does not mutate the input', () => {
        const input = [level(0, 720), level(1, 1080)];
        sortQualityLevelsDescending(input);
        expect(input.map((entry) => entry.id)).toEqual([0, 1]);
    });
});

describe('pickPreferredQualityId', () => {
    it('picks the 4K rendition for the 4K preference', () => {
        expect(pickPreferredQualityId(LADDER, '2160p')).toBe(3);
    });

    it('picks the 1080p rendition for the 1080p preference', () => {
        expect(pickPreferredQualityId(LADDER, '1080p')).toBe(2);
    });

    it('falls back to the highest available below the target', () => {
        const withoutUhd = LADDER.slice(0, 3);
        expect(pickPreferredQualityId(withoutUhd, '2160p')).toBe(2);
        expect(pickPreferredQualityId(LADDER.slice(0, 2), '2160p')).toBe(1);
    });

    it('never exceeds the 1080p target when a 4K rendition exists', () => {
        expect(pickPreferredQualityId(LADDER, '1080p')).not.toBe(3);
    });

    it('takes the smallest rendition when every one exceeds the target', () => {
        const uhdOnly = [level(0, 4320, 40_000_000), level(1, 2160)];
        expect(pickPreferredQualityId(uhdOnly, '1080p')).toBe(1);
    });

    it('stays adaptive for the auto preference and for unmeasured ladders', () => {
        expect(pickPreferredQualityId(LADDER, 'auto')).toBe(AUTO_QUALITY_ID);
        expect(
            pickPreferredQualityId([level(0, null), level(1, 0)], '2160p')
        ).toBe(AUTO_QUALITY_ID);
    });
});

describe('buildQualityTracks', () => {
    it('leads with the adaptive entry and lists renditions highest first', () => {
        const tracks = buildQualityTracks({
            levels: LADDER,
            activeId: 3,
            autoEnabled: false,
        });

        expect(tracks.map((track) => track.label)).toEqual([
            '',
            '2160p (4K)',
            '1080p',
            '720p',
            '480p',
        ]);
        expect(tracks.find((track) => track.selected)?.id).toBe(3);
    });

    it('labels the adaptive entry with the rendition it settled on', () => {
        const tracks = buildQualityTracks({
            levels: LADDER,
            activeId: 2,
            autoEnabled: true,
        });

        expect(tracks[0]).toEqual({
            id: AUTO_QUALITY_ID,
            label: '1080p',
            selected: true,
        });
        expect(tracks.filter((track) => track.selected)).toHaveLength(1);
    });

    it('leaves the adaptive label empty while nothing is playing yet', () => {
        const tracks = buildQualityTracks({
            levels: LADDER,
            activeId: AUTO_QUALITY_ID,
            autoEnabled: true,
        });

        expect(tracks[0].label).toBe('');
    });
});
