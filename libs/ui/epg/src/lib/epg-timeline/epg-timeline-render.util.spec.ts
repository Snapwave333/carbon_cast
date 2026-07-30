import { EpgProgram } from '@iptvnator/shared/interfaces';
import { TimelineBlock, TimelineWhen } from './epg-timeline.utils';
import {
    buildTimelineRenderItems,
    TimelineRenderBlock,
    TimelineRenderGroup,
    tierFor,
    timelineTickStepForScale,
    TIMELINE_BLOCK_GAP_PX,
    TIMELINE_MIN_BLOCK_WIDTH_PX,
} from './epg-timeline-render.util';

const MINUTE_MS = 60_000;

const PROGRAM: EpgProgram = {
    start: '2026-06-28T10:00:00.000Z',
    stop: '2026-06-28T11:00:00.000Z',
    channel: 'ch',
    title: 'P',
    desc: null,
    category: null,
};

function block(overrides: Partial<TimelineBlock> = {}): TimelineBlock {
    const startMs = overrides.startMs ?? 0;
    const durationMin = overrides.durationMin ?? 60;
    return {
        program: PROGRAM,
        key: overrides.key ?? `k-${startMs}`,
        startMs,
        stopMs: overrides.stopMs ?? startMs + durationMin * MINUTE_MS,
        when: (overrides.when ?? 'future') as TimelineWhen,
        offsetMin: overrides.offsetMin ?? 0,
        durationMin,
    };
}

function blocksOnly(items: ReturnType<typeof buildTimelineRenderItems>) {
    return items.filter(
        (item): item is TimelineRenderBlock => item.kind === 'block'
    );
}

