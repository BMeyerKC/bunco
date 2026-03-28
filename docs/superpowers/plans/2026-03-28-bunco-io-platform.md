# bunco.io Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing single-file Bunco scorer into a full multi-page platform at bunco.io with a quick scorer, full game-night tracking via Firebase, and Google AdSense on non-gameplay pages.

**Architecture:** Multi-page static site (no build step) hosted on GitHub Pages. Bootstrap 5 via CDN for UI. Shared logic in ES modules. Firebase Realtime Database for multi-device session sync with 24-hour TTL. Game logic lives in a pure-function module tested with Jest.

**Tech Stack:** HTML5, Bootstrap 5 CDN, Firebase Realtime Database v9 (modular CDN), vanilla JS ES modules, Jest (dev-only, for game-logic unit tests), Google AdSense

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | Landing page — Bootstrap cards, AdSense banner |
| `scorer.html` | Quick scorer — existing tool with shared CSS |
| `game.html` | All game views: host setup, waiting room, round scoring, between rounds |
| `standings.html` | Live standings between rounds + final standings with AdSense |
| `css/base.css` | Shared dark Bootstrap overrides |
| `js/firebase.js` | Firebase init + all DB read/write helpers |
| `js/game-logic.js` | Pure functions: seat assignment, rotation, standings calc |
| `js/ui.js` | Shared UI helpers: toast notifications, view switching |
| `tests/game-logic.test.js` | Jest unit tests for game-logic.js |
| `package.json` | Jest dev dependency only |

---

## Phase 1: Site Foundation

### Task 1: Project scaffold

**Files:**
- Create: `css/base.css`
- Create: `package.json`
- Create: `js/ui.js`

- [ ] **Step 1: Create `css/base.css`**

```css
/* css/base.css */
:root {
  --bg: #1a1a1a;
  --surface: #242424;
  --border: #444;
  --muted: #888;
  --text: #ffffff;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: Arial, sans-serif;
}

.card {
  background-color: var(--surface);
  border-color: var(--border);
}

.card-title {
  color: var(--text);
}

.card-text {
  color: var(--muted);
}

.btn-outline-light {
  border-color: var(--border);
  color: var(--muted);
}

.btn-outline-light:hover {
  background-color: rgba(255,255,255,0.08);
  color: var(--text);
}

.text-muted {
  color: var(--muted) !important;
}
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "bunco",
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  },
  "jest": {
    "transform": {}
  }
}
```

- [ ] **Step 3: Install Jest**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `js/ui.js`**

```js
// js/ui.js

/**
 * Shows one view div and hides all others.
 * @param {string} viewId - The id of the div to show
 */
export function showView(viewId) {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.style.display = el.id === viewId ? '' : 'none';
  });
}

/**
 * Shows a Bootstrap toast-style notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bunco-toast');
  if (existing) existing.remove();

  const colors = { info: '#0d6efd', success: '#198754', warning: '#ffc107' };
  const toast = document.createElement('div');
  toast.id = 'bunco-toast';
  toast.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: ${colors[type]}; color: #fff; padding: 12px 24px;
    border-radius: 6px; font-size: 1rem; z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * Returns query param value from current URL.
 * @param {string} key
 * @returns {string|null}
 */
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Returns a random device ID, persisted in localStorage.
 * Used to identify the host device.
 * @returns {string}
 */
export function getDeviceId() {
  let id = localStorage.getItem('bunco_device_id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem('bunco_device_id', id);
  }
  return id;
}
```

- [ ] **Step 5: Commit**

```bash
git add css/base.css js/ui.js package.json package-lock.json
git commit -m "feat: project scaffold — base CSS, UI helpers, Jest setup"
```

---

### Task 2: Game logic module (pure functions)

