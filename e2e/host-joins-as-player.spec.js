import { test, expect } from "@playwright/test";
import {
  createGameAndStartRound,
  closeGameContexts,
} from "./actions/setup-tables.js";

test("host join form appears and submitting adds host to player list", async ({
  browser,
  baseURL,
}) => {
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();

  try {
    await hostPage.goto(`${baseURL}/index.html`);
    await hostPage.click('a:has-text("Host Game")');
    await hostPage.locator("#view-setup").waitFor({ state: "visible" });
    await hostPage.click("#create-game-btn");
    await hostPage.locator("#view-waiting").waitFor({ state: "visible" });

    // Form should be visible for a host with no player ID
    await expect(hostPage.locator("#host-join-player")).toBeVisible();

    // Fill and submit
    await hostPage.fill("#host-join-name", "Alice");
    await hostPage.click("#host-join-btn");

    // Form should disappear
    await expect(hostPage.locator("#host-join-player")).toBeHidden();

    // Alice should appear in the player list
    await expect(
      hostPage.locator("#waiting-player-list .player-chip", { hasText: "Alice" })
    ).toBeVisible();
  } finally {
    await hostContext.close();
  }
});

test("host who joined as player goes to scoring view when round starts", async ({
  browser,
  baseURL,
}) => {
  // 2 tables, 8 total seats: 7 separate players + host as the 8th
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 7,
    ghosts: 0,
    hostPlayerName: "HostPlayer",
  });

  try {
    // Host device should land on scoring, not standings
    await expect(session.hostPage.locator("#view-scoring")).toBeVisible();
    await expect(session.hostPage.locator("#round-label")).toHaveText(
      /Round 1 of 6/,
    );
  } finally {
    await closeGameContexts(session);
  }
});
