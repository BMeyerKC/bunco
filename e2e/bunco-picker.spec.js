import { test, expect } from "@playwright/test";
import {
  createGameAndStartRound,
  closeGameContexts,
} from "./actions/setup-tables.js";

// Sum of all 🎲N badges in the between-rounds standings list.
async function buncoTotal(page) {
  const text = await page.locator("#br-standings-list").innerText();
  let total = 0;
  for (const match of text.matchAll(/🎲(\d+)/g)) total += Number(match[1]);
  return total;
}

// Submit on every page still showing the scoring view (the two human players
// may share a table, in which case one submit covers both), then wait for all
// of them to reach the between-rounds view.
async function submitRound(pages) {
  for (const page of pages) {
    if (await page.locator("#view-scoring").isVisible()) {
      await page
        .click("#submit-scores-btn", { timeout: 3000 })
        .catch(() => {});
    }
  }
  for (const page of pages) {
    await page.locator("#view-between-rounds").waitFor({ state: "visible" });
  }
}

// Reads back a seated device's actual table number (seating is randomized,
// so this can't be assumed from setup params — see #waiting-seat-table,
// populated once random seating completes).
async function tableOf(page) {
  const seat = page.locator("#waiting-seat-table");
  await expect(seat).toContainText(/Table \d+/);
  return Number((await seat.textContent()).match(/\d+/)[0]);
}

// Reads back a seated device's teammate name (same side, same table),
// blank/em-dash if their teammate seat is a ghost.
async function teammateOf(page) {
  await expect(page.locator("#waiting-seat-table")).toContainText(/Table \d+/);
  return (await page.locator("#waiting-seat-teammate").textContent()).trim();
}

