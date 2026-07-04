# Bunco Player Picker & One-Bunco-Per-Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When BUNCO! is tapped, a modal lets the scorer pick which of the four players at their table rolled it; the first bunco per round wins atomically across all devices, calls the round, and disables everyone else's bunco button.

**Architecture:** A round-level marker `games/{code}/rounds/{n}/bunco = { playerId, tableId, ts }` is claimed via a Firebase `runTransaction` whose pure updater function lives in `game-logic.js` (testable without Firebase). On a winning claim the client also writes the existing `buncos/{playerId} = 1` shape (so standings/debug need no changes) and calls the round via the existing `callGame` flow. All UI state (button disabled, banner text, closing the picker) derives from game data inside the existing `onGameUpdate` handler — no new listeners.

**Tech Stack:** Vanilla JS ES modules, Astro 6 pages, Firebase Realtime Database (`firebase/database` v10), Jest 29 for unit tests.

**Spec:** `docs/superpowers/specs/2026-07-04-bunco-player-picker-design.md`

## Global Constraints

- Run tests with `npm test` (jest via `node --experimental-vm-modules`), never `npx jest`.
- Jest unit tests live in `tests/*.test.js` and import from `../src/js/...`. (The `src/js/*.test.js` files are a legacy browser test runner — do not add to them.)
- Pure/testable logic goes in `src/js/game-logic.js`; `src/js/firebase.js` stays a thin wrapper layer.
- No new dependencies. No TypeScript. DOM APIs directly (no framework).
- Player-provided names must be rendered with `textContent` (never innerHTML interpolation).
- Keep the existing RTDB data shapes: `buncos/{playerId} = count` must continue to be written so `updateStandings`, the standings page, and the debug timeline work unchanged.
- `docs/` is gitignored — plan/spec files need `git add -f`. Source files under `src/` add normally.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure transaction updater `buncoClaimUpdate` in game-logic.js

**Files:**
- Modify: `src/js/game-logic.js` (append after `buildGameRows`, ~line 175)
- Test: `tests/game-logic.test.js` (append at end of file)

**Interfaces:**
- Consumes: nothing.
- Produces: `buncoClaimUpdate(current, playerId, tableId, ts)` exported from `src/js/game-logic.js`. Returns `{ playerId, tableId, ts }` when `current` is null/undefined, returns `undefined` (transaction abort) when a claim already exists. Task 2's `recordBunco` passes this to `runTransaction`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/game-logic.test.js`, and add `buncoClaimUpdate` to the import list at the top of the file (imports from `'../src/js/game-logic.js'`):

```js
describe('buncoClaimUpdate', () => {
  test('claims the bunco when none exists yet', () => {
    expect(buncoClaimUpdate(null, 'p1', 2, 12345)).toEqual({
      playerId: 'p1',
      tableId: 2,
      ts: 12345,
    });
  });

  test('returns undefined (aborts) when a bunco is already claimed', () => {
    const existing = { playerId: 'p9', tableId: 1, ts: 1 };
    expect(buncoClaimUpdate(existing, 'p1', 2, 12345)).toBeUndefined();
  });

  test('treats undefined current the same as null (fresh round)', () => {
    expect(buncoClaimUpdate(undefined, 'p3', 1, 99)).toEqual({
      playerId: 'p3',
      tableId: 1,
      ts: 99,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/game-logic.test.js`
Expected: FAIL — `buncoClaimUpdate` is not exported (SyntaxError on import or `buncoClaimUpdate is not a function`).

- [ ] **Step 3: Write the implementation**

Append to `src/js/game-logic.js`:

```js
/**
 * Transaction updater for claiming the single per-round bunco.
 * First writer wins: aborts (returns undefined) if a claim already exists.
 *
 * @param {{ playerId, tableId, ts }|null|undefined} current  existing claim node
 * @param {string} playerId  player being credited
 * @param {number} tableId   table the bunco happened at
 * @param {number} ts        client timestamp (ms)
 * @returns {{ playerId: string, tableId: number, ts: number }|undefined}
 */
export function buncoClaimUpdate(current, playerId, tableId, ts) {
  if (current) return undefined; // someone already claimed it — abort
  return { playerId, tableId, ts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/game-logic.test.js`
Expected: PASS (all existing game-logic tests plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/js/game-logic.js tests/game-logic.test.js
git commit -m "feat: add buncoClaimUpdate transaction updater (first bunco wins)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Transaction-based `recordBunco` in firebase.js

**Files:**
- Modify: `src/js/firebase.js:159-165` (replace the existing `recordBunco`)

**Interfaces:**
- Consumes: `buncoClaimUpdate` from `./game-logic.js` (Task 1).
- Produces: `recordBunco(code, roundNumber, playerId, tableId)` → `Promise<boolean>` — `true` if this device won the claim, `false` if a bunco already existed. On success it has also written `rounds/{n}/buncos/{playerId} = 1` (legacy standings shape). Task 4's `confirmBunco` calls this. **Signature change:** the old `recordBunco(code, roundNumber, playerId)` gains a required `tableId` 4th param; the only caller is `game-controller.js:481` (rewired in Task 4).

- [ ] **Step 1: Replace the implementation**

`src/js/firebase.js` — replace lines 159–165 (the existing `recordBunco`) with:

```js
export async function recordBunco(code, roundNumber, playerId, tableId) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/bunco`);
  logSend(`games/${code}/rounds/${roundNumber}/bunco`, { playerId, tableId });
  const result = await runTransaction(r, current =>
    buncoClaimUpdate(current, playerId, tableId, Date.now())
  );
  if (!result.committed) return false;
  // Legacy per-player shape — standings math and debug timeline read this.
  logSend(`games/${code}/rounds/${roundNumber}/buncos/${playerId}`, 1);
  await set(ref(db, `games/${code}/rounds/${roundNumber}/buncos/${playerId}`), 1);
  return true;
}
```

Add the import at the top of `src/js/firebase.js` (after the `firebase/database` import block, ~line 17):

```js
import { buncoClaimUpdate } from './game-logic.js';
```

(`game-logic.js` has no imports, so no circular-dependency risk. `runTransaction`, `ref`, and `set` are already imported.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — no unit test covers the wrapper directly (consistent with the other firebase.js wrappers; the claim logic was tested in Task 1), but the suite confirms nothing broke, including `tests/firebase-event.test.js` which imports this module.

- [ ] **Step 3: Verify no stale callers**

Run: `grep -rn "recordBunco" src/`
Expected: exactly two hits — the export in `firebase.js` and the import + call in `game-controller.js`. The controller call site still passes 3 args at this point (missing `tableId`); that is expected and gets rewired in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/js/firebase.js
git commit -m "feat: recordBunco claims the single per-round bunco via transaction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Picker modal markup and styles

**Files:**
- Modify: `src/pages/game.astro` (inside `#view-scoring`, immediately after the `<!-- Footer -->` block that closes at line 161)
- Modify: `src/styles/game.css` (append; also add `#bunco-btn:disabled` next to the existing `#bunco-btn` rules at lines 155–173)

**Interfaces:**
- Consumes: nothing.
- Produces: DOM ids Task 4 wires up: `#bunco-picker` (overlay, `style="display:none"` initially, shown with `style.display = 'flex'`), `#bunco-picker-list` (container for player buttons), `#bunco-picker-cancel` (cancel button), and CSS class `bunco-picker-player` for the injected player buttons.

- [ ] **Step 1: Add the modal markup**

In `src/pages/game.astro`, inside `#view-scoring`, insert after the closing `</div>` of the `score-footer` block (after line 161) and before the `</div>` that closes `#view-scoring`:

