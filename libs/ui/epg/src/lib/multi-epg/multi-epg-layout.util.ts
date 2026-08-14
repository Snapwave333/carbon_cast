import { addDays, format, isValid, parse } from 'date-fns';
import {
    ElectronBridgeEpgChannelWithPrograms,
    EpgChannel,
    EpgProgram,
} from '@iptvnator/shared/interfaces';
import {
    formatEpisodeBadge,
    getEpgCategoryAccent,
    getProgramArtworkUrl,
} from '../epg-program.utils';
import { formatClockTime } from '../epg-timeline/epg-summary.util';

export interface MultiEpgLayoutProgram extends EpgProgram {
    startDate: Date;
    stopDate: Date;
    startPosition: number;
    width: number;
    /** Pre-formatted "HH:mm – HH:mm" of the original (unclipped) times. */
    timeLabel: string;
    /** Compact "S2 E13" badge parsed from XMLTV episode-num, if any. */
    episodeBadge: string | null;
    /** Category accent colour for colour-coding the cell, if any. */
    categoryAccent: string | null;
}

export interface MultiEpgLayoutChannel extends ElectronBridgeEpgChannelWithPrograms {
    programs: MultiEpgLayoutProgram[];
    /** Channel icon passed through the http(s) guard once per layout, so
     * cells don't re-sanitize it on every change-detection pass. */
    safeIconUrl: string;
}

export function isSelectedEpgDayToday(
    selectedDay: string,
    now: Date = new Date()
): boolean {
    return selectedDay === format(now, 'yyyyMMdd');
}

export function layoutEpgChannelsForDay(
    channels: ElectronBridgeEpgChannelWithPrograms[],
    selectedDay: string,
    hourWidth: number,
    dateCache: Map<string, Date> = new Map()
): MultiEpgLayoutChannel[] {
    const dayStart = parse(selectedDay, 'yyyyMMdd', new Date());
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);

    return channels.map((channel) => ({
        ...channel,
        safeIconUrl: getEpgChannelIcon(channel),
        programs: (channel.programs ?? [])
            .map((program) =>
                layoutProgram(program, dayStart, dayEnd, hourWidth, dateCache)
            )
            .filter(
                (program): program is MultiEpgLayoutProgram => program !== null
            ),
    }));
}

export function getEpgChannelName(
    channel: EpgChannel | ElectronBridgeEpgChannelWithPrograms
): string {
    if (typeof channel.displayName === 'string') return channel.displayName;
    return channel.displayName?.[0]?.value ?? '';
}

export function getEpgChannelIcon(
    channel: EpgChannel | ElectronBridgeEpgChannelWithPrograms
): string {
    const iconUrl =
        'iconUrl' in channel && channel.iconUrl
            ? channel.iconUrl
            : 'icon' in channel
              ? (channel.icon?.[0]?.src ?? '')
              : '';
    // Channel icons come from the same untrusted XMLTV feed as programme
    // artwork — apply the same http(s)-only guard before rendering.
    return getProgramArtworkUrl({ iconUrl }) ?? '';
}

export function buildProgramAriaLabel(program: MultiEpgLayoutProgram): string {
    const start = formatClockTime(program.startDate.getTime());
    const stop = formatClockTime(program.stopDate.getTime());
    return `${program.title}, ${start}–${stop}`;
}

function layoutProgram(
    program: EpgProgram,
    dayStart: Date,
    dayEnd: Date,
    hourWidth: number,
    dateCache: Map<string, Date>
): MultiEpgLayoutProgram | null {
    const startDate = getCachedDate(program.start, dateCache);
    const stopDate = getCachedDate(program.stop, dateCache);
    if (
        !isValid(startDate) ||
        !isValid(stopDate) ||
        stopDate <= startDate ||
        stopDate <= dayStart ||
        startDate >= dayEnd
    ) {
        return null;
    }

    const visibleStart = startDate < dayStart ? dayStart : startDate;
    const visibleStop = stopDate > dayEnd ? dayEnd : stopDate;
    const startMinutes = wallClockMinutes(visibleStart, dayStart, dayEnd);
    const stopMinutes = wallClockMinutes(visibleStop, dayStart, dayEnd);

    return {
        ...program,
        startDate,
        stopDate,
        startPosition: (startMinutes * hourWidth) / 60,
        width: Math.max(1, ((stopMinutes - startMinutes) * hourWidth) / 60),
        timeLabel: `${formatClockTime(startDate.getTime())} – ${formatClockTime(
            stopDate.getTime()
        )}`,
        episodeBadge: formatEpisodeBadge(program.episodeNum),
        categoryAccent: getEpgCategoryAccent(program.category),
    };
}

function getCachedDate(value: string, cache: Map<string, Date>): Date {
    let date = cache.get(value);
    if (!date) {
        date = new Date(value);
        cache.set(value, date);
    }
    return date;
}

function wallClockMinutes(value: Date, dayStart: Date, dayEnd: Date): number {
    if (value <= dayStart) return 0;
    if (value >= dayEnd) return 24 * 60;
    return value.getHours() * 60 + value.getMinutes();
}