// 2 tables (the UI's minimum) with 5 real players (host + 4) + 3 ghosts = 8
// seats. Randomized seating can't spread 5 humans evenly across 2 tables of
// 4 without at least one table having 2+ humans on the same side (pigeonhole:
// e.g. a 4-human table always has 2 same-side pairs; a 3-human table always
// has >=1) — so a human teammate pair always exists; we find it by reading
// back the actual seat assignment. This has to be a *teammate* pair, not
// just a same-table pair: rotation keeps a table's winning side and a
// table's losing side together as pairs into round 2 (each side moves or
// stays as a unit — see calculateNextRoundSeating), but two opponents at the
// same table can end up split across different round-2 tables.
test("bunco picker: player select, per-table lockout, round call, re-enable next round", async ({
  browser,
  baseURL,
}) => {
  // Two full UI rounds against live Firebase — needs more than the 120s default.
  test.setTimeout(240000);
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 4,
    ghosts: 3,
    hostPlayerName: "Host",
  });
  const { hostPage } = session;
  const devices = [
    { name: "Host", page: hostPage },
    ...session.players.map((p) => ({ name: p.name, page: p.page })),
  ];

  try {
    const teammates = new Map();
    for (const device of devices) {
      teammates.set(device.name, await teammateOf(device.page));
    }
    let deviceA = null;
    let deviceB = null;
    for (const device of devices) {
      const partner = devices.find((d) => d.name === teammates.get(device.name));
      if (partner) {
        deviceA = device;
        deviceB = partner;
        break;
      }
    }
    expect(deviceA).toBeTruthy();
    const pageA = deviceA.page;
    const pageB = deviceB.page;

    // ── Round 1: both devices on scoring ──
    await expect(pageA.locator("#view-scoring")).toBeVisible();
    await expect(pageB.locator("#view-scoring")).toBeVisible();

    // Open picker: 4 players at the table, Cancel is free
    await pageA.click("#bunco-btn", { timeout: 10000 });
    await expect(pageA.locator("#bunco-picker")).toBeVisible();
    await expect(
      pageA.locator("#bunco-picker-list .bunco-picker-player"),
    ).toHaveCount(4);
    await pageA.click("#bunco-picker-cancel", { timeout: 10000 });
    await expect(pageA.locator("#bunco-picker")).toBeHidden();
    await expect(pageA.locator("#bunco-btn")).toBeEnabled();
    await expect(pageA.locator("#game-called-banner")).toBeHidden();

    // Confirm a bunco for deviceA (a human — ghosts don't appear in the
    // between-rounds standings list, which we assert on below)
    await pageA.click("#bunco-btn", { timeout: 10000 });
    await pageA
      .locator("#bunco-picker-list .bunco-picker-player", {
        hasText: deviceA.name,
      })
      .click({ timeout: 10000 });
    await expect(pageA.locator("#bunco-picker")).toBeHidden();
    await expect(pageA.locator("#bunco-overlay")).toHaveClass(/playing/);

    // Winner device: button relabeled to show the claimant + Undo (still
    // tappable — a claim can be undone), bunco-flavored banner shown
    await expect(pageA.locator("#bunco-btn")).toBeEnabled();
    await expect(pageA.locator("#bunco-btn")).toHaveText(
      `🎲 ${deviceA.name} — Undo`,
    );
    await expect(pageA.locator("#game-called-banner")).toBeVisible();
    await expect(pageA.locator("#game-called-banner")).toHaveText(
      "🎲 BUNCO! — finish your rolls and submit",
    );

    // Other device at the same table: same claimant shown, same banner
    await expect(pageB.locator("#bunco-btn")).toBeEnabled();
    await expect(pageB.locator("#bunco-btn")).toHaveText(
      `🎲 ${deviceA.name} — Undo`,
    );
    await expect(pageB.locator("#game-called-banner")).toBeVisible();
    await expect(pageB.locator("#game-called-banner")).toHaveText(
      "🎲 BUNCO! — finish your rolls and submit",
    );

    // Submit round 1 → between-rounds shows exactly one bunco credited
    await submitRound([hostPage, ...session.playerPages]);
    expect(await buncoTotal(hostPage)).toBe(1);

    // ── Round 2: buttons re-enable, banner resets ──
    // #br-start-next-btn is host-only (hidden for everyone else) — only
    // hostPage is guaranteed to have it, regardless of which two devices
    // pageA/pageB turned out to be.
    await expect(hostPage.locator("#br-start-next-btn")).toHaveText(
      "Start Round 2",
    );
    await expect(hostPage.locator("#br-start-next-btn")).toBeEnabled();
    await hostPage.click("#br-start-next-btn", { timeout: 10000 });

    await expect(pageA.locator("#view-scoring")).toBeVisible();
    await expect(pageB.locator("#view-scoring")).toBeVisible();
    await expect(pageA.locator("#bunco-btn")).toBeEnabled();
    await expect(pageB.locator("#bunco-btn")).toBeEnabled();
    await expect(pageA.locator("#game-called-banner")).toBeHidden();
    await expect(pageB.locator("#game-called-banner")).toBeHidden();

    // ── Race: both devices confirm at the same time; exactly one wins ──
    await pageA.click("#bunco-btn", { timeout: 10000 });
    await pageB.click("#bunco-btn", { timeout: 10000 });
    await expect(pageA.locator("#bunco-picker")).toBeVisible();
    await expect(pageB.locator("#bunco-picker")).toBeVisible();
    // Each device credits its own human player so the winning credit is
    // visible in the standings either way. Two valid outcomes per device:
    // its confirm lands (transaction decides the winner; the loser toasts),
    // or the winner's claim syncs first and auto-closes its picker before
    // the click can dispatch — so a click may reject; at least one must land.
    const raceClicks = await Promise.allSettled([
      pageA
        .locator("#bunco-picker-list .bunco-picker-player", {
          hasText: deviceA.name,
        })
        .click({ timeout: 5000 }),
      pageB
        .locator("#bunco-picker-list .bunco-picker-player", {
          hasText: deviceB.name,
        })
        .click({ timeout: 5000 }),
    ]);
    expect(raceClicks.some((r) => r.status === "fulfilled")).toBe(true);

    // Both pickers end up closed regardless of who won
    await expect(pageA.locator("#bunco-picker")).toBeHidden();
    await expect(pageB.locator("#bunco-picker")).toBeHidden();

    // Both devices see a claimant + Undo either way (shared per-table state)
    await expect(pageA.locator("#bunco-btn")).toHaveText(/— Undo$/);
    await expect(pageB.locator("#bunco-btn")).toHaveText(/— Undo$/);

    // Submit round 2 → cumulative buncos must be 2 (not 3): the race
    // produced exactly one new credit.
    await submitRound([hostPage, ...session.playerPages]);
    expect(await buncoTotal(hostPage)).toBe(2);
  } finally {
    await closeGameContexts(session);
  }
});

