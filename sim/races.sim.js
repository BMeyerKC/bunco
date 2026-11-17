// sim/races.sim.js — two phones doing the same thing at the same moment.
// Each test seeds a game straight into the emulator, then races two real
// pages. The ADR-0001 expectation: first one wins, the other is told.
import { test, expect } from '@playwright/test';

test.setTimeout(60_000);

const DB = 'http://127.0.0.1:9000';
const NS = 'ns=bunco-60f5d-default-rtdb';
const OWNER = { Authorization: 'Bearer owner' };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * 32)]).join('');

const put = (request, path, data) => request.put(`${DB}/${path}.json?${NS}`, { headers: OWNER, data });
const read = async (request, path) => (await request.get(`${DB}/${path}.json?${NS}`, { headers: OWNER })).json();

async function phone(browser, deviceId) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(id => {
    localStorage.setItem('bunco_db_emulator', '9000');
    localStorage.setItem('bunco_device_id', id);
  }, deviceId);
  return { ctx, page: await ctx.newPage() };
}

const seat = (tableId, side, s) => ({ tableId, side, seat: s });
const meta = (tables, currentRound, ghostSlots) => ({
  tables, currentRound, ghostSlots, gameCalledBy: null, hostDeviceId: 'race-host', createdAt: Date.now(),
});

test('two phones join with the same name at once', async ({ browser, baseURL, request }) => {
  const code = randomCode();
  await put(request, `games/${code}`, {
    meta: meta(2, 0, 0),
    players: { a: { name: 'Ann', isGhost: false }, b: { name: 'Bea', isGhost: false } },
  });
  const phones = [await phone(browser, 'race-1'), await phone(browser, 'race-2')];
  try {
    for (const p of phones) {
      await p.page.goto(`${baseURL}/game.html?code=${code}`);
      await p.page.fill('#join-name', 'Dana');
    }
    await Promise.all(phones.map(p => p.page.click('#join-btn')));
    await expect.poll(async () => Object.keys((await read(request, `games/${code}/players`)) || {}).length).toBeGreaterThan(2);
    const players = Object.values(await read(request, `games/${code}/players`));
    expect(players.filter(p => p.name === 'Dana').length, 'players named Dana').toBe(1);
  } finally {
    await Promise.all(phones.map(p => p.ctx.close()));
  }
});

// Round 1 in progress: one table, three humans and one open ghost seat
function gameWithOpenGhost() {
  return {
    meta: meta(1, 1, 1),
    players: {
      a: { name: 'Ann', isGhost: false }, b: { name: 'Bea', isGhost: false },
      c: { name: 'Cam', isGhost: false }, g: { name: 'Ghost Gus', isGhost: true },
    },
    rounds: [null, {
      assignments: { a: seat(1, 'us', 1), b: seat(1, 'us', 2), c: seat(1, 'them', 1), g: seat(1, 'them', 2) },
      tables: [null, { liveUs: 0, liveThem: 0, submitted: false }],
    }],
  };
}

async function claimGhost(page, baseURL, code, name) {
  await page.goto(`${baseURL}/game.html?code=${code}`);
  await page.locator('#join-ghost-list button').first().click();
  await page.fill('#join-ghost-name', name);
}

test('two phones claim the same ghost seat at once', async ({ browser, baseURL, request }) => {
  const code = randomCode();
  await put(request, `games/${code}`, gameWithOpenGhost());
  const phones = [await phone(browser, 'race-1'), await phone(browser, 'race-2')];
  try {
    await claimGhost(phones[0].page, baseURL, code, 'Dot');
    await claimGhost(phones[1].page, baseURL, code, 'Eve');
    // Both taps land before either phone hears about the other's claim.
    // (With a slower second tap, its claim form just vanishes with no message.)
    await Promise.all(phones.map(p => p.page.evaluate(() => document.getElementById('join-ghost-confirm').click())));
    await expect.poll(async () => (await read(request, `games/${code}/players/g`)).isGhost).toBe(false);

    const owners = [];
    for (const p of phones) {
      const id = await p.page.evaluate(c => localStorage.getItem(`bunco_player_${c}`), code);
      if (id === 'g') owners.push(p);
    }
    expect(owners.length, 'phones that think they own the ghost seat').toBe(1);
  } finally {
    await Promise.all(phones.map(p => p.ctx.close()));
  }
});