describe('epg-timeline-render.util', () => {
    describe('tierFor', () => {
        it('selects a content tier from the rendered width', () => {
            expect(tierFor(132)).toBe('wide');
            expect(tierFor(131)).toBe('med');
            expect(tierFor(70)).toBe('med');
            expect(tierFor(69)).toBe('narrow');
            expect(tierFor(30)).toBe('narrow');
            expect(tierFor(29)).toBe('micro');
        });
    });

    describe('timelineTickStepForScale', () => {
        it('tightens tick spacing as the zoom increases', () => {
            expect(timelineTickStepForScale(2.19)).toBe(120);
            expect(timelineTickStepForScale(2.2)).toBe(60);
            expect(timelineTickStepForScale(3.49)).toBe(60);
            expect(timelineTickStepForScale(3.5)).toBe(30);
            expect(timelineTickStepForScale(4.99)).toBe(30);
            expect(timelineTickStepForScale(5)).toBe(15);
        });
    });

    describe('buildTimelineRenderItems positioning', () => {
        it('floors block width to the minimum minus the gap', () => {
            const items = blocksOnly(
                buildTimelineRenderItems([block({ durationMin: 1 })], 1)
            );
            expect(items).toHaveLength(1);
            expect(items[0].widthPx).toBe(
                TIMELINE_MIN_BLOCK_WIDTH_PX - TIMELINE_BLOCK_GAP_PX
            );
        });

        it('scales wide blocks by duration and derives the tier from raw width', () => {
            const items = blocksOnly(
                buildTimelineRenderItems([block({ durationMin: 200 })], 1)
            );
            expect(items[0].widthPx).toBe(200 - TIMELINE_BLOCK_GAP_PX);
            expect(items[0].tier).toBe('wide');
        });

        it('positions the block using its offset and the scale', () => {
            const items = blocksOnly(
                buildTimelineRenderItems(
                    [block({ offsetMin: 30, durationMin: 60 })],
                    2
                )
            );
            expect(items[0].leftPx).toBe(60);
        });
    });

    describe('buildTimelineRenderItems now-fill', () => {
        it('reports live progress for the on-air block', () => {
            const start = 1_000_000;
            const items = blocksOnly(
                buildTimelineRenderItems(
                    [
                        block({
                            when: 'now',
                            startMs: start,
                            stopMs: start + 60 * MINUTE_MS,
                            durationMin: 60,
                        }),
                    ],
                    1,
                    { nowMs: start + 30 * MINUTE_MS }
                )
            );
            expect(items[0].nowFillPercent).toBe(50);
        });

        it('clamps progress into the 0-100 range', () => {
            const start = 1_000_000;
            const past = blocksOnly(
                buildTimelineRenderItems(
                    [block({ when: 'now', startMs: start, durationMin: 60 })],
                    1,
                    { nowMs: start - MINUTE_MS }
                )
            );
            expect(past[0].nowFillPercent).toBe(0);

            const overrun = blocksOnly(
                buildTimelineRenderItems(
                    [block({ when: 'now', startMs: start, durationMin: 60 })],
                    1,
                    { nowMs: start + 999 * MINUTE_MS }
                )
            );
            expect(overrun[0].nowFillPercent).toBe(100);
        });

        it('is zero for non-live blocks and zero-length blocks', () => {
            const future = blocksOnly(
                buildTimelineRenderItems([block({ when: 'future' })], 1, {
                    nowMs: 0,
                })
            );
            expect(future[0].nowFillPercent).toBe(0);

            const zero = blocksOnly(
                buildTimelineRenderItems(
                    [block({ when: 'now', startMs: 5, stopMs: 5 })],
                    1,
                    { nowMs: 5 }
                )
            );
            expect(zero[0].nowFillPercent).toBe(0);
        });
    });

    describe('buildTimelineRenderItems catch-up', () => {
        it('marks past blocks catch-up-able when archive playback is available', () => {
            const items = blocksOnly(
                buildTimelineRenderItems([block({ when: 'past' })], 1, {
                    archivePlaybackAvailable: true,
                })
            );
            expect(items[0].canCatchUp).toBe(true);
        });

        it('is false without archive playback, for future blocks, or before the window', () => {
            const unavailable = blocksOnly(
                buildTimelineRenderItems([block({ when: 'past' })], 1, {
                    archivePlaybackAvailable: false,
                })
            );
            expect(unavailable[0].canCatchUp).toBe(false);

            const future = blocksOnly(
                buildTimelineRenderItems([block({ when: 'future' })], 1, {
                    archivePlaybackAvailable: true,
                })
            );
            expect(future[0].canCatchUp).toBe(false);

            const beforeWindow = blocksOnly(
                buildTimelineRenderItems(
                    [block({ when: 'past', startMs: 100 })],
                    1,
                    {
                        archivePlaybackAvailable: true,
                        archiveWindowStartMs: 500,
                    }
                )
            );
            expect(beforeWindow[0].canCatchUp).toBe(false);
        });
    });

    describe('buildTimelineRenderItems grouping', () => {
        const shorts = (count: number, when: TimelineWhen = 'future') =>
            Array.from({ length: count }, (_, index) =>
                block({
                    key: `s${index}`,
                    startMs: index * 5 * MINUTE_MS,
                    offsetMin: index * 5,
                    durationMin: 5,
                    when,
                })
            );

        it('does not group when grouping is disabled', () => {
            const items = buildTimelineRenderItems(shorts(5), 1, {
                allowGroup: false,
            });
            expect(items.every((item) => item.kind === 'block')).toBe(true);
        });

        it('collapses a run of four or more consecutive shorts into a group', () => {
            const items = buildTimelineRenderItems(shorts(4), 1, {
                allowGroup: true,
            });
            expect(items).toHaveLength(1);
            const group = items[0] as TimelineRenderGroup;
            expect(group.kind).toBe('group');
            expect(group.count).toBe(4);
            expect(group.key).toBe('group-s0-s3');
        });

        it('keeps short runs below the threshold as individual blocks', () => {
            const items = buildTimelineRenderItems(shorts(3), 1, {
                allowGroup: true,
            });
            expect(items).toHaveLength(3);
            expect(items.every((item) => item.kind === 'block')).toBe(true);
        });

        it('never folds the on-air block into a group', () => {
            const sequence = [
                ...shorts(3),
                block({
                    key: 'now',
                    startMs: 3 * 5 * MINUTE_MS,
                    offsetMin: 15,
                    durationMin: 5,
                    when: 'now',
                }),
            ];
            const items = buildTimelineRenderItems(sequence, 1, {
                allowGroup: true,
            });
            expect(items.every((item) => item.kind === 'block')).toBe(true);
            expect(items).toHaveLength(4);
        });
    });
});
