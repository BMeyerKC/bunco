import { test, expect } from '@playwright/test';

const ADMIN_HASH = 'a57f283f67bd59fcf75862f28d197c83ea7047b098bb3469ae08396919ad7ab4';

test.describe('quick scorer', () => {
  test('tapping a half increments its score', async ({ page }) => {
    await page.goto('/scorer.html');
    await page.click('#us-half');
    await page.click('#us-half');
    await page.click('#them-half');

    await expect(page.locator('#us-score')).toHaveText('2');
    await expect(page.locator('#them-score')).toHaveText('1');
  });

  test('a visit starts a quick scorer session visible in admin', async ({ page }) => {
    await page.goto('/scorer.html');
    // startQuickScorerSession() fires once geo capture settles (or fails) —
    // give it a moment before checking the admin dashboard picked it up.
    await page.waitForTimeout(2000);

    const adminPage = await page.context().newPage();
    await adminPage.addInitScript(hash => localStorage.setItem('bunco_admin_unlock', hash), ADMIN_HASH);
    await adminPage.goto('/admin.html');

    await expect(adminPage.locator('#quick-scorer-list')).not.toContainText('No quick scorer sessions yet.');
    await expect(adminPage.locator('#quick-scorer-list')).not.toContainText('Couldn’t load');
    await expect(adminPage.locator('#quick-scorer-list table')).toBeVisible();
  });
});
