import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

test.describe('submitting a table', () => {
  let code;
  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('records the live score even when this phone has not caught up yet', async ({ page, request }) => {
    code = randomCode();
    const ids = ['a', 'b', 'c', 'd'];
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 1, currentRound: 1, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-submit-host', createdAt: Date.now() },
        players: Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }])),
        rounds: [null, {
          assignments: Object.fromEntries(ids.map((id, i) => [id, { tableId: 1, side: i < 2 ? 'us' : 'them', seat: (i % 2) + 1 }])),
          tables: [null, { liveUs: 12, liveThem: 18, submitted: false }],
        }],
      },
    });
    await page.addInitScript(c => localStorage.setItem(`bunco_player_${c}`, 'a'), code);
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#sc-them-score')).toHaveText('18');

    // A tablemate's last three points land at the moment this phone submits
    await Promise.all([
      request.put(`${DB}/games/${code}/rounds/1/tables/1/liveThem.json`, { data: 21 }),
      page.evaluate(() => document.getElementById('submit-scores-btn').click()),
    ]);

    await expect.poll(async () => {
      const t = await (await request.get(`${DB}/games/${code}/rounds/1/tables/1.json`)).json();
      return t.submitted ? `${t.usScore}-${t.themScore}` : null;
    }).toBe('12-21');
  });
});
