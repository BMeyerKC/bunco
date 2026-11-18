import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

test.describe('a phone reloading mid-round (#35)', () => {
  let code;
  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  async function seedAndOpen(page, request) {
    code = randomCode();
    const ids = ['a', 'b', 'c', 'd'];
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 1, currentRound: 1, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-reload-host', createdAt: Date.now() },
        players: Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }])),
        rounds: [null, {
          assignments: Object.fromEntries(ids.map((id, i) => [id, { tableId: 1, side: i < 2 ? 'us' : 'them', seat: (i % 2) + 1 }])),
          tables: [null, { liveUs: 20, liveThem: 17, submitted: false }],
        }],
      },
    });
    await page.addInitScript(c => localStorage.setItem(`bunco_player_${c}`, 'a'), code);
  }
  const liveScore = async request => {
    const t = await (await request.get(`${DB}/games/${code}/rounds/1/tables/1.json`)).json();
    return `${t.liveUs}-${t.liveThem}`;
  };

  test("keeps a tap that hadn't reached the table yet", async ({ page, request }) => {
    await seedAndOpen(page, request);
    // Busy party Wi-Fi: the tap never leaves the phone before it reloads
    let dropping = false;
    let dropped = 0;
    await page.routeWebSocket(/firebaseio\.com/, ws => {
      const server = ws.connectToServer();
      ws.onMessage(m => (dropping && String(m).includes('liveUs') ? dropped++ : server.send(m)));
      server.onMessage(m => ws.send(m));
    });
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#sc-us-score')).toHaveText('20');

    dropping = true;
    await page.click('#sc-us .side-add');
    await expect.poll(() => dropped).toBeGreaterThan(0);
    dropping = false;
    await page.reload();

    await expect.poll(() => liveScore(request)).toBe('21-17');
    await expect(page.locator('#sc-us-score')).toHaveText('21');
  });

  test("doesn't count a tap twice when it landed before the reload", async ({ page, request }) => {
    await seedAndOpen(page, request);
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#sc-us-score')).toHaveText('20');
    await page.click('#sc-us .side-add');
    await page.click('#sc-them .side-add');
    await page.click('#sc-them-dec');
    await expect.poll(() => liveScore(request)).toBe('21-17');

    await page.reload();
    await expect(page.locator('#sc-us-score')).toHaveText('21');
    await page.waitForTimeout(2_000);
    expect(await liveScore(request)).toBe('21-17');
  });
});
