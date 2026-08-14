import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openSettings(page: Page) {
    await page.locator('a[href$="/workspace/settings"]').click();
    await page.waitForURL(/\/workspace\/settings$/);
    await expect(page.locator('.settings-container')).toBeVisible();
    await expect(page.locator('.settings-back-button')).toBeVisible();
}

async function saveSettings(page: Page) {
    const saveButton = page.locator('[data-test-id="save-settings"]');

    await saveButton.click();
    await expect(saveButton).toBeDisabled();
}

test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
        // Playwright creates a fresh browser context per test, so extra
        // IndexedDB cleanup here only risks racing with app-managed DB handles.
        await page.goto('/');
    });

    test('@settings @web Check settings page', async ({ page }) => {
        await openSettings(page);
        await page.locator('.settings-back-button').click();
        // The back button must actually leave the settings route.
        await expect(page).not.toHaveURL(/\/workspace\/settings$/);
    });

    test('@settings @web Change video player', async ({ page }) => {
        await openSettings(page);

        const playerSelect = page.locator('[data-test-id="select-video-player"]');

        await expect(playerSelect).toContainText(
            /Video\.js/i
        );
        await playerSelect.click();
        await page.locator('mat-option[data-test-id="html5"]').click();

        await saveSettings(page);
        await page.reload();
        await openSettings(page);

        await expect(playerSelect).toContainText(
            /HTML5/i
        );
    });

    test('@settings @web Enable shared web player controls', async ({
        page,
    }) => {
        await openSettings(page);

        const setting = page.locator(
            '[data-test-id="web-player-shared-controls-setting"]'
        );
        const checkbox = setting.locator('input[type="checkbox"]');

        await expect(setting).toBeVisible();
        await expect(checkbox).not.toBeChecked();
        await checkbox.check();
        await saveSettings(page);
        await page.reload();
        await openSettings(page);

        await expect(checkbox).toBeChecked();
    });

    test('@settings @web Change app language', async ({ page }) => {
        await openSettings(page);
        const languageSelect = page.locator('[data-test-id="select-language"]');

        await expect(languageSelect).toContainText(
            'English'
        );
        await languageSelect.click();
        await page.locator('mat-option[data-test-id="de"]').click();

        await saveSettings(page);
        await page.reload();
        await openSettings(page);

        await expect(languageSelect).toContainText(
            'Deutsch'
        );
    });

    test.afterEach(async ({ page }, testInfo) => {
        // Only failures need a screenshot; testInfo.outputPath is unique per
        // test AND per browser project, so parallel chromium/firefox/webkit
        // workers no longer overwrite each other's artifacts.
        if (testInfo.status === testInfo.expectedStatus) {
            return;
        }

        await page.screenshot({
            path: testInfo.outputPath('settings-failure.png'),
        });
    });
});
