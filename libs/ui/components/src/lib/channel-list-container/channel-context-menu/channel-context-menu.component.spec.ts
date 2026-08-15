import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { EpgRuntimeBridgeService } from '@iptvnator/epg/data-access';
import { Channel } from '@iptvnator/shared/interfaces';
import { ChannelDetailsDialogComponent } from '../channel-details-dialog/channel-details-dialog.component';
import { ChannelContextMenuComponent } from './channel-context-menu.component';

const channel = {
    id: 'channel-1',
    name: 'News One',
    url: 'https://example.com/news.m3u8',
    tvg: { id: 'news-1', name: 'News One', logo: '', rec: '', url: '' },
} as Channel;

/** The menu keeps its handlers protected; tests drive them as the template does. */
interface ChannelContextMenuTestApi {
    position(): { x: string; y: string };
    openChannelDetails(): void;
    openEpgMapping(): void;
}

describe('ChannelContextMenuComponent', () => {
    let fixture: ComponentFixture<ChannelContextMenuComponent>;
    let component: ChannelContextMenuComponent;
    let dialog: { open: jest.Mock };

    const api = () => component as unknown as ChannelContextMenuTestApi;

    beforeEach(async () => {
        dialog = { open: jest.fn() };

        await TestBed.configureTestingModule({
            imports: [
                ChannelContextMenuComponent,
                NoopAnimationsModule,
                TranslateModule.forRoot(),
            ],
            providers: [
                { provide: MatDialog, useValue: dialog },
                {
                    provide: EpgRuntimeBridgeService,
                    useValue: { supportsEpgMapping: true },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ChannelContextMenuComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('anchors the menu at the pointer and opens it', async () => {
        component.open(channel, {
            clientX: 144,
            clientY: 188,
        } as MouseEvent);
        await Promise.resolve();

        expect(api().position()).toEqual({ x: '144px', y: '188px' });
    });

    it('opens the details dialog for the channel the menu was opened on', async () => {
        component.open(channel, { clientX: 0, clientY: 0 } as MouseEvent);
        await Promise.resolve();

        api().openChannelDetails();

        expect(dialog.open).toHaveBeenCalledWith(
            ChannelDetailsDialogComponent,
            expect.objectContaining({
                data: channel,
                maxWidth: '720px',
                width: 'calc(100vw - 32px)',
            })
        );
    });

    it('does nothing until a channel has been set', () => {
        api().openChannelDetails();
        api().openEpgMapping();

        expect(dialog.open).not.toHaveBeenCalled();
    });
});