```html
    <!-- BUNCO player picker — who rolled it? -->
    <div id="bunco-picker" class="bunco-picker-overlay" style="display:none;">
      <div class="bunco-picker-card">
        <h3 class="bunco-picker-title">🎲 Who rolled the BUNCO?</h3>
        <div id="bunco-picker-list" class="bunco-picker-list"></div>
        <button id="bunco-picker-cancel" class="bunco-picker-cancel">Cancel</button>
      </div>
    </div>
```

- [ ] **Step 2: Add the styles**

Append to `src/styles/game.css`:

```css
/* ── BUNCO player picker modal ── */
.bunco-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 40; /* above score footer (20), below nothing else on this view */
  background: rgba(10, 9, 16, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.bunco-picker-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 340px;
  text-align: center;
}

.bunco-picker-title {
  font-weight: 800;
  font-size: 1.1rem;
  margin-bottom: 14px;
}

.bunco-picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.bunco-picker-player {
  background: linear-gradient(135deg, var(--gold-deep), var(--gold));
  color: var(--bg);
  border: none;
  font-family: 'Outfit', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.bunco-picker-cancel {
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: 'Outfit', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
}
```

And add next to the existing `#bunco-btn:hover` rule (~line 173):

```css
#bunco-btn:disabled {
  background: rgba(255, 255, 255, 0.06);
  color: var(--very-muted);
  box-shadow: none;
  transform: none;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/game.astro src/styles/game.css
git commit -m "feat: bunco player-picker modal markup and styles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Controller wiring — picker flow, atomic claim, round call, button lockout

**Files:**
- Modify: `src/js/game-controller.js` — three spots: the game-called banner block in `onGameUpdate` (lines 256–260), the `bunco-btn` listener in `attachScoringListeners` (line 473), and `handleBunco` (lines 478–483).

**Interfaces:**
- Consumes: `recordBunco(code, roundNumber, playerId, tableId) → Promise<boolean>` (Task 2); `buildTableLayout` from `game-logic.js` (already imported at line 8); DOM ids `#bunco-picker`, `#bunco-picker-list`, `#bunco-picker-cancel`, class `bunco-picker-player` (Task 3); existing `callGame`, `showToast`, `EVENT`, `logEvent`, `window.playBuncoAnimation`.
- Produces: end-user behavior only; nothing downstream consumes these functions.

- [ ] **Step 1: Rewire the button listeners**

In `attachScoringListeners` (`src/js/game-controller.js:473`), replace:

```js
  document.getElementById('bunco-btn').addEventListener('click', () => handleBunco(roundNumber), { signal });
```

with:

```js
  document.getElementById('bunco-btn').addEventListener('click', () => openBuncoPicker(roundNumber), { signal });
  document.getElementById('bunco-picker-cancel').addEventListener('click', closeBuncoPicker, { signal });
```

- [ ] **Step 2: Replace `handleBunco` with the picker flow**

Replace `handleBunco` (`src/js/game-controller.js:478-483`) with:

```js
function openBuncoPicker(roundNumber) {
  const players     = gameData?.players || {};
  const assignments = gameData?.rounds?.[roundNumber]?.assignments || {};
  const table = buildTableLayout(players, assignments, gameData.meta.tables)
    .find(t => t.tableId === myTableId);
  const seated = table ? [...table.us, ...table.them] : [];
  if (seated.length === 0) return;

  const list = document.getElementById('bunco-picker-list');
  list.innerHTML = '';
  seated.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'bunco-picker-player';
    btn.textContent = p.name;
    btn.addEventListener('click', () => confirmBunco(roundNumber, p.id));
    list.appendChild(btn);
  });
  document.getElementById('bunco-picker').style.display = 'flex';
}

function closeBuncoPicker() {
  const picker = document.getElementById('bunco-picker');
  if (picker) picker.style.display = 'none';
}

async function confirmBunco(roundNumber, playerId) {
  closeBuncoPicker();
  try {
    const won = await recordBunco(gameCode, roundNumber, playerId, myTableId);
    if (!won) {
      showToast('A bunco was already recorded this round.', 'warning');
      return;
    }
    window.playBuncoAnimation?.();
    await callGame(gameCode, myTableId);
    logEvent(gameCode, EVENT.BUNCO_RECORDED, { round: roundNumber, playerId, tableId: myTableId }).catch(() => {});
    logEvent(gameCode, EVENT.GAME_CALLED, { tableId: myTableId, bunco: true }).catch(() => {});
  } catch {
    showToast('Bunco not saved — check connection.', 'warning');
  }
}
```

