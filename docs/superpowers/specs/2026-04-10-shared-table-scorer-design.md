# Shared Real-Time Table Scorer

**Date:** 2026-04-10
**Status:** Approved

## Problem

Currently each player navigates to their own independent scoring view when a round starts. `usScore` and `themScore` are local JS variables — tapping on one phone has no effect on any other phone. Multiple players at the same table score independently; whoever submits last wins.

## Goal

All four players at the same table see the same live score in real time. Any player can tap either side to increment or decrement. Submit works the same as today — any player can submit.

## Data Model

Add two live fields to the existing table node:

```
games/{code}/rounds/{round}/tables/{tableId}/liveUs    ← source of truth during round
games/{code}/rounds/{round}/tables/{tableId}/liveThem  ← source of truth during round
games/{code}/rounds/{round}/tables/{tableId}/usScore   ← written on submit (unchanged)
games/{code}/rounds/{round}/tables/{tableId}/themScore ← written on submit (unchanged)
games/{code}/rounds/{round}/tables/{tableId}/submitted ← written on submit (unchanged)
```

`liveUs`/`liveThem` are absent until the first tap (transactions handle null → 0). On submit, the controller copies its cached `liveUs`/`liveThem` values into `usScore`/`themScore`. The round-advance logic (`checkAndAdvanceRound` → `updateStandings`) reads `usScore`/`themScore` and requires no changes.

## Firebase Layer (`firebase.js`)

Add `runTransaction` to the firebase-database import.

Three new exported functions:

```js
// Atomically increment liveUs or liveThem by 1
export async function incrementTableScore(code, round, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}/${field}`);
  await runTransaction(r, current => (current || 0) + 1);
}

// Atomically decrement, floor at 0
export async function decrementTableScore(code, round, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}/${field}`);
  await runTransaction(r, current => Math.max(0, (current || 0) - 1));
}

// Subscribe to live score updates for a table
export function watchTableScore(code, round, tableId, callback) {
  const r = ref(db, `games/${code}/rounds/${round}/tables/${tableId}`);
  onValue(r, snap => callback(snap.val() || {}));
  return () => off(r);
}
```

`submitTableScore` signature is unchanged — caller passes `usScore`/`themScore`.

## Controller Changes (`game-controller.js`)

### Module-scope variables

```js
let usScore = 0;              // now updated by Firebase subscription, not by taps
let themScore = 0;            // same
let tableScoreUnsubscribe = null;  // new — cleanup for the table watcher
```

### `navigateToScoring(data)`

After setting `myTableId`:

```js
if (tableScoreUnsubscribe) tableScoreUnsubscribe();
tableScoreUnsubscribe = watchTableScore(gameCode, data.meta.currentRound, myTableId, tableData => {
  usScore = tableData.liveUs || 0;
  themScore = tableData.liveThem || 0;
  renderScores();
});
```

### `attachScoringListeners(roundNumber)`

Replace local mutations with Firebase calls:

| Old | New |
|-----|-----|
| `usScore++; renderScores()` | `incrementTableScore(gameCode, roundNumber, myTableId, 'us')` |
| `themScore++; renderScores()` | `incrementTableScore(gameCode, roundNumber, myTableId, 'them')` |
| `if (usScore > 0) { usScore--; renderScores(); }` | `decrementTableScore(gameCode, roundNumber, myTableId, 'us')` |
| `if (themScore > 0) { themScore--; renderScores(); }` | `decrementTableScore(gameCode, roundNumber, myTableId, 'them')` |

No local mutation. The Firebase round-trip triggers `onValue` → updates cache → `renderScores()`.

### `handleSubmitScores(roundNumber)`

Unchanged — passes cached `usScore`/`themScore` to `submitTableScore`.

## Edge Cases

- **First tap:** `liveUs`/`liveThem` absent in Firebase; transaction uses `current || 0` — no explicit initialization needed.
- **Round rotation:** `navigateToScoring` is called again for the new round, tears down the old `watchTableScore` subscription and sets up a fresh one on the new table node.
- **Network lag:** Firebase SDK queues transactions locally and flushes on reconnect. UI may lag but self-corrects via `onValue`.
- **Simultaneous taps:** Transactions are atomic — both register. No increments are silently dropped.
- **Decrement race:** Two phones both try to decrement from 1 — one transaction resolves to 0, the other retries and also resolves to 0 (floor). Correct behavior.

## Out of Scope

- Showing which team a player is on within the scoring view
- Restricting which team can score which side
- Optimistic local rendering (tap feels instant without a round-trip)
