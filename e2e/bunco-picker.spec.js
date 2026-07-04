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

// 2 tables, host player + 1 real player + 6 ghosts = 8 seats.
// Two connected devices, so cross-device lockout is observable.
test("bunco picker: player select, one-per-round lockout, round call, re-enable next round", async ({
  browser,
  baseURL,
}) => {
  // Two full UI rounds against live Firebase — needs more than the 120s default.
  test.setTimeout(240000);
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 1,
    ghosts: 6,
    hostPlayerName: "Host",
  });
  const { hostPage } = session;
  const playerPage = session.playerPages[0];

  try {
    // ── Round 1: both devices on scoring ──
    await expect(hostPage.locator("#view-scoring")).toBeVisible();
    await expect(playerPage.locator("#view-scoring")).toBeVisible();

    // Open picker: 4 players at the table, Cancel is free
    await hostPage.click("#bunco-btn");
    await expect(hostPage.locator("#bunco-picker")).toBeVisible();
    await expect(
      hostPage.locator("#bunco-picker-list .bunco-picker-player"),
    ).toHaveCount(4);
    await hostPage.click("#bunco-picker-cancel");
    await expect(hostPage.locator("#bunco-picker")).toBeHidden();
    await expect(hostPage.locator("#bunco-btn")).toBeEnabled();
    await expect(hostPage.locator("#game-called-banner")).toBeHidden();

    // Confirm a bunco for the host (a human — ghosts don't appear in the
    // between-rounds standings list, which we assert on below)
    await hostPage.click("#bunco-btn");
    await hostPage
      .locator("#bunco-picker-list .bunco-picker-player", { hasText: "Host" })
      .click();
    await expect(hostPage.locator("#bunco-picker")).toBeHidden();
    await expect(hostPage.locator("#bunco-overlay")).toHaveClass(/playing/);

    // Winner device: locked + bunco-flavored banner
    await expect(hostPage.locator("#bunco-btn")).toBeDisabled();
    await expect(hostPage.locator("#game-called-banner")).toBeVisible();
    await expect(hostPage.locator("#game-called-banner")).toHaveText(
      "🎲 BUNCO! — finish your rolls and submit",
    );

    // Other device: locked out with the same banner
    await expect(playerPage.locator("#bunco-btn")).toBeDisabled();
    await expect(playerPage.locator("#game-called-banner")).toBeVisible();
    await expect(playerPage.locator("#game-called-banner")).toHaveText(
      "🎲 BUNCO! — finish your rolls and submit",
    );

    // Submit round 1 → between-rounds shows exactly one bunco credited
    await submitRound([hostPage, playerPage]);
    expect(await buncoTotal(hostPage)).toBe(1);

    // ── Round 2: buttons re-enable, banner resets ──
    await expect(hostPage.locator("#br-start-next-btn")).toHaveText(
      "Start Round 2",
    );
    await expect(hostPage.locator("#br-start-next-btn")).toBeEnabled();
    await hostPage.click("#br-start-next-btn");

    await expect(hostPage.locator("#view-scoring")).toBeVisible();
    await expect(playerPage.locator("#view-scoring")).toBeVisible();
    await expect(hostPage.locator("#bunco-btn")).toBeEnabled();
    await expect(playerPage.locator("#bunco-btn")).toBeEnabled();
    await expect(hostPage.locator("#game-called-banner")).toBeHidden();
    await expect(playerPage.locator("#game-called-banner")).toBeHidden();

    // ── Race: both devices confirm at the same time; exactly one wins ──
    await hostPage.click("#bunco-btn");
    await playerPage.click("#bunco-btn");
    await expect(hostPage.locator("#bunco-picker")).toBeVisible();
    await expect(playerPage.locator("#bunco-picker")).toBeVisible();
    // Each device credits its own human player so the winning credit is
    // visible in the standings either way. Two valid outcomes per device:
    // its confirm lands (transaction decides the winner; the loser toasts),
    // or the winner's claim syncs first and auto-closes its picker before
    // the click can dispatch — so a click may reject; at least one must land.
    const raceClicks = await Promise.allSettled([
      hostPage
        .locator("#bunco-picker-list .bunco-picker-player", {
          hasText: "Host",
        })
        .click({ timeout: 5000 }),
      playerPage
        .locator("#bunco-picker-list .bunco-picker-player", {
          hasText: session.players[0].name,
        })
        .click({ timeout: 5000 }),
    ]);
    expect(raceClicks.some((r) => r.status === "fulfilled")).toBe(true);

    // Both pickers end up closed regardless of who won
    await expect(hostPage.locator("#bunco-picker")).toBeHidden();
    await expect(playerPage.locator("#bunco-picker")).toBeHidden();

    // Both devices end up locked either way
    await expect(hostPage.locator("#bunco-btn")).toBeDisabled();
    await expect(playerPage.locator("#bunco-btn")).toBeDisabled();

    // Submit round 2 → cumulative buncos must be 2 (not 3): the race
    // produced exactly one new credit.
    await submitRound([hostPage, playerPage]);
    expect(await buncoTotal(hostPage)).toBe(2);
  } finally {
    await closeGameContexts(session);
  }
});
