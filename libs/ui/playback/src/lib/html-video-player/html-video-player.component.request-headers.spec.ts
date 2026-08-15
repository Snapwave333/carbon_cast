import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { DataService } from '@iptvnator/services';
import { Channel } from '@iptvnator/shared/interfaces';
import { HtmlVideoPlayerComponent } from './html-video-player.component';

describe('HtmlVideoPlayerComponent request headers', () => {
    let component: HtmlVideoPlayerComponent;
    let fixture: ComponentFixture<HtmlVideoPlayerComponent>;
    const electronApi = {
        setUserAgent: jest.fn().mockResolvedValue(true),
    };

    const TEST_CHANNEL: Channel = {
        id: '1234',
        url: 'http://test.ts',
        name: 'Test channel',
        group: {
            title: 'News group',
        },
        http: {
            origin: '',
            referrer: '',
            'user-agent': 'localhost',
        },
        radio: 'false',
        tvg: {
            id: '',
            logo: '',
            name: '',
            rec: '',
            url: '',
        },
    };

    beforeEach(waitForAsync(() => {
        const dataServiceMock = {
            sendIpcEvent: jest.fn().mockResolvedValue(undefined),
        };

        TestBed.configureTestingModule({
            imports: [HtmlVideoPlayerComponent, TranslateModule.forRoot()],
            providers: [{ provide: DataService, useValue: dataServiceMock }],
        }).compileComponents();
    }));

    beforeEach(() => {
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: electronApi,
        });
        electronApi.setUserAgent.mockReset();
        electronApi.setUserAgent.mockResolvedValue(true);
        fixture = TestBed.createComponent(HtmlVideoPlayerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        delete (window as unknown as { electron?: unknown }).electron;
        jest.restoreAllMocks();
    });

    it('passes channel headers and stream URL to Electron header overrides', async () => {
        jest.spyOn(
            component.videoPlayer.nativeElement,
            'load'
        ).mockImplementation(() => undefined);
        jest.spyOn(
            component.videoPlayer.nativeElement,
            'play'
        ).mockResolvedValue(undefined);

        await component.playChannel({
            ...TEST_CHANNEL,
            http: {
                'user-agent': 'ChannelAgent/1.0',
                origin: '',
                referrer: 'https://portal.example/referrer',
            },
            radio: 'false',
            url: 'https://stream.example/video.mp4',
        });

        expect(electronApi.setUserAgent).toHaveBeenCalledWith(
            'ChannelAgent/1.0',
            'https://portal.example/referrer',
            'https://stream.example/video.mp4'
        );
    });

    it('clears Electron header overrides for channels without custom headers', async () => {
        jest.spyOn(
            component.videoPlayer.nativeElement,
            'load'
        ).mockImplementation(() => undefined);
        jest.spyOn(
            component.videoPlayer.nativeElement,
            'play'
        ).mockResolvedValue(undefined);

        await component.playChannel({
            ...TEST_CHANNEL,
            http: {
                'user-agent': '',
                origin: '',
                referrer: '',
            },
            radio: 'false',
            url: 'https://stream.example/video.mp4',
        });

        expect(electronApi.setUserAgent).toHaveBeenCalledWith(
            '',
            '',
            'https://stream.example/video.mp4'
        );
    });

    it('configures request headers before the source engine requests anything', async () => {
        const video = component.videoPlayer.nativeElement;
        jest.spyOn(video, 'play').mockResolvedValue(undefined);
        const order: string[] = [];
        let resolveHeaders!: (value: boolean) => void;
        electronApi.setUserAgent.mockImplementationOnce(() => {
            order.push('setUserAgent');
            return new Promise<boolean>((resolve) => {
                resolveHeaders = resolve;
            });
        });
        jest.spyOn(video, 'load').mockImplementation(() => {
            order.push('load');
        });

        const playing = component.playChannel({
            ...TEST_CHANNEL,
            url: 'https://stream.example/video.mp4',
        });

        // The engine must still be waiting on the header IPC: starting it here
        // would send the first request with the default user-agent.
        expect(order).toEqual(['setUserAgent']);

        resolveHeaders(true);
        await playing;

        expect(order).toEqual(['setUserAgent', 'load']);
    });

    it('starts playback anyway when the header IPC never settles', async () => {
        jest.useFakeTimers();
        const video = component.videoPlayer.nativeElement;
        jest.spyOn(video, 'play').mockResolvedValue(undefined);
        const load = jest
            .spyOn(video, 'load')
            .mockImplementation(() => undefined);
        // A wedged main process: the invoke never resolves or rejects.
        electronApi.setUserAgent.mockImplementationOnce(
            () => new Promise<boolean>(() => undefined)
        );

        const playing = component.playChannel({
            ...TEST_CHANNEL,
            url: 'https://stream.example/video.mp4',
        });

        expect(load).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(3000);
        await playing;

        expect(load).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('ignores a superseded channel that was still awaiting its headers', async () => {
        const video = component.videoPlayer.nativeElement;
        jest.spyOn(video, 'play').mockResolvedValue(undefined);
        jest.spyOn(video, 'load').mockImplementation(() => undefined);
        let resolveStale!: (value: boolean) => void;
        electronApi.setUserAgent.mockImplementationOnce(
            () =>
                new Promise<boolean>((resolve) => {
                    resolveStale = resolve;
                })
        );

        const stale = component.playChannel({
            ...TEST_CHANNEL,
            url: 'https://stream.example/stale.mp4',
        });
        await component.playChannel({
            ...TEST_CHANNEL,
            url: 'https://stream.example/current.mp4',
        });
        resolveStale(true);
        await stale;

        const sources = Array.from(video.querySelectorAll('source'));
        expect(sources).toHaveLength(1);
        expect(sources[0].getAttribute('src')).toBe(
            'https://stream.example/current.mp4'
        );
    });
});
