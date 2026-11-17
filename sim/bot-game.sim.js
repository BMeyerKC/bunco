// sim/bot-game.sim.js — seeded bot games played through the real pages.
// Each human player is its own browser context (its own phone and its own
// Firebase connection), so taps, Buncos, submits and round advances race
// the way they do at a real game night. After the game, sim/invariants.js
// checks the database for rules that must always hold.
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createGameAndStartRound, closeGameContexts } from '../e2e/actions/setup-tables.js';
import { checkGame } from './invariants.js';

const DB = 'http://127.0.0.1:9000';
const NS = 'ns=bunco-60f5d-default-rtdb';
const OWNER = { Authorization: 'Bearer owner' };

// mulberry32: tiny seeded PRNG so a failing seed replays the same game
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = arr => arr[Math.floor(next() * arr.length)];
  const chance = p => next() < p;
  const shuffle = arr => {
    const a2 = [...arr];
    for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
    return a2;
  };
  return { next, int, pick, chance, shuffle };
}

function scenario(seed) {
  const r = makeRng(seed);
  const humans = r.pick([4, 4, 5, 6, 7, 8, 8, 9, 11, 12]);
  const tables = Math.ceil(humans / 4);
  return {
    seed,
    tables,
    ghosts: tables * 4 - humans,
    hostPlays: r.chance(0.6),
    rng: r,
  };
}

