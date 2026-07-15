# Host Origin Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture the IP address and resolved city/region/country of the client that creates a game, store it separately from the public event log, and surface it as a new column in the admin dashboard's Recent Games table.

**Architecture:** A new pure module (`geo.js`) calls a free IP-geolocation API from the browser and maps the response to a fixed shape. `game-controller.js` fires this off (best-effort, non-blocking) right after a game is created, writing the result to a new Firebase path (`originAudits/{code}`) via a new `firebase.js` function. The admin dashboard reads that path alongside existing game data and joins it in by game code for display.

**Tech Stack:** Vanilla JS (Astro static site), Firebase Realtime Database, native `fetch`, Jest for unit tests.

## Global Constraints

- Run Jest via `npm test`, never `npx jest` directly — plain `npx jest` fails on this project's ESM imports.
- No new npm dependencies. `captureOrigin()` uses native `fetch`; no SDK.
- Geo endpoint is exactly `https://ipapi.co/json/` (no API key).
- New Firebase path is `originAudits/{code}`, a sibling to `games/{code}`, not nested under it.
- The geo capture call must be fire-and-forget: never blocks `handleCreateGame`, never surfaces an error to the host. Use `.catch(() => {})`, matching the existing `logEvent(...).catch(() => {})` pattern already in that function.
- `originAudits` Firebase rule: `.read: true` at the path level, `$code: { .write: true }` — same no-auth trust model as `games` (see Task 6).
- Controller files (`game-controller.js`, `admin-controller.js`) have no existing Jest coverage in this codebase (DOM-driven, covered by Playwright e2e only) — follow that precedent rather than introducing new unit-test infrastructure for them.

---

### Task 1: `captureOrigin()` geo lookup helper

**Files:**
- Create: `src/js/geo.js`
- Test: `tests/geo.test.js`

**Interfaces:**
- Produces: `captureOrigin(): Promise<{ ip: string|null, city: string|null, region: string|null, country: string|null }>` — resolves with the mapped shape on a successful HTTP response; rejects (throws) on a non-OK HTTP response or network failure. Caller is responsible for catching.

- [ ] **Step 1: Write the failing test**

Create `tests/geo.test.js`:

```js
import { captureOrigin } from '../src/js/geo.js';

describe('captureOrigin', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('maps a successful response to the expected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ip: '203.0.113.42',
        city: 'Kansas City',
        region: 'Missouri',
        country_name: 'United States',
      }),
    });

    const result = await captureOrigin();

    expect(result).toEqual({
      ip: '203.0.113.42',
      city: 'Kansas City',
      region: 'Missouri',
      country: 'United States',
    });
    expect(global.fetch).toHaveBeenCalledWith('https://ipapi.co/json/');
  });

  test('fills missing fields with null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await captureOrigin();

    expect(result).toEqual({ ip: null, city: null, region: null, country: null });
  });

  test('throws when the response is not OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(captureOrigin()).rejects.toThrow('geo lookup failed: 503');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/geo.test.js`
Expected: FAIL — `Cannot find module '../src/js/geo.js'`

- [ ] **Step 3: Write the implementation**

Create `src/js/geo.js`:

```js
// js/geo.js
export async function captureOrigin() {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`geo lookup failed: ${res.status}`);
  const data = await res.json();
  return {
    ip: data.ip ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    country: data.country_name ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/geo.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/js/geo.js tests/geo.test.js
git commit -m "feat: add captureOrigin geo lookup helper"
```

---

### Task 2: `logGameOrigin` / `getOriginAudits` in `firebase.js`

**Files:**
- Modify: `src/js/firebase.js:242-244` (insert new section between `watchEvents` and the `─── Admin ───` comment)
- Test: `tests/firebase-origin.test.js`

**Interfaces:**
- Consumes: existing `db`, `ref`, `set`, `get`, `serverTimestamp`, `logSend`, `logReceive` (already defined/imported in `firebase.js` — no new imports needed)
- Produces:
  - `logGameOrigin(code: string, origin: { ip, city, region, country }): Promise<void>` — writes to `originAudits/{code}`
  - `getOriginAudits(): Promise<Record<string, { ip, city, region, country, capturedAt }>>` — reads all of `originAudits`, returns `{}` if empty

