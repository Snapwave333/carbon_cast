import {
    parseXmltvDate,
    StreamingEpgParser,
    type ParsedChannel,
    type ParsedProgram,
} from './epg-streaming-parser';

describe('parseXmltvDate', () => {
    it('normalizes XMLTV timestamps with timezone offsets', () => {
        expect(parseXmltvDate('20260415053700 +0000')).toBe(
            '2026-04-15T05:37:00.000Z'
        );
    });

    it('converts positive offsets to UTC', () => {
        expect(parseXmltvDate('20260415053700 +0200')).toBe(
            '2026-04-15T03:37:00.000Z'
        );
    });

    it('converts negative offsets to UTC', () => {
        expect(parseXmltvDate('20260415053700 -0530')).toBe(
            '2026-04-15T11:07:00.000Z'
        );
    });

    it('keeps the minutes component of zero-hour offsets', () => {
        expect(parseXmltvDate('20260415053700 +0030')).toBe(
            '2026-04-15T05:07:00.000Z'
        );
        expect(parseXmltvDate('20260415053700 -0030')).toBe(
            '2026-04-15T06:07:00.000Z'
        );
    });

    it('handles half-hour and 45-minute offsets', () => {
        expect(parseXmltvDate('20260415053700 +0545')).toBe(
            '2026-04-14T23:52:00.000Z'
        );
    });

    it('treats offset-less timestamps as UTC', () => {
        expect(parseXmltvDate('20260415053700')).toBe('2026-04-15T05:37:00Z');
    });
});

describe('StreamingEpgParser', () => {
    it('preserves stable series and episode metadata from XMLTV', () => {
        const batches: ParsedProgram[][] = [];
        const parser = new StreamingEpgParser(
            () => undefined,
            (programs) => batches.push(programs),
            () => undefined
        );

        parser.write(
            '<tv><programme id="program-7" series-id="series-2" start="20260415053700 +0000" stop="20260415062100 +0000" channel="channel-1"><title>The Show</title><sub-title>The Return</sub-title><series-id>series-2</series-id><programme-id>program-7</programme-id><new/></programme></tv>'
        );
        parser.finish();

        expect(batches.flat()[0]).toEqual(
            expect.objectContaining({
                programId: 'program-7',
                seriesId: 'series-2',
                subTitle: [{ lang: '', value: 'The Return' }],
                isNew: true,
                previouslyShown: false,
            })
        );
    });

    it('marks previously shown episodes as repeats', () => {
        const batches: ParsedProgram[][] = [];
        const parser = new StreamingEpgParser(
            () => undefined,
            (programs) => batches.push(programs),
            () => undefined
        );
        parser.write(
            '<tv><programme start="20260415053700 +0000" stop="20260415062100 +0000" channel="channel-1"><title>The Show</title><previously-shown/></programme></tv>'
        );
        parser.finish();

        expect(batches.flat()[0].previouslyShown).toBe(true);
    });

    it('flushes pending channels before the first programme batch', () => {
        const callbackOrder: string[] = [];
        const channelIdsByBatch: string[][] = [];
        const programmeChannelsByBatch: string[][] = [];

        const parser = new StreamingEpgParser(
            (channels: ParsedChannel[]) => {
                callbackOrder.push('channels');
                channelIdsByBatch.push(channels.map((channel) => channel.id));
            },
            (programs: ParsedProgram[]) => {
                callbackOrder.push('programs');
                programmeChannelsByBatch.push(
                    programs.map((program) => program.channel)
                );
            },
            () => undefined
        );

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<tv>',
            ...Array.from({ length: 101 }, (_, index) => {
                const id = `channel-${index + 1}`;
                return `<channel id="${id}"><display-name>${id}</display-name></channel>`;
            }),
            '<programme start="20260415053700 +0000" stop="20260415062100 +0000" channel="channel-101"><title>Late channel</title></programme>',
            '</tv>',
        ].join('');

        parser.write(xml);
        parser.finish();

        expect(callbackOrder).toEqual(['channels', 'channels', 'programs']);
        expect(channelIdsByBatch).toEqual([
            Array.from({ length: 100 }, (_, index) => `channel-${index + 1}`),
            ['channel-101'],
        ]);
        expect(programmeChannelsByBatch).toEqual([['channel-101']]);
    });
});