function parseSeeds(spec = '1-3') {
  return spec.split(',').flatMap(part => {
    const [lo, hi] = part.split('-').map(Number);
    return Array.from({ length: (hi ?? lo) - lo + 1 }, (_, i) => lo + i);
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function read(request, path) {
  const res = await request.get(`${DB}/${path}.json?${NS}`, { headers: OWNER });
  return res.json();
}

// Every context this browser opens talks to the emulator, never the live DB.
const emulatorBrowser = browser => ({
  newContext: async opts => {
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(() => localStorage.setItem('bunco_db_emulator', '9000'));
    return ctx;
  },
});

for (const seed of parseSeeds(process.env.SIM_SEEDS)) {
  test(`bot game seed ${seed}`, async ({ browser, baseURL, request }) => {
    const sc = scenario(seed);
    const { rng } = sc;
    const log = [];
    const note = msg => log.push(msg);
    const runtime = []; // violations seen while playing (stuck screens, etc.)
    const expected = {};

    const humans = sc.tables * 4 - sc.ghosts;
    const session = await createGameAndStartRound({
      browser: emulatorBrowser(browser),
      baseURL,
      tables: sc.tables,
      ghosts: sc.ghosts,
      playerCount: sc.hostPlays ? humans - 1 : humans,
      hostPlayerName: sc.hostPlays ? 'Host' : null,
    });
    const code = session.gameCode;
    note(`seed ${seed}: code ${code}, ${sc.tables} tables, ${sc.ghosts} ghosts, host ${sc.hostPlays ? 'plays' : 'only hosts'}`);

    try {
      const game0 = await read(request, `games/${code}`);
      const idByName = Object.fromEntries(Object.entries(game0.players).map(([id, p]) => [p.name, id]));
      const devices = session.players.map(p => ({ name: p.name, id: idByName[p.name], page: p.page }));
      if (sc.hostPlays) devices.push({ name: 'Host', id: idByName.Host, page: session.hostPage, host: true });

      // A standings tab the host can use to advance or score ghost tables
      let standingsTab = sc.hostPlays ? null : session.hostPage;
      const openStandings = async () => {
        if (!standingsTab) {
          standingsTab = await session.hostContext.newPage();
          await standingsTab.goto(`${baseURL}/standings.html?code=${code}`);
        }
        return standingsTab;
      };

      for (let round = 1; round <= 6; round++) {
        // Every phone should be scoring this round
        for (const d of devices) {
          try {
            await expect(d.page.locator('#round-label')).toHaveText(`Round ${round} of 6`, { timeout: 20_000 });
            await expect(d.page.locator('#view-scoring')).toBeVisible();
          } catch {
            const view = await d.page.evaluate(() => [...document.querySelectorAll('[id^="view-"]')].find(v => v.offsetParent)?.id ?? location.pathname);
            runtime.push(`round ${round}: ${d.name} stuck on ${view}; reloaded`);
            await d.page.reload();
            await expect(d.page.locator('#round-label')).toHaveText(`Round ${round} of 6`);
          }
        }

        const game = await read(request, `games/${code}`);
        const assignments = game.rounds[round].assignments;
        expected[round] = {};
        let firstDone = true;

        const playTable = async tableId => {
          const at = devices.filter(d => assignments[d.id]?.tableId === tableId);
          if (at.length === 0) return; // ghost-only table
          const winner = rng.pick(['us', 'them']);
          const loserScore = rng.int(0, 20);
          const target = { us: winner === 'us' ? 21 : loserScore, them: winner === 'them' ? 21 : loserScore };
          expected[round][tableId] = target;

          // Build each phone's queue of taps; a few mistakes get tapped then undone
          const taps = rng.shuffle([...Array(target.us).fill('us'), ...Array(target.them).fill('them')]);
          const queues = at.map(() => []);
          for (const side of taps) {
            const q = queues[rng.int(0, at.length - 1)];
            q.push({ do: 'add', side });
            if (rng.chance(0.04)) q.push({ do: 'add', side }, { do: 'dec', side });
          }
          const buncoAt = rng.chance(0.15) ? rng.int(0, Math.max(0, taps.length - 1)) : -1;
          const doubleBunco = buncoAt >= 0 && at.length > 1 && rng.chance(0.3);
          const reloadAt = rng.chance(0.08) ? rng.int(0, at.length - 1) : -1;

          await Promise.all(at.map(async (d, i) => {
            let n = 0;
            for (const step of queues[i]) {
              if (reloadAt === i && n === Math.floor(queues[i].length / 2)) {
                note(`r${round} t${tableId}: ${d.name} reloads mid-round`);
                await d.page.reload();
                await expect(d.page.locator('#view-scoring')).toBeVisible();
              }
              const sel = step.do === 'add' ? `#sc-${step.side} .side-add` : `#sc-${step.side}-dec`;
              await d.page.click(sel);
              await sleep(rng.int(0, 150));
              n++;
            }
          }));

          if (buncoAt >= 0) {
            const humansAt = Object.entries(assignments)
              .filter(([id, a]) => a.tableId === tableId && !game.players[id].isGhost)
              .map(([id]) => game.players[id].name);
            const roller = rng.pick(humansAt);
            const clickers = doubleBunco ? at.slice(0, 2) : [rng.pick(at)];
            note(`r${round} t${tableId}: Bunco for ${roller} by ${clickers.map(c => c.name).join(' + ')}`);
            await Promise.all(clickers.map(async c => {
              await c.page.click('#bunco-btn');
              const btn = c.page.locator('#bunco-picker-list .bunco-picker-player', { hasText: roller });
              // A second phone may see the Bunco already claimed (its tap becomes an undo)
              if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) await btn.click();
            }));
          }

          if (firstDone && rng.chance(0.7)) {
            firstDone = false;
            const callers = at.length > 1 && rng.chance(0.3) ? at.slice(0, 2) : [rng.pick(at)];
            await Promise.all(callers.map(c => c.page.click('#call-game-btn')));
          }

          // Someone looks at the score and submits; sometimes two phones do
          const delay = rng.chance(0.15) ? rng.int(0, 300) : rng.int(300, 2000);
          await sleep(delay);
          const submitters = at.length > 1 && rng.chance(0.2) ? at.slice(0, 2) : [rng.pick(at)];
          note(`r${round} t${tableId}: target ${target.us}-${target.them}, submit after ${delay}ms by ${submitters.map(s => s.name).join(' + ')}`);
          await Promise.all(submitters.map(s => s.page.click('#submit-scores-btn').catch(() => {})));
        };

        const ghostOnly = [];
        for (let t = 1; t <= sc.tables; t++) {
          if (!devices.some(d => assignments[d.id]?.tableId === t)) ghostOnly.push(t);
        }
        await Promise.all(Array.from({ length: sc.tables }, (_, i) => playTable(i + 1)));

        // Ghost-only tables the app didn't auto-submit: the host types scores
        const after = await read(request, `games/${code}/rounds/${round}/tables`);
        for (const t of ghostOnly) {
          if (after?.[t]?.submitted) continue;
          const tab = await openStandings();
          const us = rng.int(0, 21), them = us === 21 ? rng.int(0, 20) : 21;
          await tab.fill(`input[data-table="${t}"][data-side="us"]`, String(us));
          await tab.fill(`input[data-table="${t}"][data-side="them"]`, String(them));
          await tab.click(`button[data-table="${t}"]`);
          note(`r${round} t${t}: host typed ghost table ${us}-${them}`);
          expected[round][t] = { ghostTyped: { us, them } };
        }

        // Advance: game page, standings page, or both at once (the 3UJV pattern)
        await expect.poll(async () => {
          const tb = await read(request, `games/${code}/rounds/${round}/tables`);
          return Array.from({ length: sc.tables }, (_, i) => !!tb?.[i + 1]?.submitted).every(Boolean);
        }, { timeout: 20_000 }).toBe(true).catch(() => runtime.push(`round ${round}: not every table shows submitted`));

        const mode = sc.hostPlays ? rng.pick(['game', 'game', 'standings', 'both']) : 'standings';
        note(`r${round}: host advances from ${mode}`);
        const fromGame = async () => {
          const btn = session.hostPage.locator('#br-start-next-btn');
          await expect(btn).toBeEnabled({ timeout: 20_000 });
          await btn.click();
        };
        const fromStandings = async () => {
          const tab = await openStandings();
          const btn = tab.locator('#advance-round-btn');
          await expect(btn).toBeEnabled({ timeout: 20_000 });
          await btn.click();
        };
        try {
          if (mode === 'game') await fromGame();
          else if (mode === 'standings') await fromStandings();
          else await Promise.all([fromGame(), fromStandings()]);
        } catch (err) {
          runtime.push(`round ${round}: host could not advance from ${mode} (${err.message.split('\n')[0]})`);
          break;
        }

        await expect.poll(() => read(request, `games/${code}/meta/currentRound`), { timeout: 20_000 })
          .toBe(round + 1).catch(() => runtime.push(`round ${round}: currentRound never reached ${round + 1}`));
      }

      // Ghost tables the host typed: what was typed must be what was saved
      const game = await read(request, `games/${code}`);
      for (const [r, tables] of Object.entries(expected)) {
        for (const [t, e] of Object.entries(tables)) {
          if (!e.ghostTyped) continue;
          const tb = game.rounds[r].tables[t];
          if (tb.usScore !== e.ghostTyped.us || tb.themScore !== e.ghostTyped.them) {
            runtime.push(`round ${r} table ${t}: host typed ghost score ${e.ghostTyped.us}-${e.ghostTyped.them}, saved ${tb.usScore}-${tb.themScore}`);
          }
          delete tables[t];
        }
      }
      const events = Object.values((await read(request, `games/${code}/events`)) || {});
      const violations = [...runtime, ...checkGame(game, events, expected)];

      mkdirSync('sim/results/games', { recursive: true });
      writeFileSync(`sim/results/games/seed-${seed}.json`, JSON.stringify({ seed, code, violations, log, game, events }, null, 1));
      expect(violations, log.join('\n')).toEqual([]);
    } finally {
      await closeGameContexts(session);
    }
  });
}
