import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');
const seat = (tableId, side, s) => ({ tableId, side, seat: s });

// Round 1 in progress: one table, three humans and one open ghost seat
const gameWithOpenGhost = () => ({
  meta: { tables: 1, currentRound: 1, ghostSlots: 1, gameCalledBy: null, hostDeviceId: 'e2e-ghost-host', createdAt: Date.now() },
  players: {
    a: { name: 'Ann', isGhost: false }, b: { name: 'Bea', isGhost: false },
    c: { name: 'Cam', isGhost: false }, g: { name: 'Ghost Gus', isGhost: true },
  },
  rounds: [null, {
    assignments: { a: seat(1, 'us', 1), b: seat(1, 'us', 2), c: seat(1, 'them', 1), g: seat(1, 'them', 2) },
    tables: [null, { liveUs: 0, liveThem: 0, submitted: false }],
  }],
});

async function openClaim(page, code, name) {
  await page.goto(`/game.html?code=${code}`);
  await page.locator('#join-ghost-list button').first().click();
  await page.fill('#join-ghost-name', name);
}

test.describe('claiming a ghost seat', () => {
  let code;
  test.beforeEach(async ({ request }) => {
    code = randomCode();
    await request.put(`${DB}/games/${code}.json`, { data: gameWithOpenGhost() });
  });
  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('is refused with a name already in the game', async ({ page, request }) => {
    await openClaim(page, code, 'ann');
    await page.click('#join-ghost-confirm');
    await expect(page.locator('.app-toast').last()).toContainText('Someone already has that name');
    const g = await (await request.get(`${DB}/games/${code}/players/g.json`)).json();
    expect(g.isGhost).toBe(true);
  });

  test('by two phones at once: the first wins, the second is told', async ({ browser, baseURL, request }) => {
    const phones = [await browser.newContext(), await browser.newContext()];
    try {
      const pages = await Promise.all(phones.map(c => c.newPage()));
      await openClaim(pages[0], code, 'Dot');
      await openClaim(pages[1], code, 'Eve');
      // Both taps land before either phone hears about the other's claim
      await Promise.all(pages.map(p => p.evaluate(() => document.getElementById('join-ghost-confirm').click())));

      await expect.poll(async () => (await (await request.get(`${DB}/games/${code}/players/g.json`)).json()).isGhost).toBe(false);
      const owners = await Promise.all(pages.map(p => p.evaluate(c => localStorage.getItem(`bunco_player_${c}`), code)));
      expect(owners.filter(id => id === 'g')).toHaveLength(1);
      const loser = pages[owners.indexOf('g') === 0 ? 1 : 0];
      await expect(loser.locator('.app-toast').last()).toContainText('Someone just took that seat');
    } finally {
      await Promise.all(phones.map(c => c.close()));
    }
  });

  test('form that vanishes because someone else took the seat explains why', async ({ browser, request }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await openClaim(page, code, 'Dot');
      await request.patch(`${DB}/games/${code}/players/g.json`, { data: { name: 'Eve', isGhost: false } });
      await expect(page.locator('.app-toast').last()).toContainText('Someone just took that seat');
    } finally {
      await ctx.close();
    }
  });
});
