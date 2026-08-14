import { Page } from '@playwright/test';
import {
    buildM3uContent,
    closeElectronApp,
    createMutableTextServer,
    expect,
    importM3uPlaylistFromUrl,
    launchElectronApp,
    openSettings,
    saveSettings,
    test,
} from './electron-test-fixtures';

const artSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#274690"/><circle cx="320" cy="180" r="90" fill="#f5d061"/></svg>`;

function formatXmltvDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate()),
        pad(date.getUTCHours()),
        pad(date.getUTCMinutes()),
        pad(date.getUTCSeconds()),
    ].join('');
}

/** A movie airing right now (90 min wide at default zoom → artwork cell). */
function buildGuideXmltv(artUrl: string): string {
    const start = new Date(Date.now() - 15 * 60 * 1000);
    const stop = new Date(Date.now() + 75 * 60 * 1000);

    return `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="guide-cinema">
    <display-name>Guide Cinema</display-name>
  </channel>
  <programme start="${formatXmltvDate(start)} +0000" stop="${formatXmltvDate(stop)} +0000" channel="guide-cinema">
    <title>Night Train Premiere</title>
    <desc>Multi-EPG guide artwork and playback smoke test.</desc>
    <category>Movie</category>
    <episode-num system="xmltv_ns">1.12.</episode-num>
    <icon src="${artUrl}"/>
  </programme>
</tv>
`;
}

test.describe('Electron multi-EPG guide', () => {
    test('@epg @electron renders artwork, episode badge and genre accent, plays live from the dialog, and honors the artwork toggle', async ({
        dataDir,
    }) => {
        const artServer = await createMutableTextServer(artSvg, {
            contentType: 'image/svg+xml',
            resourcePath: '/stills/night-train.svg',
        });
        const epgServer = await createMutableTextServer(
            buildGuideXmltv(artServer.resourceUrl),
            {
                contentType: 'application/xml; charset=utf-8',
                resourcePath: '/guide.xml',
            }
        );
        const playlistServer = await createMutableTextServer(
            buildM3uContent([
                {
                    name: 'Guide Cinema',
                    tvgId: 'guide-cinema',
                    url: 'https://example.com/live/guide-cinema.m3u8',
                },
            ]),
            {
                contentType: 'application/x-mpegurl; charset=utf-8',
                resourcePath: '/playlist.m3u',
            }
        );
        const app = await launchElectronApp(dataDir);

        try {
            // EPG first so the guide has rows on its very first render.
            await openSettings(app.mainWindow);
            await app.mainWindow
                .getByRole('button', { name: 'Add EPG source' })
                .click();
            await app.mainWindow
                .locator('.epg-source-row input')
                .first()
                .fill(epgServer.resourceUrl);
            await app.mainWindow
                .locator('.epg-source-row button')
                .first()
                .click();
            await expect
                .poll(() => getEpgChannelCount(app.mainWindow), {
                    timeout: 30000,
                })
                .toBeGreaterThan(0);

            // Importing navigates into the playlist; guide is the default section.
            await importM3uPlaylistFromUrl(
                app.mainWindow,
                playlistServer.resourceUrl
            );
            const guide = app.mainWindow.locator('app-multi-epg-container');
            await expect(guide).toBeVisible({ timeout: 20000 });

            // Artwork tier: programme still from the XMLTV icon.
            const art = guide.locator('.program-art').first();
            await expect(art).toBeVisible({ timeout: 20000 });
            await expect(art).toHaveAttribute('src', artServer.resourceUrl);

            // Episode badge parsed from zero-based xmltv_ns "1.12.".
            await expect(
                guide.locator('.program-episode').first()
            ).toHaveText('S2 E13');

            // Genre colour coding from the Movie category.
            await expect(
                guide.locator('.program-cell.has-accent').first()
            ).toBeVisible();

            // Click-through: dialog offers "Watch live" for the airing show.
            await guide.locator('g.program').first().click();
            const dialog = app.mainWindow.locator('mat-dialog-container');
            await expect(dialog).toBeVisible();
            await expect(dialog).toContainText('Night Train Premiere');
            await dialog
                .getByRole('button', { name: 'Watch live' })
                .click();
            await dialog.waitFor({ state: 'detached' });

            // Playback started: the guide highlights the now-active channel.
            await expect(
                guide.locator('#channels-column .channel.active')
            ).toBeVisible({ timeout: 20000 });

            // Toggle off guide artwork → text-only cells, titles intact.
            await openSettings(app.mainWindow);
            await app.mainWindow
                .locator(
                    'mat-checkbox[formcontrolname="guideArtwork"] input[type="checkbox"]'
                )
                .uncheck();
            await saveSettings(app.mainWindow);
            // Settings replaced the playlist route (and its contextual rail
            // links), so return via history.
            await app.mainWindow.goBack();
            await expect(
                app.mainWindow.locator('app-multi-epg-container')
            ).toBeVisible({ timeout: 20000 });
            await expect(
                app.mainWindow.locator('app-multi-epg-container .program-art')
            ).toHaveCount(0);
            await expect(
                app.mainWindow
                    .locator('app-multi-epg-container .program-title')
                    .first()
            ).toContainText('Night Train Premiere');
        } finally {
            await closeElectronApp(app);
            await playlistServer.close();
            await epgServer.close();
            await artServer.close();
        }
    });
});

async function getEpgChannelCount(page: Page): Promise<number> {
    return page.evaluate(async () => {
        const channels = await window.electron?.getEpgChannelsByRange?.(0, 20);
        return Array.isArray(channels) ? channels.length : 0;
    });
}
