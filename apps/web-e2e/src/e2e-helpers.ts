import type { APIRequestContext, Locator } from '@playwright/test';
import { expect } from './fixtures';

export async function setInputValue(
    input: Locator,
    value: string
): Promise<void> {
    await input.fill(value);

    if ((await input.inputValue()) !== value) {
        await input.click();
        await input.press('ControlOrMeta+A');
        await input.press('Backspace');
        await input.pressSequentially(value);
    }

    await expect(input).toHaveValue(value);
}

/**
 * Reset a mock server's in-memory state (favorites, caches, generated data).
 * Retries transient failures so a momentarily busy server does not silently
 * leak state into the next test, and fails fast instead of hanging on the
 * default 30s request timeout when the server is wedged.
 */
export async function resetMockServer(
    request: APIRequestContext,
    serverOrigin: string
): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await request.post(`${serverOrigin}/reset`, {
                timeout: 5_000,
            });
            if (response.ok()) {
                return;
            }

            lastError = new Error(
                `Reset of ${serverOrigin} failed with status ${response.status()}`
            );
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) =>
            setTimeout(resolve, 250 * (attempt + 1))
        );
    }

    throw lastError;
}
