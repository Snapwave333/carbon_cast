/**
 * Translates a groups-rail width into the total sidebar width the host should
 * request, by measuring the channel panel next to it.
 *
 * The measurement is deliberately layered: the panel can be mid-transition
 * (zero-width rect), display-swapped, or not yet laid out, and each fallback
 * covers one of those states. Without it the rail resize collapses the channel
 * panel, because a request of 0 is emitted as the true width.
 */
export class GroupsNavResizeController {
    private preservedContentWidth = 0;

    constructor(
        private readonly host: HTMLElement,
        private readonly sidebarWidth: () => number | null
    ) {}

    /** Snapshot the panel before the drag starts changing the layout. */
    start(): void {
        this.preservedContentWidth = this.measureContentPanelWidth();
    }

    end(): void {
        this.preservedContentWidth = 0;
    }

    /** Total sidebar width for a given rail width, or 0 when unmeasurable. */
    requestedWidthFor(navWidth: number): number {
        const contentWidth =
            this.preservedContentWidth ||
            this.measureContentPanelWidth(navWidth);
        return Math.max(0, Math.round(navWidth + contentWidth));
    }

    private measureContentPanelWidth(currentNavWidth?: number): number {
        const contentPanel = this.host.querySelector('.groups-content-panel');
        const measuredContentWidth = this.readWidth(contentPanel);
        if (measuredContentWidth > 0) {
            return measuredContentWidth;
        }

        const hostWidth = this.readWidth(this.host);
        const totalWidth =
            hostWidth > 0 ? hostWidth : Math.max(0, this.sidebarWidth() ?? 0);
        const navPanel = this.host.querySelector('.groups-nav-panel');
        const navWidth = currentNavWidth ?? this.readWidth(navPanel);

        if (totalWidth > 0 && navWidth > 0) {
            return Math.max(0, totalWidth - navWidth);
        }

        return 0;
    }

    private readWidth(element: Element | null): number {
        if (!element) {
            return 0;
        }

        const rectWidth = element.getBoundingClientRect().width;
        if (rectWidth > 0) {
            return rectWidth;
        }

        if (!(element instanceof HTMLElement)) {
            return 0;
        }

        if (element.offsetWidth > 0) {
            return element.offsetWidth;
        }

        const inlineWidth = Number.parseFloat(element.style.width);
        if (Number.isFinite(inlineWidth) && inlineWidth > 0) {
            return inlineWidth;
        }

        const computedWidth = Number.parseFloat(
            window.getComputedStyle(element).width
        );
        if (Number.isFinite(computedWidth) && computedWidth > 0) {
            return computedWidth;
        }

        return 0;
    }
}
