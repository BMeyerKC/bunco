# Bunco Player Picker & One-Bunco-Per-Round — Design

**Date:** 2026-07-04
**Status:** Approved

## Problem

A table often scores from a single shared device, but the BUNCO! button credits
whoever taps it (`myPlayerId`), so there is no way to credit a teammate or
opponent who actually rolled the bunco. Additionally, the house rule is that
only **one bunco can happen per round across the whole game**, and rolling it
ends the round — today `recordBunco` allows unlimited buncos per player per
round and calling the round is a separate manual action.

## Requirements

1. Tapping BUNCO! opens a picker so the scorer chooses which of the four
   players at their table rolled it.
2. Only one bunco per round, enforced atomically across all connected devices
   (first writer wins).
3. A confirmed bunco calls the round for everyone, exactly like the Call Game
   button (`meta/gameCalledBy`).
4. Once a bunco exists for the current round, every device's BUNCO! button is
   disabled; it re-enables naturally on the next round.
5. No auto-points: scorers keep entering points manually. The bunco only
   credits the player, disables other buttons, and calls the round.
6. No undo after confirmation. The picker modal has a free Cancel.

## Approach (chosen: round-level marker + transaction)

Alternatives considered:

- **Per-player map + pre-write check** — simplest diff, but two simultaneous
  taps can both pass the check; exactly the race we need to prevent. Rejected.
- **Host arbitration** — robust but depends on the host being connected
  mid-round and adds unnecessary moving parts. Rejected.

### Data model

New node written via Firebase `runTransaction`, committing only if currently
null (first writer wins):

```
games/{code}/rounds/{n}/bunco = { playerId, tableId, ts }
```

On a winning commit, the client also:

- writes `games/{code}/rounds/{n}/buncos/{playerId} = 1` — the existing shape,
  so `updateStandings`, the standings page, and the debug timeline need **no
  changes**;
- sets `meta/gameCalledBy = tableId` (reusing the existing call-game flow and
  banner);
- logs the existing `BUNCO_RECORDED` event.

`recordBunco(code, roundNumber, playerId, tableId)` in `firebase.js` becomes
transaction-based and returns whether it won.

### UI flow (scoring view, game-controller.js + game.astro)

1. Tap **🎲 BUNCO!** → modal opens: "Who rolled the bunco?" with one button per
   player seated at the tapper's table this round (both sides, names from the
   current round's assignments — ghosts included) plus Cancel. Nothing is
   written and no animation plays yet.
2. Tap a player → run the transaction.
   - **Won:** play the BUNCO animation, credit the player, call the round.
   - **Lost:** no animation; toast "A bunco was already recorded this round."
3. Derived from the existing `onGameUpdate` path (no new listeners): when
   `rounds/{currentRound}/bunco` exists, disable the BUNCO! button (greyed,
   non-tappable) on every device, show the game-called banner with bunco
   flavor ("🎲 BUNCO! — finish your rolls and submit"), and close the picker
   modal if it is open.

### Edge cases

- Offline / failed write → toast, button stays enabled.
- New round → node absent under the new round number, button re-enables.
- Ghost players appear in the picker (a human claims their rolls).

## Testing

- Unit tests for the win/lose transaction paths of the new `recordBunco`.
- Pure helper for "players at my table this round" (picker list) lives in
  `game-logic.js` with tests in `game-logic.test.js`.