- [ ] **Step 1: Write the failing test**

Create `tests/firebase-origin.test.js`:

```js
import { logGameOrigin, getOriginAudits } from '../src/js/firebase.js';

describe('logGameOrigin', () => {
  test('resolves without throwing', async () => {
    await expect(
      logGameOrigin('ABCD', { ip: '1.2.3.4', city: 'X', region: 'Y', country: 'Z' })
    ).resolves.toBeUndefined();
  });
});

describe('getOriginAudits', () => {
  test('returns an empty object when there is no data', async () => {
    const result = await getOriginAudits();
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/firebase-origin.test.js`
Expected: FAIL — `logGameOrigin is not a function` (export doesn't exist yet)

- [ ] **Step 3: Write the implementation**

In `src/js/firebase.js`, insert this new section between the end of `watchEvents` (line 242, `}`) and the `// ─── Admin ───` comment (line 244):

```js
// ─── Origin analytics ───────────────────────────────────────

export async function logGameOrigin(code, origin) {
  logSend(`originAudits/${code}`, origin);
  await set(ref(db, `originAudits/${code}`), { ...origin, capturedAt: serverTimestamp() });
}

export async function getOriginAudits() {
  const snap = await get(ref(db, 'originAudits'));
  const result = snap.val() || {};
  logReceive('originAudits', `${Object.keys(result).length} records`);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/firebase-origin.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/js/firebase.js tests/firebase-origin.test.js
git commit -m "feat: add logGameOrigin/getOriginAudits to firebase.js"
```

---

### Task 3: `buildGameRows` location join

**Files:**
- Modify: `src/js/game-logic.js:159-174` (JSDoc + `buildGameRows`)
- Modify: `tests/game-logic.test.js:280-283` (update existing `toEqual` assertion) and add new tests

**Interfaces:**
- Consumes: nothing new — pure function
- Produces: `buildGameRows(games, origins = {}): Array<{ code, createdAt, status, playerCount, location: string|null }>` — `location` is the joined-in city/region (or country fallback, or `null`) for each game's code, looked up in `origins`

- [ ] **Step 1: Update the existing test and add new failing tests**

In `tests/game-logic.test.js`, replace the `'tolerates missing meta and players'` test (currently lines 280-283):

```js
  test('tolerates missing meta and players', () => {
    const rows = buildGameRows([{ code: 'BARE' }]);
    expect(rows[0]).toEqual({ code: 'BARE', createdAt: 0, status: 'Unknown', playerCount: 0 });
  });
```

with:

```js
  test('tolerates missing meta and players', () => {
    const rows = buildGameRows([{ code: 'BARE' }]);
    expect(rows[0]).toEqual({ code: 'BARE', createdAt: 0, status: 'Unknown', playerCount: 0, location: null });
  });
```

Then add a new `describe` block immediately after the existing `describe('buildGameRows', ...)` block (i.e. after its closing `});` at what is currently line 289):

```js
describe('buildGameRows location join', () => {
  const game = (code, createdAt) => ({
    code,
    meta: { currentRound: 0, gameCalledBy: null, createdAt },
    players: {},
  });

  test('joins city and region when both are present', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: 'Kansas City', region: 'Missouri', country: 'United States' } }
    );
    expect(rows[0].location).toBe('Kansas City, Missouri');
  });

  test('falls back to country when city and region are missing', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: null, region: null, country: 'United States' } }
    );
    expect(rows[0].location).toBe('United States');
  });

  test('uses city alone when region is missing', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: 'Kansas City', region: null, country: 'United States' } }
    );
    expect(rows[0].location).toBe('Kansas City');
  });

  test('is null when there is no matching origin record', () => {
    const rows = buildGameRows([game('ABCD', 100)], {});
    expect(rows[0].location).toBeNull();
  });

  test('defaults origins to {} when omitted', () => {
    const rows = buildGameRows([game('ABCD', 100)]);
    expect(rows[0].location).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/game-logic.test.js`
Expected: FAIL — the updated `toEqual` fails (actual object has no `location` key), and the new `describe('buildGameRows location join', ...)` tests fail (`rows[0].location` is `undefined`, not the expected value)

- [ ] **Step 3: Write the implementation**

In `src/js/game-logic.js`, replace the JSDoc + `buildGameRows` function (currently lines 159-174):

```js
/**
 * Shapes raw game records into display rows for the admin dashboard.
 * @param {Array<{ code: string, meta?: object, players?: object }>} games
 * @returns {Array<{ code: string, createdAt: number, status: string, playerCount: number }>}
 *   sorted newest-first by createdAt
 */
export function buildGameRows(games) {
  return (games || [])
    .map(g => ({
      code: g.code,
      createdAt: g.meta?.createdAt ?? 0,
      status: gameStatus(g.meta),
      playerCount: Object.values(g.players || {}).filter(p => !p.isGhost).length,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

with:

```js
/**
 * Shapes raw game records into display rows for the admin dashboard.
 * @param {Array<{ code: string, meta?: object, players?: object }>} games
 * @param {Object<string, { city?: string|null, region?: string|null, country?: string|null }>} [origins]
 *   keyed by game code, e.g. from getOriginAudits()
 * @returns {Array<{ code: string, createdAt: number, status: string, playerCount: number, location: string|null }>}
 *   sorted newest-first by createdAt
 */
export function buildGameRows(games, origins = {}) {
  return (games || [])
    .map(g => {
      const o = origins[g.code];
      const location = o ? ([o.city, o.region].filter(Boolean).join(', ') || o.country || null) : null;
      return {
        code: g.code,
        createdAt: g.meta?.createdAt ?? 0,
        status: gameStatus(g.meta),
        playerCount: Object.values(g.players || {}).filter(p => !p.isGhost).length,
        location,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/game-logic.test.js`
Expected: PASS (all tests, including the 5 new location-join tests and the updated one)

- [ ] **Step 5: Commit**

```bash
git add src/js/game-logic.js tests/game-logic.test.js
git commit -m "feat: join origin location into buildGameRows"
```

---

### Task 4: Wire geo capture into `handleCreateGame`

**Files:**
- Modify: `src/js/game-controller.js:2-11` (imports)
- Modify: `src/js/game-controller.js:77-102` (`handleCreateGame`)

**Interfaces:**
- Consumes: `captureOrigin()` from Task 1 (`geo.js`), `logGameOrigin(code, origin)` from Task 2 (`firebase.js`)
- Produces: no new exports — this task wires existing pieces into the create-game flow

No new automated test: `game-controller.js` is DOM-driven and has no existing Jest coverage in this codebase (verified — only `game-logic.js`/`game-utils.js`/`table-cards.js`/`theme.js` have unit tests). This task is verified via the existing e2e suite plus a manual check.

- [ ] **Step 1: Update imports**

In `src/js/game-controller.js`, replace lines 1-11:

```js
// js/game-controller.js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         saveStandings,
         incrementTableScore, decrementTableScore, watchTableScore, watchAllTableScores, initializeRoundTables,
         EVENT, logEvent } from './firebase.js';
import { generateGameCode, assignRandomSeats,
         calculateNextRoundSeating, determineWinner, updateStandings, buildTableLayout } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId } from './ui.js';
import { renderTableCards } from './table-cards.js';
import { isNameTaken, getAvailableGhostSeats, allTablesSubmitted, pickGhostNames, getGhostOnlyTableIds } from './game-utils.js';
```

with:

```js
// js/game-controller.js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         saveStandings,
         incrementTableScore, decrementTableScore, watchTableScore, watchAllTableScores, initializeRoundTables,
         EVENT, logEvent, logGameOrigin } from './firebase.js';
import { captureOrigin } from './geo.js';
import { generateGameCode, assignRandomSeats,
         calculateNextRoundSeating, determineWinner, updateStandings, buildTableLayout } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId } from './ui.js';
import { renderTableCards } from './table-cards.js';
import { isNameTaken, getAvailableGhostSeats, allTablesSubmitted, pickGhostNames, getGhostOnlyTableIds } from './game-utils.js';
```

- [ ] **Step 2: Add the fire-and-forget capture call**

In `handleCreateGame`, find:

```js
    await createGame(gameCode, deviceId, numTables, ghostSlots);
    logEvent(gameCode, EVENT.GAME_CREATED, { tables: numTables, ghostSlots }).catch(() => {});
```

Replace with:

```js
    await createGame(gameCode, deviceId, numTables, ghostSlots);
    logEvent(gameCode, EVENT.GAME_CREATED, { tables: numTables, ghostSlots }).catch(() => {});
    captureOrigin().then(origin => logGameOrigin(gameCode, origin)).catch(() => {});
```

- [ ] **Step 3: Run the full unit test suite**

Run: `npm test`
Expected: PASS (all existing tests still pass — this change only touches a controller file with no unit coverage)

- [ ] **Step 4: Run the existing game-setup e2e spec**

Run: `npx playwright test e2e/setup-game.spec.js`
Expected: PASS — game creation still completes normally; the geo call is fire-and-forget so it cannot block or fail this flow

- [ ] **Step 5: Manual smoke check**

Run `npm run dev`, open the app, create a game as host. In the browser DevTools Network tab, confirm a request to `https://ipapi.co/json/` fires after game creation (it's fine if it's blocked by an ad blocker — that's the expected best-effort behavior). This is a manual verification step, not an automated one.

- [ ] **Step 6: Commit**

```bash
git add src/js/game-controller.js
git commit -m "feat: capture host origin on game creation"
```

---

### Task 5: Admin dashboard Location column

**Files:**
- Modify: `src/js/admin-controller.js:1-3` (imports)
- Modify: `src/js/admin-controller.js:32-46` (`loadGames`)
- Modify: `src/js/admin-controller.js:63-66` (table header in `renderGames`)
- Modify: `src/js/admin-controller.js:83-98` (row building in `renderGames`)

**Interfaces:**
- Consumes: `getOriginAudits()` from Task 2 (`firebase.js`), `buildGameRows(games, origins)` from Task 3 (`game-logic.js`)
- Produces: no new exports — UI wiring only

No new automated test: `admin-controller.js` has no existing Jest coverage (DOM-driven). `e2e/admin.spec.js` was checked and contains no column-specific assertions on the Recent Games table, so it needs no changes and should continue to pass unmodified.

- [ ] **Step 1: Update imports**

Replace:

```js
import { ensureAdminAccess } from './admin-gate.js';
import { getRecentGames } from './firebase.js';
import { buildGameRows } from './game-logic.js';
```

with:

```js
import { ensureAdminAccess } from './admin-gate.js';
import { getRecentGames, getOriginAudits } from './firebase.js';
import { buildGameRows } from './game-logic.js';
```

- [ ] **Step 2: Fetch origins alongside games**

Replace `loadGames`:

```js
async function loadGames() {
  const listEl = document.getElementById('games-list');
  try {
    const games = await getRecentGames(25);
    const rows  = buildGameRows(games);
    renderStats(rows);
    renderGames(rows, listEl);
  } catch (err) {
    console.error('[admin] failed to load games', err);
    listEl.innerHTML =
      '<p style="color:#dc2626;">Couldn’t load games. ' +
      '<button id="games-retry" class="btn btn-sm btn-outline-secondary ms-2">Retry</button></p>';
    document.getElementById('games-retry').addEventListener('click', loadGames);
  }
}
```

with:

```js
async function loadGames() {
  const listEl = document.getElementById('games-list');
  try {
    const [games, origins] = await Promise.all([getRecentGames(25), getOriginAudits()]);
    const rows = buildGameRows(games, origins);
    renderStats(rows);
    renderGames(rows, listEl);
  } catch (err) {
    console.error('[admin] failed to load games', err);
    listEl.innerHTML =
      '<p style="color:#dc2626;">Couldn’t load games. ' +
      '<button id="games-retry" class="btn btn-sm btn-outline-secondary ms-2">Retry</button></p>';
    document.getElementById('games-retry').addEventListener('click', loadGames);
  }
}
```

- [ ] **Step 3: Add the Location column header**

In `renderGames`, replace:

```js
  table.innerHTML =
    '<thead><tr>' +
    '<th>Code</th><th>Created</th><th>Status</th><th>Players</th><th></th>' +
    '</tr></thead>';
```

with:

```js
  table.innerHTML =
    '<thead><tr>' +
    '<th>Code</th><th>Created</th><th>Status</th><th>Players</th><th>Location</th><th></th>' +
    '</tr></thead>';
```

- [ ] **Step 4: Render the Location cell per row**

Replace:

```js
    const playersTd = document.createElement('td');
    playersTd.textContent = String(row.playerCount);

    const linksTd = document.createElement('td');
```

with:

```js
    const playersTd = document.createElement('td');
    playersTd.textContent = String(row.playerCount);

    const locationTd = document.createElement('td');
    locationTd.style.cssText = 'font-size:var(--fs-small);color:var(--muted);';
    locationTd.textContent = row.location || '—';

    const linksTd = document.createElement('td');
```

And replace:

```js
    tr.append(codeTd, createdTd, statusTd, playersTd, linksTd);
```

with:

```js
    tr.append(codeTd, createdTd, statusTd, playersTd, locationTd, linksTd);
```

- [ ] **Step 5: Run the build to catch syntax errors**

Run: `npm run build`
Expected: build succeeds with no errors (this file has no Jest coverage, so the build is the fastest syntax/reference check)

- [ ] **Step 6: Run the admin e2e spec**

Run: `npx playwright test e2e/admin.spec.js`
Expected: PASS (all existing tests — none assert on exact column count/shape, so the new column doesn't break them)

- [ ] **Step 7: Commit**

```bash
git add src/js/admin-controller.js
git commit -m "feat: show host location column in admin dashboard"
```

---

### Task 6: Production Firebase rules update (manual, requires explicit confirmation)

**This task modifies live production Firebase security rules. Do not run the write step without first confirming with the user, per this project's standing rule on risky/hard-to-reverse actions on shared systems. This is not a task to hand to a subagent to run unattended — perform it directly, in the main session, with the user present.**

**Files:** none in the repo — this is an out-of-band change via the Firebase REST rules endpoint (no `database.rules.json` file exists in this project; see the `bunco-firebase-rules` memory for why).

- [ ] **Step 1: Fetch the current live rules**

Using the CLI-token method documented in the `bunco-firebase-rules` memory (mint an access token from the refresh token in `~/.config/configstore/firebase-tools.json`, then `GET https://bunco-60f5d-default-rtdb.firebaseio.com/.settings/rules.json?access_token=...`), fetch and print the current rules.

- [ ] **Step 2: Confirm no drift from the expected baseline**

Compare the fetched rules against the last-known state:

```json
{
  "rules": {
    "games": {
      ".read": true,
      ".indexOn": ["meta/createdAt"],
      "$code": { ".read": true, ".write": true, ".validate": "newData.hasChildren(['meta'])" }
    }
  }
}
```

If they differ, stop and report the actual current rules to the user before proceeding — do not assume the memory is still accurate.

- [ ] **Step 3: Show the user the exact merged rules to be pushed**

```json
{
  "rules": {
    "games": {
      ".read": true,
      ".indexOn": ["meta/createdAt"],
      "$code": { ".read": true, ".write": true, ".validate": "newData.hasChildren(['meta'])" }
    },
    "originAudits": {
      ".read": true,
      "$code": { ".write": true }
    }
  }
}
```

- [ ] **Step 4: Get explicit user confirmation, then PUT the merged rules**

Only after the user explicitly confirms, `PUT` the merged JSON to `https://bunco-60f5d-default-rtdb.firebaseio.com/.settings/rules.json?access_token=...`.

- [ ] **Step 5: Verify the new rules are live**

Re-run the `GET` from Step 1 and confirm the response now includes the `originAudits` block.

- [ ] **Step 6: Update the `bunco-firebase-rules` memory**

Update `bunco-firebase-rules.md` in the memory system to reflect the new rules JSON (adding `originAudits`) and the date this change was made, so future sessions don't work from stale rules state.

---

## Post-plan verification

- [ ] Run the full test suite once more end-to-end: `npm test`
- [ ] Run the full e2e suite: `npm run e2e`
- [ ] Confirm `git log` shows one commit per task (5 code commits + the Task 6 rules change, which has no repo commit since it's not a file change)
