import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * E2E coverage for the workspace rail's layout behaviours: the expand /
 * collapse toggle, the hug-content sizing that replaced the full-height
 * stretch, and the guarantees that came out of visual review — no duplicate
 * destinations and a stable, intentional ordering.
 */

async function openWorkspace(page: Page): Promise<void> {
    await page.goto('/');
    await expect(page.locator('.app-rail')).toBeVisible({ timeout: 20_000 });
}

test('@web @rail hugs its content instead of stretching to full height', async ({
    page,
}) => {
    await openWorkspace(page);

    // Measured in-page so the numbers are plain values, never null boxes.
    const metrics = await page.evaluate(() => {
        const rail = document
            .querySelector('.app-rail')
            ?.getBoundingClientRect();
        const settings = document
            .querySelector('.rail-footer a[href="/workspace/settings"]')
            ?.getBoundingClientRect();
        return {
            railHeight: rail?.height ?? 0,
            railBottom: rail ? rail.top + rail.height : 0,
            settingsBottom: settings ? settings.top + settings.height : -1,
            viewportHeight: window.innerHeight,
        };
    });

    // The old layout stretched the rail to the window edge, leaving a large
    // dead gap between the destinations and settings. Content-sized, the rail
    // must end well above the bottom on a default desktop viewport...
    expect(metrics.railHeight).toBeGreaterThan(0);
    expect(metrics.railHeight).toBeLessThan(metrics.viewportHeight - 40);

    // ... and the settings tile sits inside it, directly after the divider,
    // not pinned to the window edge.
    expect(metrics.settingsBottom).toBeGreaterThan(0);
    expect(metrics.settingsBottom).toBeLessThanOrEqual(metrics.railBottom + 1);
});

test('@web @rail no two rail buttons lead to the same destination', async ({
    page,
}) => {
    await openWorkspace(page);

    const hrefs = await page
        .locator('.app-rail a[href]')
        .evaluateAll((anchors) =>
            anchors.map((a) => a.getAttribute('href') ?? '')
        );

    expect(hrefs.length).toBeGreaterThan(3);
    expect(new Set(hrefs).size).toBe(hrefs.length);
});

test('@web @rail orders content sources ahead of personal collections', async ({
    page,
}) => {
    await openWorkspace(page);

    const hrefs = await page
        .locator('app-workspace-shell-rail-links a[href]')
        .evaluateAll((anchors) =>
            anchors.map((a) => a.getAttribute('href') ?? '')
        );

    const radio = hrefs.indexOf('/workspace/radio');
    const favorites = hrefs.indexOf('/workspace/global-favorites');
    const recent = hrefs.indexOf('/workspace/global-recent');
    const followed = hrefs.indexOf('/workspace/followed-series');

    expect(radio).toBeGreaterThanOrEqual(0);
    expect(radio).toBeLessThan(favorites);
    expect(favorites).toBeLessThan(recent);
    expect(recent).toBeLessThan(followed);
});

test('@web @rail expands into labelled tiles and persists across reload', async ({
    page,
}) => {
    await openWorkspace(page);

    const rail = page.locator('.app-rail');
    const collapsed = await rail.boundingBox();

    await page.getByRole('button', { name: 'Expand sidebar' }).click();

    // Wider rail, labelled tiles, and the labels are full text — the sources
    // tile shows its name rather than an icon-only square.
    await expect(rail).toHaveClass(/is-expanded/);
    await expect
        .poll(async () => (await rail.boundingBox())?.width ?? 0)
        .toBeGreaterThan((collapsed?.width ?? 0) + 100);
    await expect(
        page.locator('app-workspace-shell-rail-links a', {
            hasText: 'Sources',
        })
    ).toBeVisible();

    // The choice survives a full reload.
    await page.reload();
    await expect(page.locator('.app-rail')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.app-rail')).toHaveClass(/is-expanded/);

    // And collapses back to icon-only tiles.
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.locator('.app-rail')).not.toHaveClass(/is-expanded/);
    await expect
        .poll(async () => (await rail.boundingBox())?.width ?? 0)
        .toBeLessThan(100);
});

test('@web @rail collapsed tiles expose hover hints via tooltips', async ({
    page,
}) => {
    await openWorkspace(page);

    // Collapsed tiles are icon-only, so every destination must carry an
    // accessible name and a tooltip trigger for its hover hint.
    const radioTile = page.locator('.app-rail a[href="/workspace/radio"]');
    await expect(radioTile).toHaveAttribute('aria-label', 'Radio & podcasts');

    await radioTile.hover();
    // Material renders the tooltip as nested surfaces; match on the text.
    await expect(
        page
            .locator('mat-tooltip-component, .mdc-tooltip')
            .filter({ hasText: 'Radio & podcasts' })
            .first()
    ).toBeVisible({ timeout: 5_000 });
});
