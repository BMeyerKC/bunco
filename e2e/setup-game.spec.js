import { test, expect } from "@playwright/test";
import {
  createGameAndStartRound,
  closeGameContexts,
} from "./actions/setup-tables.js";

test("host can start round 1 with two tables, 8 players", async ({
  browser,
  baseURL,
}) => {
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 8,
    ghosts: 0,
  });

  try {
    await expect(session.hostPage).toHaveURL(/standings\.html\?code=/);
    await expect(session.playerPages[0].locator("#round-label")).toHaveText(
      /Round 1 of 6/,
    );
  } finally {
    await closeGameContexts(session);
  }
});

test("host can start round 1 with two tables, 1 player, 7 ghosts", async ({
  browser,
  baseURL,
}) => {
  const session = await createGameAndStartRound({
    browser,
    baseURL,
    tables: 2,
    playerCount: 1,
    ghosts: 7,
  });

  try {
    await expect(session.hostPage).toHaveURL(/standings\.html\?code=/);
    await expect(session.playerPages[0].locator("#round-label")).toHaveText(
      /Round 1 of 6/,
    );
  } finally {
    await closeGameContexts(session);
  }
});
