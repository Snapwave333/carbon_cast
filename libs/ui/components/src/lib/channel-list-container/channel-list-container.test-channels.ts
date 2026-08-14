import { Channel } from '@iptvnator/shared/interfaces';

export function createChannel(id: string, url: string): Channel {
    return {
        id,
        url,
        name: id,
        group: { title: 'Group' },
        tvg: {
            id,
            name: id,
            url: '',
            logo: '',
            rec: '',
        },
        http: {
            referrer: '',
            'user-agent': '',
            origin: '',
        },
        radio: 'false',
    };
}

export function createGroupedChannel(
    id: string,
    url: string,
    title: string
): Channel {
    return { ...createChannel(id, url), group: { title } };
}

export function createTrackedUrlChannel(
    id: string,
    url: string,
    onUrlRead: () => void
): Channel {
    const channel = createChannel(id, url);

    Object.defineProperty(channel, 'url', {
        configurable: true,
        enumerable: true,
        get: () => {
            onUrlRead();
            return url;
        },
    });

    return channel;
}
