jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
}));

jest.mock('../util/validated-axios', () => ({
    requestWithValidatedRedirects: jest.fn(),
}));

import { requestWithValidatedRedirects } from '../util/validated-axios';
import { fetchRemoteText } from './remote-text.events';

const request = requestWithValidatedRedirects as jest.MockedFunction<
    typeof requestWithValidatedRedirects
>;

describe('fetchRemoteText', () => {
    beforeEach(() => {
        request.mockReset();
        request.mockResolvedValue({
            data: '<rss/>',
        } as Awaited<ReturnType<typeof requestWithValidatedRedirects>>);
    });

    it('returns the document body', async () => {
        await expect(fetchRemoteText('https://feeds.example/show.rss')).resolves.toBe(
            '<rss/>'
        );
    });

    it('requests the trimmed URL as plain text with the SSRF guard on', async () => {
        await fetchRemoteText('  https://feeds.example/show.rss  ');

        const [url, config, policy] = request.mock.calls[0];
        expect(url).toBe('https://feeds.example/show.rss');
        expect(config).toMatchObject({
            method: 'GET',
            responseType: 'text',
        });
        expect(policy).toEqual({ allowPrivateNetworks: false });
    });

    it('caps the response size', async () => {
        await fetchRemoteText('https://feeds.example/show.rss');

        const [, config] = request.mock.calls[0];
        expect(config?.maxContentLength).toBe(12 * 1024 * 1024);
        expect(config?.maxBodyLength).toBe(12 * 1024 * 1024);
    });

    it('does not forward renderer-supplied headers', async () => {
        await fetchRemoteText('https://feeds.example/show.rss');

        const [, config] = request.mock.calls[0];
        expect(Object.keys(config?.headers ?? {})).toEqual(['Accept']);
    });

    it.each(['', '   ', null, undefined, 42])(
        'rejects %p as a URL',
        async (value) => {
            await expect(
                fetchRemoteText(value as unknown as string)
            ).rejects.toThrow('A URL is required');
            expect(request).not.toHaveBeenCalled();
        }
    );

    it('stringifies a non-string body', async () => {
        request.mockResolvedValue({ data: 123 } as unknown as Awaited<
            ReturnType<typeof requestWithValidatedRedirects>
        >);

        await expect(
            fetchRemoteText('https://feeds.example/show.rss')
        ).resolves.toBe('123');
    });

    it('propagates a rejected URL', async () => {
        request.mockRejectedValue(
            new Error('URL points to a private or local network address')
        );

        await expect(fetchRemoteText('http://127.0.0.1/feed')).rejects.toThrow(
            'private or local network address'
        );
    });
});
