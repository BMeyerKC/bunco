# Shared Real-Time Table Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all four players at the same Bunco table share one live score that any phone can tap to update in real time.

**Architecture:** Move `usScore`/`themScore` from local JS variables to Firebase (`liveUs`/`liveThem` fields on the table node) using atomic transactions for writes. All phones at the table subscribe via `onValue` and render whatever Firebase says. On submit, the cached values are written as the final `usScore`/`themScore` — round-advance logic is unchanged.

**Tech Stack:** Vanilla JS ES modules, Firebase Realtime Database SDK 10.12.0 (CDN), no build step. Dev server: `npx serve` at localhost:3000.

---

## File Map

| File | Change |
|------|--------|
| `js/firebase.js` | Add `runTransaction` to import; add `incrementTableScore`, `decrementTableScore`, `watchTableScore` |
| `js/game-controller.js` | Update import line; add `tableScoreUnsubscribe`; update `navigateToScoring`; update 4 tap handlers in `attachScoringListeners` |

`js/game-logic.js`, `game.html`, and `tests/` are untouched.

---

## Task 1: Add live-score functions to `firebase.js`

> No unit tests — these are thin wrappers around the Firebase SDK (a CDN import, not mockable in Jest). Correctness is verified in Task 3 manual testing.

**Files:**
- Modify: `js/firebase.js`

- [ ] **Step 1: Add `runTransaction` to the Firebase import**

Open `js/firebase.js`. The import on lines 2–13 currently reads:

```js
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
```

Replace it with:

```js
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onValue,
  off,
  runTransaction,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
```

- [ ] **Step 2: Add the three new exported functions**

After the `claimGhostSeat` function (currently ending around line 69), add:

```js
// ─── Live scoring ─────────────────────────────────────────────

export async function incrementTableScore(code, round, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}/${field}`);
  await runTransaction(r, current => (current || 0) + 1);
}

export async function decrementTableScore(code, round, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}/${field}`);
  await runTransaction(r, current => Math.max(0, (current || 0) - 1));
}

export function watchTableScore(code, round, tableId, callback) {
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}`);
  onValue(r, snap => callback(snap.val() || {}));
  return () => off(r);
}
```

- [ ] **Step 3: Commit**

```bash
git add js/firebase.js
git commit -m "feat: add Firebase transaction functions for live table scoring"
```

---

## Task 2: Wire live score subscription into the scoring view

**Files:**
- Modify: `js/game-controller.js`

- [ ] **Step 1: Update the import line**

Line 1–4 currently reads:

```js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         getRoundAssignments, saveStandings } from './firebase.js';
```

Replace with:

```js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         getRoundAssignments, saveStandings,
         incrementTableScore, decrementTableScore, watchTableScore } from './firebase.js';
```

- [ ] **Step 2: Add `tableScoreUnsubscribe` module-scope variable**

After line 256 (`let scoringAbortController = null;`), add:

```js
let tableScoreUnsubscribe = null;
```

- [ ] **Step 3: Update `navigateToScoring` to subscribe to live scores**

The current `navigateToScoring` function (lines 258–288) has these lines near the top:

```js
myTableId = myAssignment?.tableId || 1;
usScore   = 0;
themScore = 0;
if (scoringAbortController) scoringAbortController.abort();
scoringAbortController = new AbortController();
```

Replace those five lines with:

```js
myTableId = myAssignment?.tableId || 1;
usScore   = 0;
themScore = 0;
if (scoringAbortController) scoringAbortController.abort();
scoringAbortController = new AbortController();
if (tableScoreUnsubscribe) tableScoreUnsubscribe();
tableScoreUnsubscribe = watchTableScore(gameCode, data.meta.currentRound, myTableId, tableData => {
  usScore = tableData.liveUs || 0;
  themScore = tableData.liveThem || 0;
  renderScores();
});
```

- [ ] **Step 4: Commit**

```bash
git add js/game-controller.js
git commit -m "feat: subscribe to live table scores in scoring view"
```

---

## Task 3: Replace tap handlers with Firebase transaction calls

**Files:**
- Modify: `js/game-controller.js`

- [ ] **Step 1: Replace the four tap handlers in `attachScoringListeners`**

The current `attachScoringListeners` function (lines 299–321) has four handlers. Replace them all so the function reads:

```js
function attachScoringListeners(roundNumber) {
  const signal = scoringAbortController.signal;

  document.getElementById('sc-us').addEventListener('click', e => {
    if (e.target.closest('#sc-us-dec')) return;
    incrementTableScore(gameCode, roundNumber, myTableId, 'us');
  }, { signal });
  document.getElementById('sc-them').addEventListener('click', e => {
    if (e.target.closest('#sc-them-dec')) return;
    incrementTableScore(gameCode, roundNumber, myTableId, 'them');
  }, { signal });
  document.getElementById('sc-us-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'us');
  }, { signal });
  document.getElementById('sc-them-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'them');
  }, { signal });
  document.getElementById('bunco-btn').addEventListener('click', () => handleBunco(roundNumber), { signal });
  document.getElementById('call-game-btn').addEventListener('click', () => handleCallGame(), { signal });
  document.getElementById('submit-scores-btn').addEventListener('click', () => handleSubmitScores(roundNumber), { signal });
}
```

Note: The `if (usScore > 0)` guard on decrement is removed — the Firebase transaction enforces the floor at 0 via `Math.max(0, ...)`.

- [ ] **Step 2: Manual test — single tab baseline**

Start dev server:
```bash
npx serve
```

Open `http://localhost:3000/game.html?host=true` in one tab. Create a game (1 table, 0 ghosts). Open the join URL in a second tab and join as a player. Back in the host tab: click "Random Seat", then "Start Round 1".

Both tabs should show the scoring view. In the host tab:
- Tap the Us half → score increments to 1
- Wait ~300ms → verify the player tab also shows 1
- Tap the − button on Us → verify both tabs show 0
- Tap − again → verify both tabs stay at 0 (floor)

- [ ] **Step 3: Manual test — cross-tab sync**

In the player tab:
- Tap the Them half → verify both tabs show Them: 1
- Tap Us in the host tab simultaneously with Them in the player tab → verify both sides registered (scores should both be 1)

In either tab: click Submit → verify both tabs move to "Scores submitted!" view and the round eventually advances.

- [ ] **Step 4: Commit**

```bash
git add js/game-controller.js
git commit -m "feat: wire tap handlers to Firebase live score transactions"
```