Notes for the implementer:
- `buildTableLayout` already excludes players with no `players[id]` record and splits by side; ghosts are included by design (a human claims their rolls).
- Player names go in via `textContent` — required, names are user input.
- `confirmBunco` closes the picker *before* the network round-trip so a slow connection doesn't leave a tappable modal up.

- [ ] **Step 3: Derive lockout state in `onGameUpdate`**

Replace the banner block (`src/js/game-controller.js:256-260`):

```js
  // Show game-called banner on scoring view
  const banner = document.getElementById('game-called-banner');
  if (banner) {
    banner.classList.toggle('visible', !!data.meta.gameCalledBy);
  }
```

with:

```js
  // One bunco per round: once claimed, lock every device's button and close
  // any open picker. Banner gets bunco flavor when the claim caused the call.
  const buncoClaim = data.rounds?.[data.meta.currentRound]?.bunco || null;
  const buncoBtn = document.getElementById('bunco-btn');
  if (buncoBtn) buncoBtn.disabled = !!buncoClaim;
  if (buncoClaim) closeBuncoPicker();

  const banner = document.getElementById('game-called-banner');
  if (banner) {
    banner.textContent = buncoClaim
      ? '🎲 BUNCO! — finish your rolls and submit'
      : 'GAME CALLED — finish your roll';
    banner.classList.toggle('visible', !!data.meta.gameCalledBy);
  }
```

(New round → `rounds/{newRound}/bunco` is absent → `buncoClaim` is null → button re-enables and banner text resets automatically. No extra reset code needed.)

- [ ] **Step 4: Run the full test suite and build**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/js/game-controller.js
git commit -m "feat: bunco player picker with atomic one-per-round claim and round call

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification (manual, two browser tabs)

**Files:** none (verification only).

**Interfaces:** consumes the full feature from Tasks 1–4.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Note the local URL (default `http://localhost:4321`).

- [ ] **Step 2: Drive the flow in a browser**

1. Tab A: open `/game?host=true`, create a game (2 tables works; use ghost slots to minimize joins), note the code.
2. Join enough players (extra tabs or ghost auto-fill) and start round 1.
3. Tab A (scoring view): tap **🎲 BUNCO!** → verify the modal lists exactly the 4 players at that table and Cancel closes it with no writes (check `[FB SEND]` console logs).
4. Tap BUNCO! again, pick a player → verify: animation plays, `rounds/1/bunco` and `rounds/1/buncos/{playerId}` appear in Firebase (console logs show both sends), the game-called banner shows the bunco wording, and the BUNCO! button is disabled.
5. Tab B (another player at a different table, same round): verify its BUNCO! button disabled itself and the bunco-flavored banner is visible; tapping it does nothing.
6. Submit scores at all tables → next round starts → verify both tabs' BUNCO! buttons are re-enabled and the banner is hidden with default text.
7. Standings page: verify the credited player shows the 🎲 bunco tally.

- [ ] **Step 3: Race check (best-effort)**

With the round active, open the picker in two tabs at two different tables, confirm a player in each as close together as possible. Exactly one should win; the loser must show the "A bunco was already recorded this round." toast and no second `buncos/` write.

- [ ] **Step 4: Record results**

If any step fails, fix before proceeding (superpowers:systematic-debugging). No commit for this task unless fixes were needed.
