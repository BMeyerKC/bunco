import { expect } from "@playwright/test";

const selectors = {
  hostLink: 'a:has-text("Host a game night")',
  setupView: "#view-setup",
  playersInput: "#setup-players",
  tablesSelect: "#setup-tables",
  ghostsSelect: "#setup-ghosts",
  createButton: "#create-game-btn",
  waitingView: "#view-waiting",
  waitingCode: "#waiting-code",
  waitingCount: "#waiting-count",
  waitingTotal: "#waiting-total",
  joinName: "#join-name",
  joinButton: "#join-btn",
  randomSeatButton: "#random-seat-btn",
  hostSeatCard: "#host-seat-layout [data-table-card]",
  startRoundButton: "#start-round-btn",
  scoringView: "#view-scoring",
  roundLabel: "#round-label",
  hostJoinPlayer: "#host-join-player",
  hostJoinName: "#host-join-name",
  hostJoinBtn: "#host-join-btn",
};

// Short enough that "Player N <runId>" always fits #join-name's
// maxlength="20" — a longer id gets silently truncated by the browser,
// breaking any exact name match against the untruncated JS string.
function buildRunId() {
  return Date.now().toString(36);
}

// Host setup asks for a headcount; the page derives tables + ghost seats.
// Every combination the specs use (2 tables, 0–7 ghosts) maps to a headcount
// of tables*4 - ghosts, which the page turns back into the same layout.
async function setHeadcount(hostPage, tables, ghosts) {
  const players = hostPage.locator(selectors.playersInput);
  await players.waitFor({ state: "visible" });
  await players.fill(String(tables * 4 - ghosts));
  await players.dispatchEvent("change");
  await expect(hostPage.locator(selectors.tablesSelect)).toHaveValue(String(tables));
  await expect(hostPage.locator(selectors.ghostsSelect)).toHaveValue(String(ghosts));
}

async function createPlayerSession({
  browser,
  baseURL,
  gameCode,
  index,
  runId,
}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const name = `Player ${index + 1} ${runId}`;

  await page.goto(`${baseURL}/game.html?code=${gameCode}`);
  await page.fill(selectors.joinName, name);
  await page.click(selectors.joinButton);
  await page.locator(selectors.waitingView).waitFor({ state: "visible" });

  return { index, name, context, page };
}

export async function createGameAndStartRound({
  browser,
  baseURL,
  tables = 2,
  playerCount = 8,
  ghosts = 0,
  hostPlayerName = null,
}) {
  const runId = buildRunId();
  const totalSeats = tables * 4 - ghosts;
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();

  await hostPage.goto(`${baseURL}/index.html`);
  await hostPage.click(selectors.hostLink);
  await hostPage.locator(selectors.setupView).waitFor({ state: "visible" });
  await setHeadcount(hostPage, tables, ghosts);
  await hostPage.click(selectors.createButton);

  await hostPage.locator(selectors.waitingView).waitFor({ state: "visible" });
  const codeText = await hostPage.locator(selectors.waitingCode).textContent();
  const gameCode = (codeText || "").trim();
  expect(gameCode).toMatch(/^[A-Z0-9]{4}$/);

  if (hostPlayerName) {
    await hostPage.locator(selectors.hostJoinPlayer).waitFor({ state: "visible" });
    await hostPage.fill(selectors.hostJoinName, hostPlayerName);
    await hostPage.click(selectors.hostJoinBtn);
    await hostPage.locator(selectors.hostJoinPlayer).waitFor({ state: "hidden" });
  }

  const playerContexts = [];
  const playerPages = [];
  const players = [];

  for (let i = 0; i < playerCount; i += 1) {
    const player = await createPlayerSession({
      browser,
      baseURL,
      gameCode,
      index: i,
      runId,
    });
    playerContexts.push(player.context);
    playerPages.push(player.page);
    players.push(player);
  }

  const expectedCount = playerCount + (hostPlayerName ? 1 : 0);
  await expect(hostPage.locator(selectors.waitingCount)).toHaveText(
    String(expectedCount),
  );
  await expect(hostPage.locator(selectors.waitingTotal)).toHaveText(
    String(totalSeats),
  );

  await hostPage.click(selectors.randomSeatButton);
  await hostPage.locator(selectors.hostSeatCard).first().waitFor();

  await expect(hostPage.locator(selectors.startRoundButton)).toBeEnabled();
  await hostPage.click(selectors.startRoundButton);

  if (playerPages.length > 0) {
    const firstPlayerPage = playerPages[0];
    await expect(firstPlayerPage.locator(selectors.scoringView)).toBeVisible();
    await expect(firstPlayerPage.locator(selectors.roundLabel)).toHaveText(
      /Round 1 of 6/,
    );
  } else if (hostPlayerName) {
    await expect(hostPage.locator(selectors.scoringView)).toBeVisible();
    await expect(hostPage.locator(selectors.roundLabel)).toHaveText(
      /Round 1 of 6/,
    );
  }

  return {
    gameCode,
    hostContext,
    hostPage,
    playerContexts,
    playerPages,
    players,
  };
}

export async function closeGameContexts(session) {
  const extraContexts = session.players
    ? session.players.map((player) => player.context)
    : session.playerContexts;
  const contexts = [session.hostContext, ...(extraContexts || [])].filter(
    Boolean,
  );
  await Promise.all(contexts.map((context) => context.close()));
}
