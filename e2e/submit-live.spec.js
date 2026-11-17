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

  test("a tap still on its way when a tablemate submits moves the table's score", async ({ page, request }) => {
    code = randomCode();
    const ids = ['a', 'b', 'c', 'd'];
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 1, currentRound: 1, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-submit-host', createdAt: Date.now() },
        players: Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }])),
        rounds: [null, {
          assignments: Object.fromEntries(ids.map((id, i) => [id, { tableId: 1, side: i < 2 ? 'us' : 'them', seat: (i % 2) + 1 }])),
          tables: [null, { liveUs: 20, liveThem: 17, submitted: false }],
        }],
      },
    });

    // Busy party Wi-Fi: hold this phone's tap until a tablemate has submitted
    const held = [];
    let holding = false;
    let server;
    await page.routeWebSocket(/firebaseio\.com/, ws => {
      server = ws.connectToServer();
      ws.onMessage(m => (holding && String(m).includes('liveUs') ? held.push(m) : server.send(m)));
      server.onMessage(m => ws.send(m));
    });
    await page.addInitScript(c => localStorage.setItem(`bunco_player_${c}`, 'a'), code);
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#sc-us-score')).toHaveText('20');

    holding = true;
    await page.click('#sc-us .side-add');
    await expect.poll(() => held.length).toBeGreaterThan(0);
    // A tablemate submits the 20-17 their phone shows
    await request.patch(`${DB}/games/${code}/rounds/1/tables/1.json`, { data: { usScore: 20, themScore: 17, submitted: true } });
    holding = false;
    held.splice(0).forEach(m => server.send(m));

    await expect.poll(async () => {
      const t = await (await request.get(`${DB}/games/${code}/rounds/1/tables/1.json`)).json();
      return `live ${t.liveUs}-${t.liveThem}, saved ${t.usScore}-${t.themScore}`;
    }).toBe('live 21-17, saved 21-17');
  });
});