**Files:**
- Create: `js/game-logic.js`
- Create: `tests/game-logic.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/game-logic.test.js
import {
  generateGameCode,
  assignRandomSeats,
  calculateNextRoundSeating,
  determineWinner,
  updateStandings,
} from '../js/game-logic.js';

describe('generateGameCode', () => {
  test('returns a 4-character string', () => {
    expect(generateGameCode()).toHaveLength(4);
  });

  test('only contains valid characters', () => {
    expect(generateGameCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});

describe('assignRandomSeats', () => {
  test('assigns all players to seats', () => {
    const players = ['p1','p2','p3','p4','p5','p6','p7','p8'];
    const result = assignRandomSeats(players, 2);
    expect(Object.keys(result)).toHaveLength(8);
  });

  test('each table has 2 us and 2 them players', () => {
    const players = ['p1','p2','p3','p4'];
    const result = assignRandomSeats(players, 1);
    const us = Object.values(result).filter(a => a.side === 'us');
    const them = Object.values(result).filter(a => a.side === 'them');
    expect(us).toHaveLength(2);
    expect(them).toHaveLength(2);
  });
});

describe('calculateNextRoundSeating', () => {
  // 2-table setup: p1-p4 at table 1, p5-p8 at table 2
  const assignments = {
    p1: { tableId: 1, side: 'us',   seat: 1 },
    p2: { tableId: 1, side: 'us',   seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us',   seat: 1 },
    p6: { tableId: 2, side: 'us',   seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };

  test('losers from table 2 rotate to table 1', () => {
    const results = { 1: { winner: 'us' }, 2: { winner: 'them' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p7, p8 won at table 2 — stay at table 2
    expect(next['p7'].tableId).toBe(2);
    expect(next['p8'].tableId).toBe(2);
    // p5, p6 lost at table 2 — rotate to table 1
    expect(next['p5'].tableId).toBe(1);
    expect(next['p6'].tableId).toBe(1);
  });

  test('losers from table 1 rotate to the last table', () => {
    const results = { 1: { winner: 'them' }, 2: { winner: 'us' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p1, p2 lost at table 1 — rotate to table 2 (last table)
    expect(next['p1'].tableId).toBe(2);
    expect(next['p2'].tableId).toBe(2);
  });

  test('winners split across sides', () => {
    const results = { 1: { winner: 'us' }, 2: { winner: 'us' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p1 and p2 won at table 1 — must be on opposite sides
    expect(next['p1'].side).not.toBe(next['p2'].side);
    // p5 and p6 won at table 2 — must be on opposite sides
    expect(next['p5'].side).not.toBe(next['p6'].side);
  });
});

describe('determineWinner', () => {
  test('us wins when us score is higher', () => {
    expect(determineWinner(21, 10)).toBe('us');
  });

  test('them wins when them score is higher', () => {
    expect(determineWinner(10, 21)).toBe('them');
  });

  test('us wins on tie', () => {
    expect(determineWinner(21, 21)).toBe('us');
  });
});

describe('updateStandings', () => {
  test('increments wins and totalPoints for winning player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 21, themScore: 10, submitted: true } };
    const roundResults = { 1: { winner: 'us' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = {};
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].wins).toBe(1);
    expect(next['p1'].totalPoints).toBe(21);
  });

  test('increments losses for losing player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 5, themScore: 21, submitted: true } };
    const roundResults = { 1: { winner: 'them' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = {};
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].losses).toBe(1);
  });

  test('records buncos for player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 5, themScore: 3, submitted: true } };
    const roundResults = { 1: { winner: 'us' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = { p1: 1 };
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].buncos).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: All tests FAIL with "Cannot find module '../js/game-logic.js'"

- [ ] **Step 3: Write `js/game-logic.js`**

```js
// js/game-logic.js

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateGameCode() {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

/**
 * Assigns playerIds to seats across numTables.
 * Seats: side 'us' or 'them', seat 1 or 2.
 * @param {string[]} playerIds
 * @param {number} numTables
 * @returns {{ [id: string]: { tableId: number, side: string, seat: number } }}
 */
export function assignRandomSeats(playerIds, numTables) {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const result = {};
  shuffled.forEach((id, i) => {
    const tableId = Math.floor(i / 4) + 1;
    const pos = i % 4; // 0=us1, 1=us2, 2=them1, 3=them2
    result[id] = {
      tableId,
      side: pos < 2 ? 'us' : 'them',
      seat: (pos % 2) + 1,
    };
  });
  return result;
}

/**
 * Calculates next-round seating after a round completes.
 * - Losers rotate toward the head table (table 1).
 *   Losers from table 1 go to the last table.
 * - Winners stay but split: one goes to 'us' seat 1, one to 'them' seat 1.
 * - Incoming losers also split: one to 'us' seat 2, one to 'them' seat 2.
 *
 * @param {{ [id: string]: { tableId, side, seat } }} currentAssignments
 * @param {{ [tableId: number]: { winner: 'us'|'them' } }} roundResults
 * @param {number} numTables
 * @returns {{ [id: string]: { tableId: number, side: string, seat: number } }}
 */
export function calculateNextRoundSeating(currentAssignments, roundResults, numTables) {
  const incomingByTable = {};
  const winnersByTable = {};

  for (let tableId = 1; tableId <= numTables; tableId++) {
    const { winner } = roundResults[tableId];
    const loser = winner === 'us' ? 'them' : 'us';

    const winners = Object.entries(currentAssignments)
      .filter(([, a]) => a.tableId === tableId && a.side === winner)
      .map(([id]) => id);

    const losers = Object.entries(currentAssignments)
      .filter(([, a]) => a.tableId === tableId && a.side === loser)
      .map(([id]) => id);

    winnersByTable[tableId] = winners;

    // Losers from table 1 go to last table; others go one table down (toward 1)
    const dest = tableId === 1 ? numTables : tableId - 1;
    incomingByTable[dest] = losers;
  }

  const next = {};
  for (let tableId = 1; tableId <= numTables; tableId++) {
    const [w1, w2] = winnersByTable[tableId] || [];
    const [i1, i2] = incomingByTable[tableId] || [];

    if (w1) next[w1] = { tableId, side: 'us',   seat: 1 };
    if (w2) next[w2] = { tableId, side: 'them',  seat: 1 };
    if (i1) next[i1] = { tableId, side: 'us',   seat: 2 };
    if (i2) next[i2] = { tableId, side: 'them',  seat: 2 };
  }

  return next;
}

/**
 * @param {number} usScore
 * @param {number} themScore
 * @returns {'us'|'them'}
 */
export function determineWinner(usScore, themScore) {
  return usScore >= themScore ? 'us' : 'them';
}

/**
 * Merges round results into cumulative standings.
 *
 * @param {{ [id: string]: { wins, losses, buncos, totalPoints } }} currentStandings
 * @param {{ [tableId: number]: { usScore, themScore, submitted } }} tableResults
 * @param {{ [tableId: number]: { winner: 'us'|'them' } }} roundResults
 * @param {{ [id: string]: { tableId, side, seat } }} assignments
 * @param {{ [id: string]: number }} buncos  player → bunco count this round
 * @returns {{ [id: string]: { wins, losses, buncos, totalPoints } }}
 */
export function updateStandings(currentStandings, tableResults, roundResults, assignments, buncos) {
  const next = JSON.parse(JSON.stringify(currentStandings));

  for (const [id, { tableId, side }] of Object.entries(assignments)) {
    if (!next[id]) next[id] = { wins: 0, losses: 0, buncos: 0, totalPoints: 0 };
    const won = roundResults[tableId].winner === side;
    if (won) next[id].wins += 1; else next[id].losses += 1;
    const tr = tableResults[tableId];
    next[id].totalPoints += side === 'us' ? tr.usScore : tr.themScore;
    if (buncos[id]) next[id].buncos += buncos[id];
  }

  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/game-logic.js tests/game-logic.test.js
git commit -m "feat: game logic module with rotation, standings, seat assignment"
```

---

### Task 3: Landing page

**Files:**
- Modify: `index.html` (replace contents — existing file is the old quick scorer)

- [ ] **Step 1: Replace `index.html` with Bootstrap landing page**

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bunco — Live Scoring for Game Night</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
  <link rel="stylesheet" href="css/base.css" />
</head>
<body>

  <div class="min-vh-100 d-flex flex-column align-items-center justify-content-center px-3 py-5">

    <h1 class="display-4 fw-bold mb-2 text-center">Bunco</h1>
    <p class="text-muted mb-5 text-center">Live scoring for game night</p>

    <div class="row g-4 w-100" style="max-width: 800px;">

      <!-- Quick Scorer -->
      <div class="col-12 col-md-4">
        <div class="card h-100 text-center p-3">
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h5 class="card-title mb-2">Quick Scorer</h5>
              <p class="card-text small">Score a single set — no setup needed.</p>
            </div>
            <a href="scorer.html" class="btn btn-outline-light mt-3">Open Scorer</a>
          </div>
        </div>
      </div>

      <!-- Start a Game -->
      <div class="col-12 col-md-4">
        <div class="card h-100 text-center p-3">
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h5 class="card-title mb-2">Start a Game</h5>
              <p class="card-text small">Host a full game night — track all 6 rounds.</p>
            </div>
            <a href="game.html?host=true" class="btn btn-outline-light mt-3">Host Game</a>
          </div>
        </div>
      </div>

      <!-- Join a Game -->
      <div class="col-12 col-md-4">
        <div class="card h-100 text-center p-3">
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h5 class="card-title mb-2">Join a Game</h5>
              <p class="card-text small">Enter the code from your host to join.</p>
            </div>
            <form id="join-form" class="mt-3" onsubmit="handleJoin(event)">
              <input
                id="join-code"
                type="text"
                class="form-control form-control-sm text-center text-uppercase mb-2"
                placeholder="Game code"
                maxlength="4"
                autocomplete="off"
                style="letter-spacing: 0.2em;"
              />
              <button type="submit" class="btn btn-outline-light w-100">Join</button>
            </form>
          </div>
        </div>
      </div>

    </div>

    <!-- AdSense placeholder — replace with actual ad unit after approval -->
    <div class="mt-5 text-center text-muted small" id="ad-slot" style="min-height: 90px; width: 100%; max-width: 728px;">
      <!-- Google AdSense ad unit goes here -->
    </div>

  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    function handleJoin(e) {
      e.preventDefault();
      const code = document.getElementById('join-code').value.trim().toUpperCase();
      if (code.length !== 4) {
        alert('Please enter a 4-character game code.');
        return;
      }
      window.location.href = `game.html?code=${code}`;
    }
  </script>

</body>
</html>
```

- [ ] **Step 2: Open `index.html` in a browser and verify**

- Three cards render side-by-side on desktop, stacked on mobile
- "Open Scorer" links to `scorer.html`
- "Host Game" links to `game.html?host=true`
- Entering a 4-char code and submitting redirects to `game.html?code=XXXX`
- Dark theme is consistent

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: Bootstrap landing page with Quick Scorer, Host, and Join cards"
```

---

### Task 4: Migrate quick scorer

**Files:**
- Create: `scorer.html` (contents of old `index.html`)
- The old `index.html` was replaced in Task 3.

- [ ] **Step 1: Create `scorer.html`**

Copy the original scorer content but add the shared CSS link and a "← Back" nav link:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
  <title>Bunco Scorer</title>
  <link rel="stylesheet" href="css/base.css" />
  <style>
    html, body {
      width: 100%;
      height: 100%;
      background: #1a1a1a;
      overflow: hidden;
    }

    #back-btn {
      position: fixed;
      top: 12px;
      left: 12px;
      background: transparent;
      border: 1px solid #555;
      color: #666;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      z-index: 10;
      text-decoration: none;
    }

    #back-btn:hover { color: #aaa; border-color: #aaa; }

    #rotate-msg {
      display: none;
      position: fixed;
      inset: 0;
      background: #1a1a1a;
      color: #fff;
      font-size: 1.5rem;
      align-items: center;
      justify-content: center;
      text-align: center;
      z-index: 999;
    }

    @media (orientation: portrait) { #rotate-msg { display: flex; } }

    #app {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .half {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      position: relative;
    }

    #us-half   { background-color: rgba(30, 60, 120, 0.35); }
    #them-half { background-color: rgba(140, 70, 0, 0.35); }
    #us-half.winner   { background-color: rgba(30, 100, 220, 0.7); }
    #them-half.winner { background-color: rgba(220, 110, 0, 0.7); }

    .winner .score {
      color: #ffffff;
      text-shadow: 0 0 30px rgba(255,255,255,0.8);
    }

    .half:active { background: rgba(255,255,255,0.05); }

    .label {
      color: #888;
      font-size: 1.4rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .score {
      color: #ffffff;
      font-size: clamp(120px, 22vw, 240px);
      font-weight: 700;
      line-height: 1;
    }

    .divider { width: 2px; background: #444; align-self: stretch; }

    .decrement {
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 2px solid #555;
      background: transparent;
      color: #aaa;
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }

    .decrement:active { background: rgba(255,255,255,0.1); color: #fff; }

    #reset-btn {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: transparent;
      border: 1px solid #555;
      color: #666;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 18px;
      border-radius: 4px;
      cursor: pointer;
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }

    #reset-btn:active { border-color: #aaa; color: #aaa; }
  </style>
</head>
<body>

  <a href="index.html" id="back-btn">← Home</a>
  <div id="rotate-msg">Please rotate your device to landscape.</div>

  <div id="app">
    <div class="half" id="us-half">
      <div class="label">Us</div>
      <div class="score" id="us-score">0</div>
      <button class="decrement" id="us-dec" aria-label="Decrease Us score">−</button>
    </div>

    <div class="divider"></div>

    <div class="half" id="them-half">
      <div class="label">Them</div>
      <div class="score" id="them-score">0</div>
      <button class="decrement" id="them-dec" aria-label="Decrease Them score">−</button>
    </div>

    <button id="reset-btn" aria-label="Reset scores">Reset</button>
  </div>

  <script>
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    let usScore = 0, themScore = 0;

    function render() {
      document.getElementById('us-score').textContent = usScore;
      document.getElementById('them-score').textContent = themScore;
      document.getElementById('us-half').classList.toggle('winner', usScore >= 21);
      document.getElementById('them-half').classList.toggle('winner', themScore >= 21);
    }

    document.getElementById('us-half').addEventListener('click', e => {
      if (e.target.closest('.decrement')) return;
      usScore++; render();
    });
    document.getElementById('them-half').addEventListener('click', e => {
      if (e.target.closest('.decrement')) return;
      themScore++; render();
    });
    document.getElementById('us-dec').addEventListener('click', e => {
      e.stopPropagation();
      if (usScore > 0) usScore--;
      render();
    });
    document.getElementById('them-dec').addEventListener('click', e => {
      e.stopPropagation();
      if (themScore > 0) themScore--;
      render();
    });
    document.getElementById('reset-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Reset scores?')) { usScore = 0; themScore = 0; render(); }
    });
  </script>

</body>
</html>
```

- [ ] **Step 2: Verify in browser**

- Open `scorer.html` — scorer works identically to the old `index.html`
- "← Home" link returns to `index.html`

- [ ] **Step 3: Commit**

```bash
git add scorer.html
git commit -m "feat: migrate quick scorer to scorer.html with home nav link"
```

---

## Phase 2: Firebase Setup

### Task 5: Firebase project setup (manual steps)

**Files:** None created by this task — Firebase config obtained from Firebase Console.

- [ ] **Step 1: Create Firebase project**

1. Go to https://console.firebase.google.com
2. Click "Add project" → name it `bunco-io` → disable Google Analytics → Create
3. From project overview, click "Add app" → choose Web (`</>`) → register app as `bunco-web`
4. Copy the `firebaseConfig` object shown (you'll need it in Task 6)

- [ ] **Step 2: Enable Realtime Database**

1. In Firebase Console, go to Build → Realtime Database → Create Database
2. Choose a region (us-central1 is fine)
3. Start in **test mode** (you'll lock down rules in Task 13)

- [ ] **Step 3: Set TTL rule for auto-deletion**

Firebase Realtime Database does not have native TTL like Firestore. To auto-clean sessions, you'll add a Cloud Function in Task 13. For now, note your Firebase project ID for later.

---

### Task 6: Firebase module

**Files:**
- Create: `js/firebase.js`

- [ ] **Step 1: Create `js/firebase.js`**

Replace `YOUR_*` placeholders with the values from your Firebase project's config object (obtained in Task 5, Step 1).

```js
// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onValue,
  off,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─── Game meta ───────────────────────────────────────────────

export async function createGame(code, hostDeviceId, numTables, ghostSlots) {
  await set(ref(db, `games/${code}`), {
    meta: {
      tables: numTables,
      ghostSlots,
      currentRound: 0,
      gameCalledBy: null,
      hostDeviceId,
      createdAt: serverTimestamp(),
    },
    players: {},
    rounds: {},
    standings: {},
  });
}

export async function getGame(code) {
  const snap = await get(ref(db, `games/${code}`));
  return snap.exists() ? snap.val() : null;
}

export function watchGame(code, callback) {
  const r = ref(db, `games/${code}`);
  onValue(r, snap => callback(snap.val()));
  return () => off(r);
}

// ─── Players ─────────────────────────────────────────────────

export async function addPlayer(code, name, isGhost = false) {
  const playerRef = push(ref(db, `games/${code}/players`));
  await set(playerRef, { name, isGhost });
  return playerRef.key;
}

// ─── Seating assignments ─────────────────────────────────────

export async function saveRoundAssignments(code, roundNumber, assignments) {
  // assignments: { [playerId]: { tableId, side, seat } }
  await set(ref(db, `games/${code}/rounds/${roundNumber}/assignments`), assignments);
}

export async function getRoundAssignments(code, roundNumber) {
  const snap = await get(ref(db, `games/${code}/rounds/${roundNumber}/assignments`));
  return snap.exists() ? snap.val() : {};
}

// ─── Scoring ─────────────────────────────────────────────────

export async function updateTableScore(code, roundNumber, tableId, usScore, themScore) {
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), {
    usScore,
    themScore,
    submitted: false,
  });
}

export async function submitTableScore(code, roundNumber, tableId, usScore, themScore) {
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), {
    usScore,
    themScore,
    submitted: true,
  });
}

export async function recordBunco(code, roundNumber, playerId) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/buncos/${playerId}`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}

// ─── Game flow ───────────────────────────────────────────────

export async function callGame(code, tableId) {
  await update(ref(db, `games/${code}/meta`), { gameCalledBy: tableId });
}

export async function startRound(code, roundNumber) {
  await update(ref(db, `games/${code}/meta`), {
    currentRound: roundNumber,
    gameCalledBy: null,
  });
}

export async function saveStandings(code, standings) {
  await set(ref(db, `games/${code}/standings`), standings);
}
```

- [ ] **Step 2: Verify Firebase connection**

Open browser console on any page that imports `firebase.js`. No errors should appear (will test fully in later tasks).

- [ ] **Step 3: Commit**

```bash
git add js/firebase.js
git commit -m "feat: Firebase module with game, player, scoring, and flow helpers"
```

---

## Phase 3: Game Pages

### Task 7: Host setup view (`game.html` — setup)

**Files:**
- Create: `game.html`

This task builds only the host setup view (the first screen the host sees when navigating to `game.html?host=true`).

- [ ] **Step 1: Create `game.html` with setup view**

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bunco Game</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
  <link rel="stylesheet" href="css/base.css" />
</head>
<body>

  <a href="index.html" class="btn btn-sm btn-outline-secondary m-3 position-fixed top-0 start-0" style="z-index:100;">← Home</a>

  <!-- VIEW: Host Setup -->
  <div id="view-setup" data-view class="min-vh-100 d-flex align-items-center justify-content-center px-3">
    <div class="w-100" style="max-width: 440px;">
      <h2 class="text-center mb-4">Host a Game</h2>
      <div class="mb-3">
        <label class="form-label">Number of tables</label>
        <select id="setup-tables" class="form-select">
          <option value="2">2 tables (8 players)</option>
          <option value="3" selected>3 tables (12 players)</option>
          <option value="4">4 tables (16 players)</option>
          <option value="5">5 tables (20 players)</option>
          <option value="6">6 tables (24 players)</option>
        </select>
      </div>
      <div class="mb-4">
        <label class="form-label">Ghost player slots</label>
        <select id="setup-ghosts" class="form-select">
          <option value="0" selected>0 (no ghosts)</option>
          <option value="1">1 ghost</option>
          <option value="2">2 ghosts</option>
          <option value="3">3 ghosts</option>
        </select>
      </div>
      <button id="create-game-btn" class="btn btn-light w-100">Create Game</button>
    </div>
  </div>

  <!-- VIEW: Waiting Room -->
  <div id="view-waiting" data-view style="display:none;" class="min-vh-100 d-flex align-items-center justify-content-center px-3">
    <div class="w-100 text-center" style="max-width: 500px;">
      <p class="text-muted mb-1">Game code</p>
      <h1 class="display-2 fw-bold mb-4 letter-spacing-wide" id="waiting-code">----</h1>
      <p class="text-muted mb-3">Players joined: <span id="waiting-count">0</span> / <span id="waiting-total">0</span></p>
      <div id="waiting-player-list" class="d-flex flex-wrap gap-2 justify-content-center mb-4"></div>
      <div id="host-controls" style="display:none;">
        <button id="random-seat-btn" class="btn btn-outline-light me-2">Random Seat</button>
        <button id="start-round-btn" class="btn btn-light" disabled>Start Round 1</button>
      </div>
    </div>
  </div>

  <!-- VIEW: Join (player enters name) -->
  <div id="view-join" data-view style="display:none;" class="min-vh-100 d-flex align-items-center justify-content-center px-3">
    <div class="w-100 text-center" style="max-width: 360px;">
      <h2 class="mb-1">Join Game</h2>
      <p class="text-muted mb-4">Code: <strong id="join-display-code"></strong></p>
      <input id="join-name" type="text" class="form-control form-control-lg text-center mb-3"
             placeholder="Your name" maxlength="20" autocomplete="off" />
      <button id="join-btn" class="btn btn-light w-100">Join</button>
    </div>
  </div>

  <!-- VIEW: Scoring (populated in Task 8) -->
  <div id="view-scoring" data-view style="display:none;"></div>

  <!-- VIEW: Round submitted / waiting for others -->
  <div id="view-submitted" data-view style="display:none;"
       class="min-vh-100 d-flex align-items-center justify-content-center text-center px-3">
    <div>
      <h3 class="mb-2">Scores submitted!</h3>
      <p class="text-muted">Waiting for other tables…</p>
      <a id="view-standings-link" href="standings.html" class="btn btn-outline-light mt-3">View Standings</a>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script type="module" src="js/game-controller.js"></script>

</body>
</html>
```

- [ ] **Step 2: Create `js/game-controller.js`** (handles setup flow only for now)

```js
// js/game-controller.js
import { createGame, addPlayer, watchGame, saveRoundAssignments, startRound } from './firebase.js';
import { generateGameCode, assignRandomSeats } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId } from './ui.js';

const deviceId = getDeviceId();
const urlCode  = getParam('code');
const isHost   = getParam('host') === 'true';

let gameCode    = null;
let gameData    = null;
let unsubscribe = null;

// ─── Entry point ──────────────────────────────────────────────

if (isHost && !urlCode) {
  showView('view-setup');
  document.getElementById('create-game-btn').addEventListener('click', handleCreateGame);
} else if (urlCode) {
  gameCode = urlCode.toUpperCase();
  showView('view-join');
  document.getElementById('join-display-code').textContent = gameCode;
  document.getElementById('join-btn').addEventListener('click', handleJoin);
}

// ─── Host creates game ────────────────────────────────────────

async function handleCreateGame() {
  const numTables  = parseInt(document.getElementById('setup-tables').value);
  const ghostSlots = parseInt(document.getElementById('setup-ghosts').value);

  gameCode = generateGameCode();

  await createGame(gameCode, deviceId, numTables, ghostSlots);

  // Add ghost players
  for (let i = 0; i < ghostSlots; i++) {
    await addPlayer(gameCode, `Ghost ${i + 1}`, true);
  }

  // Redirect host to waiting room with code in URL
  window.location.href = `game.html?code=${gameCode}&host=true`;
}

// ─── Player joins ─────────────────────────────────────────────

async function handleJoin() {
  const name = document.getElementById('join-name').value.trim();
  if (!name) { showToast('Please enter your name.', 'warning'); return; }

  const game = await getGame(gameCode);
  if (!game) { showToast('Game not found. Check your code.', 'warning'); return; }

  // Check name uniqueness
  const taken = Object.values(game.players || {}).map(p => p.name.toLowerCase());
  if (taken.includes(name.toLowerCase())) {
    showToast('That name is taken — try adding an initial.', 'warning');
    return;
  }

  const playerId = await addPlayer(gameCode, name, false);
  localStorage.setItem(`bunco_player_${gameCode}`, playerId);

  showWaitingRoom(game.meta.hostDeviceId === deviceId);
  subscribeToGame();
}

// ─── Waiting room ─────────────────────────────────────────────

function showWaitingRoom(hostView) {
  showView('view-waiting');
  document.getElementById('waiting-code').textContent = gameCode;
  if (hostView) {
    document.getElementById('host-controls').style.display = '';
    document.getElementById('random-seat-btn').addEventListener('click', handleRandomSeat);
    document.getElementById('start-round-btn').addEventListener('click', handleStartRound);
  }
}

function subscribeToGame() {
  import('./firebase.js').then(({ watchGame }) => {
    unsubscribe = watchGame(gameCode, data => {
      gameData = data;
      onGameUpdate(data);
    });
  });
}

function onGameUpdate(data) {
  if (!data) return;

  const players      = data.players || {};
  const humanPlayers = Object.values(players).filter(p => !p.isGhost);
  const totalSeats   = data.meta.tables * 4 - data.meta.ghostSlots;

  document.getElementById('waiting-count').textContent = humanPlayers.length;
  document.getElementById('waiting-total').textContent = totalSeats;

  const list = document.getElementById('waiting-player-list');
  list.innerHTML = '';
  Object.values(players).forEach(p => {
    const badge = document.createElement('span');
    badge.className = `badge ${p.isGhost ? 'bg-secondary' : 'bg-primary'}`;
    badge.textContent = p.name;
    list.appendChild(badge);
  });

  const startBtn = document.getElementById('start-round-btn');
  if (startBtn) {
    startBtn.disabled = humanPlayers.length < totalSeats;
  }

  // If round has started, navigate to scoring view
  if (data.meta.currentRound >= 1) {
    navigateToScoring(data);
  }
}

// ─── Seat assignment ──────────────────────────────────────────

async function handleRandomSeat() {
  const players    = gameData.players || {};
  const playerIds  = Object.keys(players);
  const numTables  = gameData.meta.tables;
  const assignments = assignRandomSeats(playerIds, numTables);
  await saveRoundAssignments(gameCode, 1, assignments);
  showToast('Seats assigned randomly!', 'success');
}

async function handleStartRound() {
  if (!gameData.rounds || !gameData.rounds[1] || !gameData.rounds[1].assignments) {
    showToast('Assign seats first.', 'warning');
    return;
  }
  await startRound(gameCode, 1);
}

// ─── Navigate to scoring (stub — completed in Task 8) ─────────

function navigateToScoring(data) {
  // Implemented in Task 8
}
```

- [ ] **Step 3: Verify in browser**

1. Open `game.html?host=true` — host setup form appears
2. Select tables/ghosts, click "Create Game" — redirects to `game.html?code=XXXX&host=true`
3. Waiting room shows code, player count, disabled Start button
4. Open `game.html?code=XXXX` in another tab — join form appears with code shown

- [ ] **Step 4: Commit**

```bash
git add game.html js/game-controller.js
git commit -m "feat: game host setup, waiting room, and player join flow"
```

---

### Task 8: Round scoring view

**Files:**
- Modify: `game.html` (the `#view-scoring` div is already present — populate it)
- Modify: `js/game-controller.js` (implement `navigateToScoring` and scoring logic)

- [ ] **Step 1: Populate `#view-scoring` in `game.html`**

Replace the empty `<div id="view-scoring" ...></div>` with:

```html
<!-- VIEW: Scoring (populated in Task 8) -->
<div id="view-scoring" data-view style="display:none; width:100%; height:100vh; position:relative; overflow:hidden;">

  <!-- Round + game-called banner -->
  <div id="scoring-header" style="
    position:absolute; top:0; left:0; right:0;
    display:flex; align-items:center; justify-content:center;
    padding: 10px; z-index:20; gap: 16px;">
    <span id="round-label" style="color:#888; font-size:0.95rem; text-transform:uppercase; letter-spacing:0.08em;"></span>
    <span id="game-called-banner" style="display:none; background:#ffc107; color:#000; padding:4px 12px; border-radius:4px; font-size:0.85rem; font-weight:600;">
      GAME CALLED — finish your roll
    </span>
  </div>

  <!-- Scorer halves -->
  <div id="scoring-app" style="display:flex; width:100%; height:100%;">

    <div class="scoring-half" id="sc-us" style="
      flex:1; display:flex; flex-direction:column; align-items:center;
      justify-content:center; cursor:pointer; user-select:none;
      -webkit-tap-highlight-color:transparent; position:relative;
      background-color: rgba(30,60,120,0.35);">
      <div style="color:#888; font-size:1.2rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:10px;">Us</div>
      <div id="sc-us-score" style="color:#fff; font-size:clamp(100px,18vw,200px); font-weight:700; line-height:1;">0</div>
      <button id="sc-us-dec" style="
        position:absolute; bottom:70px; left:50%; transform:translateX(-50%);
        width:56px; height:56px; border-radius:50%; border:2px solid #555;
        background:transparent; color:#aaa; font-size:1.8rem; cursor:pointer;
        display:flex; align-items:center; justify-content:center;">−</button>
    </div>

    <div style="width:2px; background:#444; align-self:stretch;"></div>

    <div class="scoring-half" id="sc-them" style="
      flex:1; display:flex; flex-direction:column; align-items:center;
      justify-content:center; cursor:pointer; user-select:none;
      -webkit-tap-highlight-color:transparent; position:relative;
      background-color: rgba(140,70,0,0.35);">
      <div style="color:#888; font-size:1.2rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:10px;">Them</div>
      <div id="sc-them-score" style="color:#fff; font-size:clamp(100px,18vw,200px); font-weight:700; line-height:1;">0</div>
      <button id="sc-them-dec" style="
        position:absolute; bottom:70px; left:50%; transform:translateX(-50%);
        width:56px; height:56px; border-radius:50%; border:2px solid #555;
        background:transparent; color:#aaa; font-size:1.8rem; cursor:pointer;
        display:flex; align-items:center; justify-content:center;">−</button>
    </div>

  </div>

  <!-- Bottom bar: BUNCO button + Call Game + Submit -->
  <div id="scoring-footer" style="
    position:absolute; bottom:0; left:0; right:0;
    display:flex; align-items:center; justify-content:center;
    gap:16px; padding:16px; z-index:20; background: rgba(26,26,26,0.85);">

    <button id="bunco-btn" style="
      background: #ffc107; color:#000; border:none;
      font-size:1.1rem; font-weight:700; letter-spacing:0.08em;
      text-transform:uppercase; padding:12px 28px;
      border-radius:8px; cursor:pointer; min-width:120px;">
      🎲 BUNCO!
    </button>

    <button id="call-game-btn" style="
      background:transparent; border:2px solid #555; color:#aaa;
      font-size:0.85rem; letter-spacing:0.08em; text-transform:uppercase;
      padding:10px 20px; border-radius:6px; cursor:pointer;">
      Call Game
    </button>

    <button id="submit-scores-btn" style="
      background:transparent; border:2px solid #555; color:#aaa;
      font-size:0.85rem; letter-spacing:0.08em; text-transform:uppercase;
      padding:10px 20px; border-radius:6px; cursor:pointer;">
      Submit
    </button>

  </div>

</div>
```

- [ ] **Step 2: Add scoring logic to `js/game-controller.js`**

First, update the import line at the top of `js/game-controller.js` to include the additional Firebase functions needed for scoring:

```js
import { createGame, addPlayer, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore } from './firebase.js';
```

Then append the following to `js/game-controller.js` (after the existing code):

```js
// ─── Scoring view ─────────────────────────────────────────────

let usScore  = 0;
let themScore = 0;
let myTableId = null;
let myPlayerId = null;

function navigateToScoring(data) {
  myPlayerId = localStorage.getItem(`bunco_player_${gameCode}`);
  const assignments = data.rounds?.[data.meta.currentRound]?.assignments || {};
  const myAssignment = assignments[myPlayerId];

  if (!myAssignment && data.meta.hostDeviceId !== deviceId) {
    showToast('Could not find your table assignment.', 'warning');
    return;
  }

  myTableId = myAssignment?.tableId || 1;
  usScore   = 0;
  themScore = 0;

  showView('view-scoring');

  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }

  document.getElementById('round-label').textContent =
    `Round ${data.meta.currentRound} of 6`;

  renderScores();
  attachScoringListeners(data.meta.currentRound);
  watchForGameCalled();
}

function renderScores() {
  document.getElementById('sc-us-score').textContent   = usScore;
  document.getElementById('sc-them-score').textContent = themScore;

  document.getElementById('sc-us').style.backgroundColor =
    usScore >= 21 ? 'rgba(30,100,220,0.7)' : 'rgba(30,60,120,0.35)';
  document.getElementById('sc-them').style.backgroundColor =
    themScore >= 21 ? 'rgba(220,110,0,0.7)' : 'rgba(140,70,0,0.35)';
}

function attachScoringListeners(roundNumber) {
  document.getElementById('sc-us').addEventListener('click', e => {
    if (e.target.closest('#sc-us-dec')) return;
    usScore++; renderScores();
  });
  document.getElementById('sc-them').addEventListener('click', e => {
    if (e.target.closest('#sc-them-dec')) return;
    themScore++; renderScores();
  });
  document.getElementById('sc-us-dec').addEventListener('click', e => {
    e.stopPropagation();
    if (usScore > 0) { usScore--; renderScores(); }
  });
  document.getElementById('sc-them-dec').addEventListener('click', e => {
    e.stopPropagation();
    if (themScore > 0) { themScore--; renderScores(); }
  });

  document.getElementById('bunco-btn').addEventListener('click', () => {
    handleBunco(roundNumber);
  });

  document.getElementById('call-game-btn').addEventListener('click', () => {
    handleCallGame();
  });

  document.getElementById('submit-scores-btn').addEventListener('click', () => {
    handleSubmitScores(roundNumber);
  });
}

async function handleBunco(roundNumber) {
  if (!myPlayerId) return;
  await recordBunco(gameCode, roundNumber, myPlayerId);
  showToast('Bunco recorded!', 'success');
}

async function handleCallGame() {
  await callGame(gameCode, myTableId);
  showToast('Game called! Other tables are finishing their rolls.', 'info');
}

async function handleSubmitScores(roundNumber) {
  await submitTableScore(gameCode, roundNumber, myTableId, usScore, themScore);
  document.getElementById('view-standings-link').href = `standings.html?code=${gameCode}`;
  showView('view-submitted');
}

function watchForGameCalled() {
  // gameData is kept up-to-date by the existing watchGame subscription
  // The onGameUpdate function (Task 9) will show the banner
}
```

- [ ] **Step 3: Update `onGameUpdate` to show game-called banner and handle round advance**

In `js/game-controller.js`, replace the existing `onGameUpdate` function with:

```js
function onGameUpdate(data) {
  if (!data) return;
  gameData = data;

  const players      = data.players || {};
  const humanPlayers = Object.values(players).filter(p => !p.isGhost);
  const totalSeats   = data.meta.tables * 4 - data.meta.ghostSlots;

  // Update waiting room if visible
  const waitingCode = document.getElementById('waiting-code');
  if (waitingCode) {
    waitingCode.textContent = gameCode;
    document.getElementById('waiting-count').textContent = humanPlayers.length;
    document.getElementById('waiting-total').textContent = totalSeats;

    const list = document.getElementById('waiting-player-list');
    if (list) {
      list.innerHTML = '';
      Object.values(players).forEach(p => {
        const badge = document.createElement('span');
        badge.className = `badge ${p.isGhost ? 'bg-secondary' : 'bg-primary'}`;
        badge.textContent = p.name;
        list.appendChild(badge);
      });
    }

    const startBtn = document.getElementById('start-round-btn');
    if (startBtn) startBtn.disabled = humanPlayers.length < totalSeats;
  }

  // Show game-called banner on scoring view
  const banner = document.getElementById('game-called-banner');
  if (banner) {
    banner.style.display = data.meta.gameCalledBy ? '' : 'none';
  }

  // Round just started — navigate to scoring
  const currentView = [...document.querySelectorAll('[data-view]')]
    .find(el => el.style.display !== 'none')?.id;

  if (data.meta.currentRound >= 1 && currentView === 'view-waiting') {
    navigateToScoring(data);
  }

  // Game complete
  if (data.meta.currentRound === 7) {
    window.location.href = `standings.html?code=${gameCode}&final=true`;
  }
}
```

- [ ] **Step 4: Verify in browser**

1. Host creates a game, all players join, host assigns seats and starts round 1
2. Scoring view appears — "Us" and "Them" halves, round indicator, Bunco button visible
3. Tapping halves increments scores; − buttons decrement
4. Tapping "BUNCO!" calls `recordBunco` (check Firebase console)
5. One table taps "Call Game" — other tables see the yellow banner
6. Tapping "Submit" shows the submitted view with standings link

- [ ] **Step 5: Commit**

```bash
git add game.html js/game-controller.js
git commit -m "feat: round scoring view with Bunco button, call game, and submit"
```

---

### Task 9: Round end and rotation

**Files:**
- Modify: `js/game-controller.js`

This task handles what happens after all tables submit: calculate winners, update standings, calculate next-round seating, and advance the round.

- [ ] **Step 1: Add round-end logic to `js/game-controller.js`**

Update the import lines at the top of `game-controller.js` to add the remaining functions:

```js
// Replace the firebase.js import line with:
import { createGame, addPlayer, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         getRoundAssignments, saveStandings } from './firebase.js';

// Add after the firebase import:
import { generateGameCode, assignRandomSeats,
         calculateNextRoundSeating, determineWinner, updateStandings } from './game-logic.js';
```

Then append to `game-controller.js`:

```js
// ─── Round end ────────────────────────────────────────────────

// Called from onGameUpdate when host detects all tables submitted
async function checkAndAdvanceRound(data, roundNumber) {
  if (data.meta.hostDeviceId !== deviceId) return; // only host runs this

  const tables = data.rounds?.[roundNumber]?.tables || {};
  const numTables = data.meta.tables;

  // Check all tables submitted
  for (let t = 1; t <= numTables; t++) {
    if (!tables[t]?.submitted) return; // not all in yet
  }

  // Calculate winners per table
  const roundResults = {};
  for (let t = 1; t <= numTables; t++) {
    const { usScore, themScore } = tables[t];
    roundResults[t] = { winner: determineWinner(usScore, themScore) };
  }

  // Update standings
  const assignments = await getRoundAssignments(gameCode, roundNumber);
  const buncos      = data.rounds?.[roundNumber]?.buncos || {};
  const current     = data.standings || {};
  const next        = updateStandings(current, tables, roundResults, assignments, buncos);
  await saveStandings(gameCode, next);

  if (roundNumber >= 6) {
    // Game over — 7 is the complete sentinel
    await startRound(gameCode, 7);
    return;
  }

  // Calculate next round seating
  const nextAssignments = calculateNextRoundSeating(assignments, roundResults, numTables);
  await saveRoundAssignments(gameCode, roundNumber + 1, nextAssignments);

  // Advance round
  await startRound(gameCode, roundNumber + 1);
}
```

- [ ] **Step 2: Call `checkAndAdvanceRound` from `onGameUpdate`**

Inside `onGameUpdate`, after the game-called banner block, add:

```js
  // Check if all tables have submitted (host only)
  if (data.meta.currentRound >= 1 && data.meta.currentRound <= 6) {
    checkAndAdvanceRound(data, data.meta.currentRound);
  }
```

- [ ] **Step 3: Verify end-to-end round flow**

1. Two-table test: open 3 browser tabs (host + 2 tables)
2. All players join, host starts round 1
3. Both table tabs score and submit
4. Firebase should update to round 2, new assignments visible in DB
5. Scoring views on both tables reset and show "Round 2 of 6"
6. After round 6, all tabs redirect to `standings.html?code=XXXX&final=true`

- [ ] **Step 4: Commit**

```bash
git add js/game-controller.js
git commit -m "feat: round end — standings update, rotation calc, round advance"
```

---

### Task 10: Standings page

**Files:**
- Create: `standings.html`

- [ ] **Step 1: Create `standings.html`**

```html
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bunco Standings</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
  <link rel="stylesheet" href="css/base.css" />
</head>
<body>

  <div class="container py-4" style="max-width: 600px;">

    <div class="d-flex align-items-center mb-4">
      <a id="back-link" href="index.html" class="btn btn-sm btn-outline-secondary me-3">← Home</a>
      <h2 class="mb-0" id="standings-title">Standings</h2>
    </div>

    <div id="round-indicator" class="text-muted mb-3"></div>

    <table class="table table-dark table-striped">
      <thead>
        <tr>
          <th>Player</th>
          <th class="text-center">W</th>
          <th class="text-center">L</th>
          <th class="text-center">Buncos</th>
          <th class="text-center">Points</th>
        </tr>
      </thead>
      <tbody id="standings-body">
        <tr><td colspan="5" class="text-center text-muted">Loading…</td></tr>
      </tbody>
    </table>

    <!-- AdSense — shown only on final standings -->
    <div id="ad-slot" style="display:none; min-height:90px; text-align:center; margin-top:24px;">
      <!-- Google AdSense ad unit goes here -->
    </div>

  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script type="module">
    import { watchGame } from './js/firebase.js';
    import { getParam } from './js/ui.js';

    const code    = getParam('code');
    const isFinal = getParam('final') === 'true';

    if (!code) {
      document.getElementById('standings-body').innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">No game code found.</td></tr>';
    } else {
      document.getElementById('back-link').href = `game.html?code=${code}`;

      if (isFinal) {
        document.getElementById('standings-title').textContent = 'Final Standings';
        document.getElementById('ad-slot').style.display = '';
      }

      watchGame(code, data => {
        if (!data) return;

        const round = data.meta?.currentRound || 0;
        document.getElementById('round-indicator').textContent =
          isFinal ? 'Game complete!' : `After round ${round - 1} of 6`;

        const players   = data.players || {};
        const standings = data.standings || {};

        // Build rows: merge player name with standings data
        const rows = Object.entries(players)
          .filter(([, p]) => !p.isGhost)
          .map(([id, p]) => ({
            name: p.name,
            wins:   standings[id]?.wins        || 0,
            losses: standings[id]?.losses      || 0,
            buncos: standings[id]?.buncos      || 0,
            points: standings[id]?.totalPoints || 0,
          }))
          .sort((a, b) => b.wins - a.wins || b.buncos - a.buncos || b.points - a.points);

        const tbody = document.getElementById('standings-body');
        tbody.innerHTML = rows.map((r, i) => `
          <tr ${i === 0 && isFinal ? 'class="table-warning"' : ''}>
            <td>${r.name}${i === 0 && isFinal ? ' 🏆' : ''}</td>
            <td class="text-center">${r.wins}</td>
            <td class="text-center">${r.losses}</td>
            <td class="text-center">${r.buncos}</td>
            <td class="text-center">${r.points}</td>
          </tr>
        `).join('');
      });
    }
  </script>

</body>
</html>
```

- [ ] **Step 2: Verify standings page**

1. During a game (after round 1), open `standings.html?code=XXXX`
2. Table renders with player names and live stats
3. After game completes, open `standings.html?code=XXXX&final=true`
4. "Final Standings" title shown, top player has trophy and yellow highlight
5. Ad slot div is visible (empty for now — AdSense added in Task 11)

- [ ] **Step 3: Commit**

```bash
git add standings.html
git commit -m "feat: standings page with live updates and final standings view"
```

---

## Phase 4: AdSense & Cleanup

### Task 11: Google AdSense setup

**Files:**
- Modify: `index.html`
- Modify: `standings.html`

AdSense requires a live domain with real traffic before approval. Complete these steps after deploying to bunco.io.

- [ ] **Step 1: Apply for Google AdSense**

1. Go to https://adsense.google.com → Sign up with your Google account
2. Enter `bunco.io` as your site URL
3. Google will provide a verification snippet like:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
   ```
4. Add this snippet to the `<head>` of both `index.html` and `standings.html`
5. Wait for Google to verify site ownership (can take a few days)

- [ ] **Step 2: Create ad units in AdSense dashboard**

Once approved:
1. In AdSense, go to Ads → By ad unit → Display ads
2. Create a responsive ad unit named `bunco-landing`
3. AdSense will give you a code block like:
   ```html
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
   <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   ```
4. Replace `<!-- Google AdSense ad unit goes here -->` in `index.html`'s `#ad-slot` with this code
5. Create a second ad unit named `bunco-final` and replace the same comment in `standings.html`

- [ ] **Step 3: Commit**

```bash
git add index.html standings.html
git commit -m "feat: AdSense ad units on landing and final standings pages"
```

---

### Task 12: Firebase security rules and TTL cleanup

**Files:** Firebase Console only — no local files.

- [ ] **Step 1: Set Firebase Realtime Database security rules**

In Firebase Console → Realtime Database → Rules, replace with:

```json
{
  "rules": {
    "games": {
      "$code": {
        ".read":  true,
        ".write": true,
        ".validate": "newData.hasChildren(['meta'])"
      }
    }
  }
}
```

This allows any client to read/write any game by code while requiring the `meta` node to exist (prevents empty junk writes).

- [ ] **Step 2: Enable Firebase Cloud Functions for TTL cleanup**

Since Firebase Realtime Database has no native TTL, set up a scheduled Cloud Function to delete games older than 24 hours.

In Firebase Console → Functions → Get started, then in a local terminal:

```bash
npm install -g firebase-tools
firebase login
firebase init functions   # choose JavaScript, use existing project
```

In `functions/index.js`:

```js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp }  = require('firebase-admin/app');
const { getDatabase }    = require('firebase-admin/database');

initializeApp();

exports.cleanOldGames = onSchedule('every 24 hours', async () => {
  const db    = getDatabase();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const snap  = await db.ref('games').once('value');
  const games = snap.val() || {};
  const deletes = [];

  for (const [code, game] of Object.entries(games)) {
    if (game.meta?.createdAt < cutoff) {
      deletes.push(db.ref(`games/${code}`).remove());
    }
  }

  await Promise.all(deletes);
  console.log(`Cleaned ${deletes.length} expired games.`);
});
```

Deploy:
```bash
firebase deploy --only functions
```

Note: Cloud Functions requires the Firebase Blaze (pay-as-you-go) plan. The free tier covers well over 1,000 game cleanups per month.

- [ ] **Step 3: Commit functions**

```bash
git add functions/
git commit -m "feat: Firebase security rules and scheduled TTL cleanup function"
```

---

### Task 13: GitHub Pages deployment

**Files:** GitHub repository settings only.

- [ ] **Step 1: Push all commits to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Enable GitHub Pages**

1. Go to your GitHub repo → Settings → Pages
2. Source: Deploy from a branch → Branch: `main` → Folder: `/ (root)` → Save
3. GitHub will publish at `https://yourusername.github.io/bunco/` within a few minutes

- [ ] **Step 3: Configure custom domain `bunco.io`**

1. In GitHub Pages settings, enter `bunco.io` in the "Custom domain" field → Save
2. GitHub will add a `CNAME` file to your repo automatically
3. In your domain registrar (wherever you bought `bunco.io`), add DNS records:
   ```
   A     @   185.199.108.153
   A     @   185.199.109.153
   A     @   185.199.110.153
   A     @   185.199.111.153
   CNAME www bunco.io.
   ```
4. Wait for DNS propagation (up to 48 hours)
5. Check "Enforce HTTPS" in GitHub Pages settings once the domain verifies

- [ ] **Step 4: Add bunco.io to Firebase authorized domains**

In Firebase Console → Authentication → Settings → Authorized domains → Add `bunco.io`

- [ ] **Step 5: Verify live site**

1. Open `https://bunco.io` — landing page loads
2. Open `https://bunco.io/scorer.html` — quick scorer works
3. Host a test game end-to-end from two devices on the live URL
