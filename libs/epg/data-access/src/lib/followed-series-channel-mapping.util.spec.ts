import { probeFollowedSeriesStream } from './followed-series-channel-mapping.util';

describe('probeFollowedSeriesStream', () => {
    it('uses a bounded two-attempt retry policy', async () => {
        const probe = jest.fn().mockRejectedValue(new Error('offline'));

        await expect(
            probeFollowedSeriesStream('https://example.com/live.m3u8', probe)
        ).resolves.toBe(false);
        expect(probe).toHaveBeenCalledTimes(2);
    });

    it('accepts the first successful HTTP response and rejects unsafe URLs', async () => {
        const probe = jest.fn().mockResolvedValue({ status: 204 });

        await expect(
            probeFollowedSeriesStream('https://example.com/live.m3u8', probe)
        ).resolves.toBe(true);
        await expect(
            probeFollowedSeriesStream('javascript:alert(1)', probe)
        ).resolves.toBe(false);
        expect(probe).toHaveBeenCalledTimes(1);
    });
});
