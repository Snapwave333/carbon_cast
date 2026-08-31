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
    /**
     * Whether the open playlist actually contains this channel. The guide
     * lists EPG-store channels, which are not scoped to the playlist, so a
     * row can be pure metadata with nothing to tune to.
     */
    isPlayable: boolean;
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
    dateCache: Map<string, Date> = new Map(),
    /** Defaults to "everything is playable" so hosts that do not supply a
     * playlist (the standalone overlay) are unaffected. */
    isPlayable: (
        channel: ElectronBridgeEpgChannelWithPrograms
    ) => boolean = () => true
): MultiEpgLayoutChannel[] {
    const dayStart = parse(selectedDay, 'yyyyMMdd', new Date());
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = addDays(dayStart, 1);

    // A playlist-scoped guide must not surface source-only rows: they look
    // valid, but selecting one cannot tune anything. Hosts that do not supply
    // a resolver keep the default `true` behaviour and still see every row.
    return channels
        .map((channel) => ({
            ...channel,
            safeIconUrl: getEpgChannelIcon(channel),
            isPlayable: isPlayable(channel),
            programs: (channel.programs ?? [])
                .map((program) =>
                    layoutProgram(
                        program,
                        dayStart,
                        dayEnd,
                        hourWidth,
                        dateCache
                    )
                )
                .filter(
                    (program): program is MultiEpgLayoutProgram =>
                        program !== null
                ),
        }))
        .filter((channel) => channel.isPlayable)
        .sort(compareChannelsByGuideCategory);
}

const GUIDE_CATEGORY_COLLATOR = new Intl.Collator(undefined, {
    sensitivity: 'base',
    numeric: true,
});

/**
 * Keep related programming together in the guide. XMLTV does not expose a
 * channel-group field, so the first programme category for the selected day
 * is the reliable group signal. Channels without a category stay together at
 * the end, then names break ties predictably.
 */
function compareChannelsByGuideCategory(
    left: MultiEpgLayoutChannel,
    right: MultiEpgLayoutChannel
): number {
    const leftCategory = getGuideCategory(left) ?? '\uffff';
    const rightCategory = getGuideCategory(right) ?? '\uffff';
    const categoryComparison = GUIDE_CATEGORY_COLLATOR.compare(
        leftCategory,
        rightCategory
    );

    return categoryComparison !== 0
        ? categoryComparison
        : GUIDE_CATEGORY_COLLATOR.compare(
              getEpgChannelName(left),
              getEpgChannelName(right)
          );
}

function getGuideCategory(channel: MultiEpgLayoutChannel): string | null {
    return (
        channel.programs
            .find((program) => program.category?.trim())
            ?.category?.trim() ?? null
    );
}

/** The programme under the "now" playhead, in guide-layout coordinates. */
export function isProgramUnderPlayhead(
    program: MultiEpgLayoutProgram,
    playheadX: number,
    isToday: boolean
): boolean {
    if (!isToday) return false;
    return (
        playheadX >= program.startPosition &&
        playheadX <= program.startPosition + program.width
    );
}

/** Channel-column filter: case-insensitive substring on the display name. */
export function filterChannelsByName<T extends MultiEpgLayoutChannel>(
    channels: T[],
    query: string
): T[] {
    const filter = query.toLowerCase().trim();
    if (!filter) {
        return channels;
    }
    return channels.filter((channel) =>
        getEpgChannelName(channel).toLowerCase().includes(filter)
    );
}

/** Page size for the channel browser, clamped to a sane 10–20 rows. */
export function computeVisibleChannelCount(
    containerHeight: number,
    barHeight: number
): number {
    const fits = Math.floor((containerHeight - barHeight) / barHeight);
    return Math.max(10, Math.min(fits, 20));
}

/** Infinite scroll trigger: within 200px of the bottom. */
export function shouldLoadMoreOnScroll(target: HTMLElement): boolean {
    return target.scrollHeight - target.scrollTop - target.clientHeight < 200;
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

/**
 * Screen-reader label for a grid cell. The channel is included because the
 * grid conveys it only by row position, which assistive tech cannot see, and
 * "on now" because the visual cue for it is a colour treatment.
 */
export function buildProgramAriaLabel(
    program: MultiEpgLayoutProgram,
    channelName?: string,
    /** Already-translated "on now" wording, omitted when not airing. */
    nowLabel?: string
): string {
    const start = formatClockTime(program.startDate.getTime());
    const stop = formatClockTime(program.stopDate.getTime());
    const parts = [program.title, `${start}–${stop}`];

    if (channelName) {
        parts.splice(1, 0, channelName);
    }
    if (nowLabel) {
        parts.push(nowLabel);
    }

    return parts.join(', ');
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
