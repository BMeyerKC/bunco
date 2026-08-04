import { test, expect } from '@playwright/test';

const ADMIN_HASH = 'a57f283f67bd59fcf75862f28d197c83ea7047b098bb3469ae08396919ad7ab4';

test.describe('feedback widget', () => {
  test('the pill is visible on the home page and opens the modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#feedback-fab')).toBeVisible();
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-modal')).toBeVisible();
  });

  test('send stays disabled until the message has real content', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-send')).toBeDisabled();

    await page.fill('#feedback-message', '   ');
    await expect(page.locator('#feedback-send')).toBeDisabled();

    await page.fill('#feedback-message', 'The round counter confused me.');
    await expect(page.locator('#feedback-send')).toBeEnabled();
  });

  test('escape closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-modal')).toBeVisible();
    // Bootstrap moves focus onto the modal only once its fade-in transition
    // finishes; Escape is a one-shot key press with no retry, so it must be
    // sent after that focus transfer or the keydown listener (bound to the
    // modal element, not document) never sees it.
    await expect(page.locator('#feedback-modal')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#feedback-modal')).not.toBeVisible();
  });

  test('submitting sends the feedback and confirms', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await page.fill('#feedback-message', `[e2e] automated check ${Date.now()}`);
    await page.click('#feedback-send');

    await expect(page.locator('#bunco-toast')).toHaveText('Thanks — we got it!');
    await expect(page.locator('#feedback-modal')).not.toBeVisible();
  });

  test('the pill is present on the scorer page', async ({ page }) => {
    await page.goto('/scorer.html');
    await expect(page.locator('#feedback-fab')).toBeVisible();
  });

  test('the pill is absent on the admin page', async ({ page }) => {
    await page.addInitScript(hash => localStorage.setItem('bunco_admin_unlock', hash), ADMIN_HASH);
    await page.goto('/admin.html');
    await expect(page.locator('#admin-links')).toBeVisible();
    await expect(page.locator('#feedback-fab')).toHaveCount(0);
  });
});
