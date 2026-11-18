import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

const ids = ['a', 'b', 'c', 'd'];
const seats = (flip) => Object.fromEntries(ids.map((id, i) => [id, {
  tableId: 1, side: (i < 2) !== flip ? 'us' : 'them', seat: (i % 2) + 1,
}]));

test.describe('a submit that finishes late', () => {
  let code;
  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('does not strand the phone on "submitted" in the next round', async ({ page, request }) => {
    code = randomCode();
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 1, currentRound: 1, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-late-host', createdAt: Date.now() },
        players: Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }])),
        rounds: [null, { assignments: seats(false), tables: [null, { liveUs: 21, liveThem: 9, submitted: false }] }],
      },
    });

    // Slow party Wi-Fi: hold this phone's submit write until we let it go
    const held = [];
    let holding = true;
    let server;
    await page.routeWebSocket(/firebaseio\.com/, ws => {
      server = ws.connectToServer();
      ws.onMessage(m => (holding && String(m).includes('"submitted":true') ? held.push(m) : server.send(m)));
      server.onMessage(m => ws.send(m));
    });

    await page.addInitScript(c => localStorage.setItem(`bunco_player_${c}`, 'a'), code);
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#view-scoring')).toBeVisible();
    await page.click('#submit-scores-btn');
    await expect.poll(() => held.length).toBeGreaterThan(0);

    // Meanwhile a tablemate's submit lands and the host starts round 2
    await request.patch(`${DB}/games/${code}/rounds/1/tables/1.json`, { data: { usScore: 21, themScore: 9, submitted: true } });
    await request.patch(`${DB}/games/${code}.json`, {
      data: {
        'rounds/2': { assignments: seats(true), tables: [null, { liveUs: 0, liveThem: 0, submitted: false }] },
        'meta/currentRound': 2,
      },
    });
    await expect(page.getByText('Round 2 of 6')).toBeVisible();
    await expect(page.locator('#view-scoring')).toBeVisible();

    // The slow submit finally reaches the server
    holding = false;
    held.splice(0).forEach(m => server.send(m));
    await page.waitForTimeout(1_500);
    await expect(page.locator('#view-scoring')).toBeVisible();
  });

  // #43: two tables, so table 1's phone sits on "submitted" waiting for table 2
  async function onSubmitted(page, request) {
    code = randomCode();
    await request.put(`${DB}/games/${code}.json`, {
      data: {
        meta: { tables: 2, currentRound: 1, ghostSlots: 0, gameCalledBy: null, hostDeviceId: 'e2e-late-host', createdAt: Date.now() },
        players: Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }])),
        rounds: [null, { assignments: seats(false), tables: [null,
          { liveUs: 21, liveThem: 9, submitted: false },
          { liveUs: 12, liveThem: 21, submitted: false }] }],
      },
    });
    await page.addInitScript(c => localStorage.setItem(`bunco_player_${c}`, 'a'), code);
    await page.goto(`/game.html?code=${code}`);
    await expect(page.locator('#view-scoring')).toBeVisible();
    await page.click('#submit-scores-btn');
    await expect(page.locator('#view-submitted')).toBeVisible();
  }

  test('leaves "submitted" when the next round starts', async ({ page, request }) => {
    await onSubmitted(page, request);
    // Table 2 submits and the host starts round 2 in one update, as a phone
    // that missed the round-over moment would see it
    await request.patch(`${DB}/games/${code}.json`, {
      data: {
        'rounds/1/tables/2': { liveUs: 12, liveThem: 21, usScore: 12, themScore: 21, submitted: true },
        'rounds/2': { assignments: seats(true), tables: [null, { liveUs: 0, liveThem: 0, submitted: false }, { liveUs: 0, liveThem: 0, submitted: false }] },
        'meta/currentRound': 2,
      },
    });
    await expect(page.getByText('Round 2 of 6')).toBeVisible();
    await expect(page.locator('#view-scoring')).toBeVisible();
  });

  test('goes back to scoring if its table is no longer submitted', async ({ page, request }) => {
    await onSubmitted(page, request);
    await request.patch(`${DB}/games/${code}/rounds/1/tables/1.json`, { data: { submitted: false } });
    await expect(page.locator('#view-scoring')).toBeVisible();
  });
});
