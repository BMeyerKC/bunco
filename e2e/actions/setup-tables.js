import { expect } from "@playwright/test";

const selectors = {
  hostLink: 'a:has-text("Host Game")',
  setupView: "#view-setup",
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

function buildRunId() {
  const random = Math.random().toString(36).slice(2, 6);
  return `${Date.now()}-${random}`;
}

async function selectGhosts(hostPage, ghosts) {
  const ghostValue = String(ghosts);
  const ghostSelect = hostPage.locator(selectors.ghostsSelect);
  await ghostSelect.waitFor({ state: "visible" });
  await expect(ghostSelect).toBeEnabled();
  await hostPage.waitForFunction((value) => {
    const select = document.querySelector("#setup-ghosts");
    if (!select) return false;
    return Array.from(select.options).some((option) => option.value === value);
  }, ghostValue);
  await ghostSelect.evaluate((select, value) => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, ghostValue);
  await expect(ghostSelect).toHaveValue(ghostValue);
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
  await hostPage.selectOption(selectors.tablesSelect, String(tables));
  await selectGhosts(hostPage, ghosts);
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

  const firstPlayerPage = playerPages[0];
  await expect(firstPlayerPage.locator(selectors.scoringView)).toBeVisible();
  await expect(firstPlayerPage.locator(selectors.roundLabel)).toHaveText(
    /Round 1 of 6/,
  );

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
