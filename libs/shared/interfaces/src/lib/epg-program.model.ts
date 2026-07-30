/**
 * EPG Program interface - flat structure matching database storage
 */
export interface EpgProgram {
    start: string; // ISO string
    stop: string; // ISO string
    channel: string;
    title: string;
    desc: string | null;
    category: string | null;
    startTimestamp?: number | null;
    stopTimestamp?: number | null;
    date?: string;
    episodeNum?: string | null;
    iconUrl?: string | null;
    rating?: string | null;
    /** Stable source identifiers when the XMLTV provider supplies them. */
    programId?: string | null;
    seriesId?: string | null;
    /** Series and episode titles are kept separate when XMLTV sub-title exists. */
    seriesTitle?: string | null;
    episodeTitle?: string | null;
    /** XMLTV new / previously-shown flags; absent means unknown. */
    isNew?: boolean | null;
    previouslyShown?: boolean | null;
}
