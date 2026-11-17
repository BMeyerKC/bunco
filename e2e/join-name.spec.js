import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

test.describe('joining with a name', () => {
  let code;
  test.beforeEach(async ({ request }) => {
    code = randomCode();
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 2, currentRound: 0, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-join-host', createdAt: Date.now() },
        players: { a: { name: 'Ann', isGhost: false }, b: { name: 'Bea', isGhost: false } },
      },
    });
  });
  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('two phones joining as the same name at once: one gets in, the other is told', async ({ browser }) => {
    const phones = [await browser.newContext(), await browser.newContext()];
    try {
      const pages = await Promise.all(phones.map(c => c.newPage()));
      for (const p of pages) {
        await p.goto(`/game.html?code=${code}`);
        await p.fill('#join-name', 'Dana');
      }
      await Promise.all(pages.map(p => p.evaluate(() => document.getElementById('join-btn').click())));

      // Toasts last 3.5s, so watch both outcomes at once rather than in turn
      const outcome = p => Promise.race([
        p.locator('#view-waiting').waitFor({ state: 'visible' }).then(() => 'joined'),
        p.locator('.app-toast', { hasText: 'Someone already has that name' }).waitFor().then(() => 'told'),
      ]);
      const outcomes = await Promise.all(pages.map(outcome));
      expect([...outcomes].sort()).toEqual(['joined', 'told']);
      const loser = pages[outcomes.indexOf('told')];
      await expect(loser.locator('#join-btn')).toBeEnabled();
    } finally {
      await Promise.all(phones.map(c => c.close()));
    }
  });
});
