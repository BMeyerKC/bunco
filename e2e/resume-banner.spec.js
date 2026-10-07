import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const HOST_DEVICE = 'e2e-resume-host';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function seedGame(currentRound) {
  return {
    meta: {
      tables: 1,
      ghostSlots: 0,
      currentRound,
      gameCalledBy: null,
      hostDeviceId: HOST_DEVICE,
      createdAt: Date.now(),
    },
    players: { p1: { name: 'Ann', isGhost: false } },
    rounds: {},
    standings: {},
  };
}

test.describe('home page resume banner', () => {
  let code;

  test.beforeEach(() => {
    code = randomCode();
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('offers to rejoin a game in progress', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(2) });
    await page.addInitScript(c => localStorage.setItem('bunco_last_code', c), code);

    await page.goto('/');

    const banner = page.locator('#resume-banner');
    await expect(banner).toBeVisible();
    await expect(page.locator('#resume-banner-text')).toContainText(code);
    const link = page.locator('#resume-banner-link');
    await expect(link).toHaveText('Rejoin game');
    await expect(link).toHaveAttribute('href', `game.html?code=${code}`);
  });

  test('points to final standings for a finished game', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(7) });
    await page.addInitScript(c => localStorage.setItem('bunco_last_code', c), code);

    await page.goto('/');

    const link = page.locator('#resume-banner-link');
    await expect(link).toHaveText('See final standings');
    await expect(link).toHaveAttribute('href', `standings.html?code=${code}&final=true`);
  });

  test('dismissing hides the banner and stops it reappearing', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(1) });

    // addInitScript re-seeds on every navigation (including reload), which
    // would mask forgetActiveGame() clearing the key — set it once instead.
    await page.goto('/');
    await page.evaluate(c => localStorage.setItem('bunco_last_code', c), code);
    await page.reload();
    await expect(page.locator('#resume-banner')).toBeVisible();

    await page.click('#resume-banner-dismiss');
    await expect(page.locator('#resume-banner')).toBeHidden();

    await page.reload();
    await expect(page.locator('#resume-banner')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('bunco_last_code'))).toBeNull();
  });

  test('a deleted/missing game shows no banner and forgets the code', async ({ page }) => {
    // Never seeded — code points at nothing in the DB.
    await page.addInitScript(c => localStorage.setItem('bunco_last_code', c), code);

    await page.goto('/');

    await expect(page.locator('#resume-banner')).toBeHidden();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('bunco_last_code'))).toBeNull();
  });

  test('no banner when nothing was remembered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#resume-banner')).toBeHidden();
  });

  test('leaving a game from the standings page forgets it too', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(1) });
    await page.addInitScript(id => localStorage.setItem('bunco_device_id', id), HOST_DEVICE);

    await page.goto(`/standings.html?code=${code}`);
    await page.evaluate(c => localStorage.setItem('bunco_last_code', c), code);
    await page.click('#leave-game-btn');

    await expect(page).toHaveURL(/\/index\.html|\/$/);
    expect(await page.evaluate(() => localStorage.getItem('bunco_last_code'))).toBeNull();
  });
});