// 2 tables, host + 4 real players + 3 ghosts = 8 seats. 5 real players can't
// all fit at one table (capacity 4), so randomized seating always puts at
// least one real player on each table — letting the test find two devices
// on different tables regardless of the draw, without needing to control
// seating directly.
test("bunco picker: different tables record buncos independently", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 4,
    ghosts: 3,
    hostPlayerName: "Host",
  });
  const { hostPage } = session;

  try {
    const hostTable = await tableOf(hostPage);
    let otherPlayer = null;
    for (const player of session.players) {
      if ((await tableOf(player.page)) !== hostTable) {
        otherPlayer = player;
        break;
      }
    }
    expect(otherPlayer).not.toBeNull();
    const otherPage = otherPlayer.page;

    await expect(hostPage.locator("#view-scoring")).toBeVisible();
    await expect(otherPage.locator("#view-scoring")).toBeVisible();

    // Host's table claims a bunco.
    await hostPage.click("#bunco-btn", { timeout: 10000 });
    await hostPage
      .locator("#bunco-picker-list .bunco-picker-player", { hasText: "Host" })
      .click({ timeout: 10000 });
    await expect(hostPage.locator("#bunco-btn")).toHaveText("🎲 Host — Undo");

    // The other table is unaffected — its own table hasn't claimed yet, so
    // its button still shows the plain BUNCO! label (pre-fix, this would
    // already be locked).
    await expect(otherPage.locator("#bunco-btn")).toHaveText("🎲 BUNCO!");

    // The other table independently claims its own bunco.
    await otherPage.click("#bunco-btn", { timeout: 10000 });
    await otherPage
      .locator("#bunco-picker-list .bunco-picker-player", {
        hasText: otherPlayer.name,
      })
      .click({ timeout: 10000 });
    await expect(otherPage.locator("#bunco-btn")).toHaveText(
      `🎲 ${otherPlayer.name} — Undo`,
    );

    // Both tables' claims survive — standings show 2 credited buncos, not 1
    // (pre-fix, the second table's claim was silently rejected game-wide).
    await submitRound([hostPage, ...session.playerPages]);
    expect(await buncoTotal(hostPage)).toBe(2);
  } finally {
    await closeGameContexts(session);
  }
});

// 2 tables (the UI's minimum), 8 real players, no ghosts — every seat is a
// human, so any two players sharing a table (found via tableOf) work; the
// picker lists both sides of a table, not just teammates.
test("bunco undo: clears a mis-recorded claim and lets the table re-record for someone else", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(240000);
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 7,
    ghosts: 0,
    // A host-only device (not also seated) auto-redirects to standings.html
    // once the round starts — buncoTotal/submitRound below need hostPage on
    // game.html's between-rounds view instead, same as the other two tests.
    hostPlayerName: "Host",
  });
  const { hostPage } = session;

  const tables = new Map();
  for (const player of session.players) {
    const t = await tableOf(player.page);
    if (!tables.has(t)) tables.set(t, []);
    tables.get(t).push(player);
  }
  const [claimant, undoer] = [...tables.values()].find((ps) => ps.length >= 2);

  try {
    await expect(claimant.page.locator("#view-scoring")).toBeVisible();

    // Wrong player picked by accident.
    await claimant.page.click("#bunco-btn", { timeout: 10000 });
    await claimant.page
      .locator("#bunco-picker-list .bunco-picker-player", {
        hasText: claimant.name,
      })
      .click({ timeout: 10000 });
    await expect(claimant.page.locator("#bunco-btn")).toHaveText(
      `🎲 ${claimant.name} — Undo`,
    );
    await expect(undoer.page.locator("#game-called-banner")).toBeVisible();

    // Any player at the table can undo it — not host-gated.
    await undoer.page.click("#bunco-btn", { timeout: 10000 });
    await expect(undoer.page.locator("#bunco-btn")).toHaveText("🎲 BUNCO!");
    await expect(claimant.page.locator("#bunco-btn")).toHaveText(
      "🎲 BUNCO!",
    );
    await expect(claimant.page.locator("#game-called-banner")).toBeHidden();

    // Re-record for the right player.
    await undoer.page.click("#bunco-btn", { timeout: 10000 });
    await undoer.page
      .locator("#bunco-picker-list .bunco-picker-player", {
        hasText: undoer.name,
      })
      .click({ timeout: 10000 });
    await expect(undoer.page.locator("#bunco-btn")).toHaveText(
      `🎲 ${undoer.name} — Undo`,
    );

    // Exactly one bunco credited — the undone claim didn't double-count.
    await submitRound([hostPage, ...session.playerPages]);
    expect(await buncoTotal(hostPage)).toBe(1);
  } finally {
    await closeGameContexts(session);
  }
});
