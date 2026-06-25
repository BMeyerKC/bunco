import { test, expect } from "@playwright/test";
import {
  createGameAndStartRound,
  closeGameContexts,
} from "./actions/setup-tables.js";

// 2 tables, host is the only real player, 7 ghosts fill remaining seats.
// Ghost-only table is auto-submitted at round start, so only the host submits.
test("full round cycle: submitting scores advances through between-rounds to round 2", async ({
  browser,
  baseURL,
}) => {
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 0,
    ghosts: 7,
    hostPlayerName: "Host",
  });

  try {
    // Round 1 — host on scoring view
    await expect(session.hostPage.locator("#view-scoring")).toBeVisible();
    await expect(session.hostPage.locator("#round-label")).toHaveText(
      /Round 1 of 6/,
    );

    // Submit scores (0-0; no score validation is enforced).
    // Due to Firebase optimistic writes, the host may skip view-submitted and
    // land directly on view-between-rounds — both paths are valid.
    await session.hostPage.click("#submit-scores-btn");
    await session.hostPage
      .locator("#view-between-rounds")
      .waitFor({ state: "visible" });

    // Button is initially "Preparing…" while next-round Firebase writes complete,
    // then flips to "Start Round 2" and enables.
    await expect(session.hostPage.locator("#br-start-next-btn")).toHaveText(
      "Start Round 2",
    );
    await expect(session.hostPage.locator("#br-start-next-btn")).toBeEnabled();

    // Start round 2
    await session.hostPage.click("#br-start-next-btn");

    // With only one real player, the host is always at a non-ghost table in
    // round 2, so they land on the scoring view.
    await expect(session.hostPage.locator("#view-scoring")).toBeVisible();
    await expect(session.hostPage.locator("#round-label")).toHaveText(
      /Round 2 of 6/,
    );
  } finally {
    await closeGameContexts(session);
  }
});
