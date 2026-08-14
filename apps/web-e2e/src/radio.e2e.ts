import { expect, test } from './fixtures';
import type { Page, Route } from '@playwright/test';

/**
 * E2E coverage for the Radio & podcasts section and the shell playback bar.
 *
 * Both catalogues are live third-party APIs (Radio Browser, iTunes), so every
 * request is intercepted with deterministic fixtures here. Radio Browser is a
 * pool of mirrors reached by discovering a server list first, so the handler
 * matches on the request path and ignores which host the client picked.
 */

const STATIONS = [
    station('uuid-jazz', 'Jazz FM', 'Germany', 'DE', 'jazz', 42),
    station('uuid-rock', 'Rock Antenne', 'Germany', 'DE', 'rock', 30),
    station('uuid-lofi', 'Lofi Beats', 'France', 'FR', 'lofi', 18),
];

function station(
    id: string,
    name: string,
    country: string,
    code: string,
    tag: string,
    votes: number
) {
    return {
        stationuuid: id,
        name,
        url_resolved: `https://stream.example/${id}`,
        homepage: 'https://example.com',
        favicon: '',
        tags: tag,
        country,
        countrycode: code,
        language: 'english',
        codec: 'MP3',
        bitrate: 128,
        votes,
        clickcount: votes,
        hls: 0,
        lastcheckok: 1,
    };
}

const PODCAST = {
    collectionId: 111,
    collectionName: 'Deep Dive',
    artistName: 'Example Media',
    feedUrl: 'https://feeds.example/deep-dive.rss',
    artworkUrl600: '',
    genres: ['Technology'],
    trackCount: 12,
    collectionViewUrl: 'https://podcasts.apple.com/deep-dive',
};

function json(route: Route, body: unknown) {
    return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
    });
}

async function mockRadioApis(page: Page): Promise<void> {
    await page.route(/radio-browser\.info/, (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/json/servers')) {
            return json(route, [{ name: 'de1.api.radio-browser.info' }]);
        }
        if (path.includes('/json/stations/')) {
            return json(route, STATIONS);
        }
        if (path.endsWith('/json/countries')) {
            return json(route, [
                { name: 'Germany', iso_3166_1: 'DE', stationcount: 2 },
                { name: 'France', iso_3166_1: 'FR', stationcount: 1 },
            ]);
        }
        if (path.endsWith('/json/languages')) {
            return json(route, [{ name: 'english', stationcount: 3 }]);
        }
        if (path.includes('/json/tags')) {
            return json(route, [
                { name: 'jazz', stationcount: 40 },
                { name: 'rock', stationcount: 30 },
            ]);
        }
        // Click-report and anything else: an empty, harmless payload.
        return json(route, {});
    });

    await page.route(/itunes\.apple\.com/, (route) => {
        const url = route.request().url();
        if (url.includes('/rss/toppodcasts/')) {
            return json(route, {
                feed: { entry: [{ id: { attributes: { 'im:id': '111' } } }] },
            });
        }
        // search + lookup both return the collection list shape.
        return json(route, { results: [PODCAST] });
    });
}

test.beforeEach(async ({ page }) => {
    await mockRadioApis(page);
});

/**
 * Opens the radio browser and waits for the station grid to render. The route
 * is lazily compiled by the dev server, so a cold first load can outrun a
 * default assertion timeout; gating on the grid keeps the tests deterministic.
 */
async function openRadio(page: Page): Promise<void> {
    await page.goto('/workspace/radio');
    await expect(page.locator('.station-card').first()).toBeVisible({
        timeout: 20_000,
    });
}

test('@web @radio reaches the section from the workspace rail and lists stations', async ({
    page,
}) => {
    await page.goto('/');
    // The workspace shell boots after the settings resolver; wait for the rail
    // itself before hunting for a link inside it.
    await expect(page.locator('.app-rail')).toBeVisible({ timeout: 20_000 });

    // The rail carries a "Radio & podcasts" destination. A loose /radio/i once
    // collided with the Stalker portal's Radio section; the exact name guards
    // that this entry alone opens the browser.
    await page.getByRole('link', { name: 'Radio & podcasts' }).click();
    await page.waitForURL(/\/workspace\/radio$/);

    await expect(
        page.getByRole('heading', { name: /Top stations/i })
    ).toBeVisible();
    await expect(page.locator('.station-card')).toHaveCount(3);
    await expect(page.getByText('Jazz FM')).toBeVisible();
});

