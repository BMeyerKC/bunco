import { test, expect } from '@playwright/test';

const PASSPHRASE = 'bunco-boss';
const PASS_HASH = 'a57f283f67bd59fcf75862f28d197c83ea7047b098bb3469ae08396919ad7ab4';

test.describe('admin gate', () => {
  test('prompts for passphrase and rejects a wrong one', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('#admin-gate')).toBeVisible();
    await page.fill('#admin-gate-pass', 'wrong-guess');
    await page.click('#admin-gate button[type="submit"]');
    await expect(page.locator('#admin-gate-error')).toHaveText('Wrong passphrase.');
    await expect(page.locator('#admin-gate')).toBeVisible();
  });

  test('correct passphrase unlocks and persists the unlock marker', async ({ page }) => {
    await page.goto('/admin.html');
    await page.fill('#admin-gate-pass', PASSPHRASE);
    await page.click('#admin-gate button[type="submit"]');
    await expect(page.locator('#admin-gate')).toHaveCount(0);
    await expect(page.locator('#admin-links')).toBeVisible();
    const marker = await page.evaluate(() => localStorage.getItem('bunco_admin_unlock'));
    expect(marker).toBe(PASS_HASH);
  });

  test('existing unlock marker skips the prompt', async ({ page }) => {
    await page.addInitScript(hash => localStorage.setItem('bunco_admin_unlock', hash), PASS_HASH);
    await page.goto('/admin.html');
    await expect(page.locator('#admin-gate')).toHaveCount(0);
    await expect(page.locator('#admin-links')).toBeVisible();
  });
});
