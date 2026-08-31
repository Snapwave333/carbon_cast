import { ChannelActions, PlaylistActions } from '@iptvnator/m3u-state';
import { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { createGroupedChannel } from './channel-list-container.test-channels';
import {
    ChannelListContainerHarness,
    createChannelListContainerHarness,
} from './channel-list-container.spec-helpers';

describe('ChannelListContainerComponent', () => {
    let harness: ChannelListContainerHarness;

    beforeEach(async () => {
        harness = await createChannelListContainerHarness();
    });

    it('does not clear the shared channel list on destroy', () => {
        harness.fixture.detectChanges();

        harness.fixture.destroy();

        expect(harness.dispatch).toHaveBeenCalledTimes(1);
        expect(harness.dispatch).toHaveBeenCalledWith(
            ChannelActions.resetActiveChannel()
        );
    });

    it('dispatches playlist meta updates when hidden group titles change', () => {
        harness.fixture.componentInstance.onHiddenGroupTitlesChanged([
            'Movies',
            'Sports',
        ]);

        expect(harness.dispatch).toHaveBeenCalledWith(
            PlaylistActions.updatePlaylistMeta({
                playlist: {
                    _id: 'playlist-1',
                    hiddenGroupTitles: ['Movies', 'Sports'],
                } as PlaylistMeta,
            })
        );
    });

    it('merges category variants and expands multi-group channels into canonical buckets', () => {
        harness.fixture.detectChanges();
        harness.fixture.componentInstance.channelList = [
            createGroupedChannel('a', 'a-url', 'Animation'),
            createGroupedChannel('b', 'b-url', 'ANIMATION'),
            createGroupedChannel('c', 'c-url', ' Animation '),
            createGroupedChannel('d', 'd-url', 'Anime'),
            createGroupedChannel('e', 'e-url', 'Animation;Kids'),
        ];

        const groups = harness.fixture.componentInstance.groupedChannels();
        const animation = groups.find((group) => group.key === 'animation');
        const kids = groups.find((group) => group.key === 'kids');

        expect(groups.map((group) => group.key)).toEqual(['animation', 'kids']);
        expect(animation?.label).toBe('Animation');
        expect(animation?.channels.map((channel) => channel.id)).toEqual([
            'a',
            'b',
            'c',
            'd',
            'e',
        ]);
        expect(kids?.channels.map((channel) => channel.id)).toEqual(['e']);
    });

    it('hides explicitly non-U.S. channels by default while keeping U.S. and unknown metadata visible', () => {
        harness.fixture.detectChanges();
        const us = createGroupedChannel('us', 'us-url', 'News');
        const international = createGroupedChannel(
            'international',
            'international-url',
            'News'
        );
        const unknown = createGroupedChannel('unknown', 'unknown-url', 'News');
        us.tvg.id = 'Example.us@SD';
        international.tvg.id = 'Example.ca@SD';
        unknown.tvg.id = 'ExampleChannel';

        harness.fixture.componentInstance.channelList = [
            us,
            international,
            unknown,
        ];

        expect(
            harness.fixture.componentInstance
                .displayedChannels()
                .map((channel) => channel.id)
        ).toEqual(['us', 'unknown']);

        harness.settings.hideNonUsChannels.set(false);

        expect(
            harness.fixture.componentInstance
                .displayedChannels()
                .map((channel) => channel.id)
        ).toEqual(['us', 'international', 'unknown']);
    });
});