test('@web @radio plays a station into the shell bar and it survives navigation', async ({
    page,
}) => {
    await openRadio(page);

    await page
        .locator('.station-card', { hasText: 'Jazz FM' })
        .locator('.station-card__main')
        .click();

    // The bar is rendered by the shell, not the page.
    const bar = page.locator('app-workspace-playback-bar .playback-bar');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.radio-player__title')).toHaveText('Jazz FM');

    // Router navigation (not a reload) must not stop playback: the same bar
    // stays mounted because it lives above the router outlet.
    await page.locator('a[href="/workspace/sources"]').first().click();
    await page.waitForURL(/\/workspace\/sources$/);
    await expect(page.locator('app-radio')).toHaveCount(0);
    await expect(bar).toBeVisible();
    await expect(bar.locator('.radio-player__title')).toHaveText('Jazz FM');
});

test('@web @radio cycles the playback bar through its three sizes', async ({
    page,
}) => {
    await openRadio(page);
    await page
        .locator('.station-card', { hasText: 'Jazz FM' })
        .locator('.station-card__main')
        .click();

    const bar = page.locator('app-workspace-playback-bar .playback-bar');
    await expect(bar).toHaveClass(/playback-bar--compact/);

    const sizeButton = bar.locator('.playback-bar__chrome-button').first();
    // Measured in-page as a fraction of the viewport, so the presets are
    // asserted as real rendered heights, not just class names.
    const heightRatio = () =>
        page.evaluate(() => {
            const el = document.querySelector(
                'app-workspace-playback-bar .playback-bar'
            );
            const height = el?.getBoundingClientRect().height ?? 0;
            return height / window.innerHeight;
        });

    await sizeButton.click();
    await expect(bar).toHaveClass(/playback-bar--medium/);
    await expect.poll(heightRatio).toBeGreaterThan(0.3);

    await sizeButton.click();
    await expect(bar).toHaveClass(/playback-bar--large/);
    await expect.poll(heightRatio).toBeGreaterThan(0.6);

    await sizeButton.click();
    await expect(bar).toHaveClass(/playback-bar--compact/);
    await expect.poll(heightRatio).toBeLessThan(0.25);
});

test('@web @radio favouriting a station surfaces it in the Library tab', async ({
    page,
}) => {
    await openRadio(page);
    const card = page.locator('.station-card', { hasText: 'Rock Antenne' });
    await card.locator('.station-card__favorite').click();

    await page.getByRole('tab', { name: /Library/i }).click();

    await expect(
        page.getByRole('heading', { name: /Favorite stations/i })
    ).toBeVisible();
    await expect(
        page.getByRole('tabpanel').locator('.station-card', {
            hasText: 'Rock Antenne',
        })
    ).toBeVisible();
});

test('@web @radio lists podcasts on the Podcasts tab', async ({ page }) => {
    await openRadio(page);

    await page.getByRole('tab', { name: /Podcasts/i }).click();

    await expect(page.locator('.podcast-card')).toHaveCount(1);
    await expect(page.getByText('Deep Dive')).toBeVisible();
});

test('@web @radio tablist supports keyboard roving between tabs', async ({
    page,
}) => {
    await openRadio(page);

    const stations = page.getByRole('tab', { name: /Stations/i });
    await stations.focus();
    await expect(stations).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    const podcasts = page.getByRole('tab', { name: /Podcasts/i });
    await expect(podcasts).toBeFocused();
    await expect(podcasts).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
        'aria-labelledby',
        'radio-tab-podcasts'
    );

    // Wraps from the first tab back to the last.
    await stations.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: /Library/i })).toBeFocused();
});
