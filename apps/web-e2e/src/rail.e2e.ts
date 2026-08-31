import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * E2E coverage for the workspace navigation dock. The file keeps its historic
 * name so Nx's atomized target remains stable while the UI moves from a side
 * rail to labelled navigation above the workspace.
 */

async function openWorkspace(page: Page): Promise<void> {
    await page.goto('/');
    await expect(page.locator('.app-nav-dock')).toBeVisible({
        timeout: 20_000,
    });
}

test('@web @rail navigation spans the top instead of consuming a side column', async ({
    page,
}) => {
    await openWorkspace(page);

    const metrics = await page.evaluate(() => {
        const dock = document
            .querySelector('.app-nav-dock')
            ?.getBoundingClientRect();
        const content = document
            .querySelector('.workspace-body')
            ?.getBoundingClientRect();
        return {
            dock: dock
                ? {
                      top: dock.top,
                      bottom: dock.bottom,
                      width: dock.width,
                      height: dock.height,
                  }
                : null,
            content: content
                ? {
                      top: content.top,
                      left: content.left,
                      width: content.width,
                  }
                : null,
            viewportWidth: window.innerWidth,
        };
    });

    expect(metrics.dock).not.toBeNull();
    expect(metrics.content).not.toBeNull();
    expect(metrics.dock?.width ?? 0).toBeGreaterThan(
        metrics.viewportWidth * 0.9
    );
    expect(metrics.dock?.height ?? 0).toBeLessThan(70);
    expect(metrics.content?.top ?? 0).toBeGreaterThanOrEqual(
        metrics.dock?.bottom ?? 0
    );
    expect(metrics.content?.left ?? -1).toBeLessThanOrEqual(1);
    expect(metrics.content?.width ?? 0).toBeGreaterThan(
        metrics.viewportWidth * 0.98
    );
    await expect(page.locator('.nav-primary-row')).toHaveCount(1);
    await expect(page.locator('.nav-context-row')).toHaveCount(0);
});

test('@web @rail no two navigation links lead to the same destination', async ({
    page,
}) => {
    await openWorkspace(page);

    const hrefs = await page
        .locator('.app-nav-dock a[href]')
        .evaluateAll((anchors) =>
            anchors.map((anchor) => anchor.getAttribute('href') ?? '')
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
            anchors.map((anchor) => anchor.getAttribute('href') ?? '')
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

test('@web @rail exposes readable destination labels without an expansion mode', async ({
    page,
}) => {
    await openWorkspace(page);

    await expect(
        page.locator('.app-nav-dock a[href="/workspace/radio"]')
    ).toContainText('Radio & podcasts');
    await expect(
        page.locator('.app-nav-dock a[href="/workspace/settings"]')
    ).toContainText('Settings');
    await expect(page.locator('.app-nav-dock .rail-toggle')).toHaveCount(0);
});

test('@web @rail keeps the top dock usable at narrow widths', async ({
    page,
}) => {
    await page.setViewportSize({ width: 620, height: 760 });
    await openWorkspace(page);

    const dock = page.locator('.app-nav-dock');
    const bounds = await dock.boundingBox();
    const workspaceScroll = page.locator('.nav-destinations-scroll');

    await expect(dock).toBeVisible();
    await expect(
        page.locator('.app-nav-dock a[href="/workspace/settings"]')
    ).toBeVisible();
    expect(bounds?.width ?? 0).toBeGreaterThan(590);
    expect(
        await workspaceScroll.evaluate(
            (element) => element.scrollWidth >= element.clientWidth
        )
    ).toBe(true);
});
