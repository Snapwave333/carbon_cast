/**
 * Row heights the virtual-scroll viewports report to the CDK.
 *
 * These must stay in step with `.channel-list-item` and its `.compact`
 * variant in `channel-list-item/channel-list-item.component.scss`. The CDK
 * multiplies the value by the item count to size the scrollable area, so a
 * value that is even a few pixels short compounds across a 90,000-channel
 * playlist into a scrollbar that cannot reach the end of the list.
 */
export const CHANNEL_ROW_HEIGHT_PX = 68;
export const CHANNEL_ROW_COMPACT_HEIGHT_PX = 52;
