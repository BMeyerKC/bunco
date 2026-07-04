import { test, expect } from '@playwright/test';

const DB = 'https://bunco-60f5d-default-rtdb.firebaseio.com';
const HOST_DEVICE = 'e2e-standings-host';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const fourPlayers = {
  p1: { name: 'Ann', isGhost: false },
  p2: { name: 'Bea', isGhost: false },
  p3: { name: 'Cam', isGhost: false },
  p4: { name: 'Dee', isGhost: false },
};

const tableOneAssignments = {
  p1: { tableId: 1, side: 'us', seat: 1 },
  p2: { tableId: 1, side: 'us', seat: 2 },
  p3: { tableId: 1, side: 'them', seat: 1 },
  p4: { tableId: 1, side: 'them', seat: 2 },
};

const submittedTable = { usScore: 21, themScore: 15, submitted: true, liveUs: 21, liveThem: 15 };

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
    players: fourPlayers,
    rounds: {
      [currentRound]: { assignments: tableOneAssignments, tables: { 1: submittedTable } },
    },
    standings: {},
  };
}

async function allEvents(request, code) {
  const res = await request.get(`${DB}/games/${code}/events.json`);
  const events = (await res.json()) || {};
  return Object.values(events);
}

async function eventTypes(request, code) {
  return (await allEvents(request, code)).map(e => e.type);
}

test.describe('standings page host advance', () => {
  let code;

  test.beforeEach(async ({ page }) => {
    code = randomCode();
    await page.addInitScript(id => localStorage.setItem('bunco_device_id', id), HOST_DEVICE);
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`${DB}/games/${code}.json`);
  });

  test('round 6 complete shows View Final Standings and ends the game', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(6) });
    await page.goto(`/standings.html?code=${code}`);

    const btn = page.locator('#advance-round-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('View Final Standings');

    await btn.click();

    await expect(page.locator('#round-indicator')).toHaveText('Game complete!');
    await expect(page.locator('#advance-round-section')).toBeHidden();
    await expect.poll(async () => {
      const res = await request.get(`${DB}/games/${code}/meta/currentRound.json`);
      return res.json();
    }).toBe(7);
    await expect.poll(() => eventTypes(request, code)).toContain('game_ended');
  });

  test('host can advance consecutive rounds without stale state corrupting standings', async ({ page, request }) => {
    await request.put(`${DB}/games/${code}.json`, { data: seedGame(1) });
    await page.goto(`/standings.html?code=${code}`);

    // Advance round 1 -> 2
    const btn = page.locator('#advance-round-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Start Round 2');
    await btn.click();
    await expect.poll(async () => {
      const res = await request.get(`${DB}/games/${code}/meta/currentRound.json`);
      return res.json();
    }).toBe(2);
    await expect.poll(() => eventTypes(request, code)).toContain('round_started');
    await expect.poll(() => eventTypes(request, code)).toContain('seats_assigned');
    await expect.poll(() => eventTypes(request, code)).toContain('standings_saved');

    // Round 2 finishes (winners are "us" again)
    await request.put(`${DB}/games/${code}/rounds/2/tables/1.json`, { data: submittedTable });

    // Advance round 2 -> 3; a stale closure would silently replay round 1 instead
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Start Round 3');
    await btn.click();
    await expect.poll(async () => {
      const res = await request.get(`${DB}/games/${code}/meta/currentRound.json`);
      return res.json();
    }).toBe(3);

    // Standings must reflect BOTH rounds: p1 sat on the winning side twice
    const standingsRes = await request.get(`${DB}/games/${code}/standings/p1/wins.json`);
    expect(await standingsRes.json()).toBe(2);
  });

  test('ghost table score entry logs a ghost score_submitted event', async ({ page, request }) => {
    const game = seedGame(1);
    game.meta.tables = 2;
    game.players = {
      ...fourPlayers,
      g1: { name: 'Ghost 1', isGhost: true },
      g2: { name: 'Ghost 2', isGhost: true },
      g3: { name: 'Ghost 3', isGhost: true },
      g4: { name: 'Ghost 4', isGhost: true },
    };
    game.rounds[1].assignments = {
      ...tableOneAssignments,
      g1: { tableId: 2, side: 'us', seat: 1 },
      g2: { tableId: 2, side: 'us', seat: 2 },
      g3: { tableId: 2, side: 'them', seat: 1 },
      g4: { tableId: 2, side: 'them', seat: 2 },
    };
    // Table 1 submitted; ghost table 2 pending, so the host must enter it
    await request.put(`${DB}/games/${code}.json`, { data: game });
    await page.goto(`/standings.html?code=${code}`);

    await expect(page.locator('#ghost-scoring-section')).toBeVisible();
    await page.fill('input[data-table="2"][data-side="us"]', '10');
    await page.fill('input[data-table="2"][data-side="them"]', '5');
    await page.click('#ghost-tables-list button[data-table="2"]');

    await expect.poll(async () => {
      const events = await allEvents(request, code);
      return events.some(e =>
        e.type === 'score_submitted' && e.ghost === true && e.tableId === 2 &&
        e.usScore === 10 && e.themScore === 5
      );
    }).toBe(true);
  });
});