test('claiming a ghost seat with a name already in the game', async ({ browser, baseURL, request }) => {
  const code = randomCode();
  await put(request, `games/${code}`, gameWithOpenGhost());
  const p = await phone(browser, 'race-1');
  try {
    await claimGhost(p.page, baseURL, code, 'ann');
    await p.page.click('#join-ghost-confirm');
    await p.page.waitForTimeout(2_000);
    const players = Object.values(await read(request, `games/${code}/players`));
    expect(players.filter(x => x.name.toLowerCase() === 'ann').length, 'players named Ann').toBe(1);
  } finally {
    await p.ctx.close();
  }
});

test('host types a ghost table score while another table is scoring', async ({ browser, baseURL, request }) => {
  const code = randomCode();
  const players = {};
  const assignments = {};
  ['a', 'b', 'c', 'd'].forEach((id, i) => {
    players[id] = { name: `P${id}`, isGhost: false };
    assignments[id] = seat(1, i < 2 ? 'us' : 'them', (i % 2) + 1);
  });
  ['w', 'x', 'y', 'z'].forEach((id, i) => {
    players[id] = { name: `Ghost ${id}`, isGhost: true };
    assignments[id] = seat(2, i < 2 ? 'us' : 'them', (i % 2) + 1);
  });
  await put(request, `games/${code}`, {
    meta: { ...meta(2, 2, 4), hostDeviceId: 'race-host' },
    players,
    rounds: [null, null, { assignments, tables: [null, { liveUs: 0, liveThem: 0, submitted: false }, { liveUs: 0, liveThem: 0, submitted: false }] }],
  });
  const host = await phone(browser, 'race-host');
  try {
    await host.page.goto(`${baseURL}/standings.html?code=${code}`);
    await host.page.fill('input[data-table="2"][data-side="us"]', '21');
    await host.page.fill('input[data-table="2"][data-side="them"]', '14');
    // Table 1 taps a point while the host is still on the form
    await put(request, `games/${code}/rounds/2/tables/1/liveUs`, 1);
    await host.page.waitForTimeout(500);
    await host.page.click('button[data-table="2"]');
    await expect.poll(async () => (await read(request, `games/${code}/rounds/2/tables/2`)).submitted).toBe(true);
    const t2 = await read(request, `games/${code}/rounds/2/tables/2`);
    expect(`${t2.usScore}-${t2.themScore}`, 'ghost table score saved').toBe('21-14');
  } finally {
    await host.ctx.close();
  }
});

test('an old phone on slow Wi-Fi submits right after its tablemates tap fast', async ({ browser, baseURL, request }) => {
  const code = randomCode();
  const ids = ['a', 'b', 'c', 'd'];
  const players = Object.fromEntries(ids.map(id => [id, { name: `P${id}`, isGhost: false }]));
  const assignments = Object.fromEntries(ids.map((id, i) => [id, seat(1, i < 2 ? 'us' : 'them', (i % 2) + 1)]));
  await put(request, `games/${code}`, {
    meta: meta(1, 1, 0), players,
    rounds: [null, { assignments, tables: [null, { liveUs: 0, liveThem: 0, submitted: false }] }],
  });
  const phones = [];
  try {
    for (const id of ids) {
      const p = await phone(browser, `race-${id}`);
      await p.ctx.addInitScript(([c, pid]) => localStorage.setItem(`bunco_player_${c}`, pid), [code, id]);
      await p.page.goto(`${baseURL}/game.html?code=${code}`);
      await expect(p.page.locator('#view-scoring')).toBeVisible();
      phones.push(p);
    }
    // The submitting phone is on slow party Wi-Fi
    const cdp = await phones[0].ctx.newCDPSession(phones[0].page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: -1, uploadThroughput: -1 });
    // ...on an old phone
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    // Everyone taps 6 points as fast as they can, then the first phone submits
    await Promise.all(phones.map(async (p, i) => {
      for (let n = 0; n < 6; n++) await p.page.click(`#sc-${i < 2 ? 'us' : 'them'} .side-add`);
    }));
    await phones[0].page.click('#submit-scores-btn');
    await expect.poll(async () => (await read(request, `games/${code}/rounds/1/tables/1`)).submitted).toBe(true);
    await phones[0].page.waitForTimeout(2_000);
    const t = await read(request, `games/${code}/rounds/1/tables/1`);
    expect(`${t.usScore}-${t.themScore}`, 'submitted vs live').toBe(`${t.liveUs}-${t.liveThem}`);
    expect(`${t.liveUs}-${t.liveThem}`, 'every tap counted').toBe('12-12');
  } finally {
    await Promise.all(phones.map(p => p.ctx.close()));
  }
});
