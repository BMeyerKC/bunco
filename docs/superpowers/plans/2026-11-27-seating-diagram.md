# Seating Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a before → after drawing of who moves where between rounds: to players (with their own move on top), to a non-playing host, on the debug page, and as a sample in the landing page rules.

**Architecture:** One pure function (`seatMoves`) turns a round's seats and results plus next round's seats into tables and moves. One renderer (`seatDiagramSvg`) turns that into an SVG string styled by theme tokens. Every page calls those two. The landing page calls them at build time, the same way `tallyHtml()` is used today.

**Tech Stack:** Astro 6, vanilla ES modules, Firebase RTDB, Jest (`npm test`; never `npx jest`), Playwright (hits live Firebase; the owner runs it).

**Spec:** `docs/superpowers/specs/2026-11-27-seating-diagram-design.md`

**Branch:** `seating-diagram`, stacked on `head-table-rotation` (PR #60). Work in the `C:\projects\Personal\bunco-head-table` worktree.

## Global Constraints

- No new dependencies.
- No hard-coded palette hex in SVG or JS. Color comes from CSS classes using tokens (`--pen`, `--margin`, `--rule`, `--ink`, `--ink-soft`, `--card`) in `src/styles/base.css`, so it works in light (paper) and dark (chalkboard).
- Every player name that reaches markup is escaped (names are user input, max 20 chars).
- Arrow color is geometric: next table number lower = `is-up` (pen blue), higher = `is-down` (margin red), same = `is-stay` (muted).
- Table 1 is labeled "★" in both columns.
- Rounds 1–5 only. No diagram after round 6.
- The diagram and the "your move" card must use the same `nextAssignments` the game will save: `rounds[r+1].assignments` if present, else `calculateNextRoundSeating(assignments, roundWinners(...), numTables)`.
- Sentence-case copy. Move headlines are exactly `↑ Move up to Table N`, `Stay at Table N`, `↓ Drop to Table N`.

## Review Focus

1. **Names with markup or quotes** (`<b>Jo</b>`, `O'Brien & Co`): must render as literal text in the SVG and its `aria-label`. Test in Task 2.
2. **Long names** (20 chars) overflow a fixed-width SVG box: the drawing shortens names longer than 10 chars to 9 chars + `…`. Full names stay in the card. Test in Task 2.
3. **A device with no seat** (spectator, host-only device, or a player missing from next round's seats): `yourMove` returns `null`, the card stays hidden, and the diagram renders unhighlighted. Test in Task 1.
4. **Re-render on every Firebase update:** the between-rounds view re-runs on each snapshot, so the diagram container must be replaced (`innerHTML =`), never appended. Test in Task 3.
5. **Ghosts and all-ghost tables:** ghost names get the ghost marker, move like anyone else, and an all-ghost table still draws both pairs and arrows. Test in Task 1 (data) and Task 2 (marker).

---

### Task 1: `seatMoves` and `yourMove` (pure logic)

**Files:**
- Modify: `src/js/game-logic.js` (add after `roundWinners`)
- Create: `src/js/sample-night.js` (the shared 12-player fixture, also used by Tasks 2, 3 and 6)
- Test: `tests/game-logic.test.js`

**Interfaces:**
- Consumes: existing `roundWinners`, `calculateNextRoundSeating`
- Produces:
  ```js
  // Person = { id: string, name: string, isGhost: boolean }
  seatMoves(players, assignments, results, nextAssignments, numTables) => {
    before: Array<{ tableId: number, won: Person[], lost: Person[] }>,          // tableId 1..N
    after:  Array<{ tableId: number, us: Person[], them: Person[] }>,           // tableId 1..N
    moves:  Array<{ fromTable: number, toTable: number, outcome: 'won'|'lost',
                    direction: 'up'|'down'|'stay', people: Person[] }>,
  }
  yourMove(sm /* seatMoves result */, playerId) => null | {
    direction: 'up'|'down'|'stay', fromTable: number, toTable: number,
    outcome: 'won'|'lost', lastPartner: string|null,
    nextPartner: string|null, nextOpponents: string[],
  }
  seatMismatches(actualNext, expectedNext) => string[]   // ids whose tableId or side differ, or that are missing from either
  ```
  `players` is `data.players` (`{ [id]: { name, isGhost } }`). `results` is `roundWinners(...)` output.
  `SAMPLE_NIGHT = { players, assignments, results, numTables: 3 }` exported from `src/js/sample-night.js`.

- [ ] **Step 1: Write the fixture and failing tests**

`src/js/sample-night.js` holds the spec's sample night: 12 players `p1`–`p12`, named Ann, Beth, Cara, Dot, Eve, Fay, Gail, Hope, Ivy, Jo, Kay, Lou. Table 1 = p1,p2 (us, seats 1,2) and p3,p4 (them); table 2 = p5–p8; table 3 = p9–p12, in the same pattern. Results are `{1:{winner:'us'},2:{winner:'us'},3:{winner:'us'}}`. In the tests: `const { players, assignments: a, results } = SAMPLE_NIGHT; const next = calculateNextRoundSeating(a, results, 3); const sm = seatMoves(players, a, results, next, 3);`

```js
describe('seatMoves', () => {
  test('splits each table into won and lost pairs', () => {
    const sm = seatMoves(players, a, results, next, 3);
    expect(sm.before[0].won.map(p => p.name)).toEqual(['Ann', 'Beth']);
    expect(sm.before[0].lost.map(p => p.name)).toEqual(['Cara', 'Dot']);
  });
  test('one move per pair with geometric direction', () => {
    const sm = seatMoves(players, a, results, next, 3);
    expect(sm.moves).toHaveLength(6);
    const m = (from, outcome) => sm.moves.find(x => x.fromTable === from && x.outcome === outcome);
    expect(m(1, 'won')).toMatchObject({ toTable: 1, direction: 'stay' });
    expect(m(1, 'lost')).toMatchObject({ toTable: 3, direction: 'down' });
    expect(m(2, 'won')).toMatchObject({ toTable: 1, direction: 'up' });
    expect(m(2, 'lost')).toMatchObject({ toTable: 2, direction: 'stay' });
  });
  test('after lists next-round partners by side', () => {
    const sm = seatMoves(players, a, results, next, 3);
    expect(sm.after[0].us.map(p => p.name).sort()).toEqual(['Ann', 'Eve']);
  });
  test('a pair split across tables (bad data) yields one move per player', () => {
    const bad = { ...next, p2: { ...next.p2, tableId: 2 } };
    const sm = seatMoves(players, a, results, bad, 3);
    expect(sm.moves.filter(x => x.fromTable === 1 && x.outcome === 'won')).toHaveLength(2);
  });
  test('ghosts carry isGhost and an all-ghost table still has two moves', () => {
    const ghosts = { ...players, p9: { name: 'G1', isGhost: true }, p10: { name: 'G2', isGhost: true },
                     p11: { name: 'G3', isGhost: true }, p12: { name: 'G4', isGhost: true } };
    const sm = seatMoves(ghosts, a, results, next, 3);
    expect(sm.before[2].won.every(p => p.isGhost)).toBe(true);
    expect(sm.moves.filter(x => x.fromTable === 3)).toHaveLength(2);
  });
});

describe('yourMove', () => {
  test('winner at table 2 moves up with last partner and new seats', () => {
    expect(yourMove(sm, 'p5')).toEqual({ direction: 'up', fromTable: 2, toTable: 1, outcome: 'won',
      lastPartner: 'Fay', nextPartner: 'Ann', nextOpponents: ['Beth', 'Fay'] });
  });
  test('table 1 loser drops to the last table', () => {
    expect(yourMove(sm, 'p3')).toMatchObject({ direction: 'down', toTable: 3, outcome: 'lost' });
  });
  test('table 1 winner stays', () => {
    expect(yourMove(sm, 'p1')).toMatchObject({ direction: 'stay', toTable: 1 });
  });
  test('returns null for an unseated id', () => {
    expect(yourMove(sm, 'nobody')).toBeNull();
  });
  test('returns null when the player is missing from next round', () => {
    const { p5, ...rest } = next;
    expect(yourMove(seatMoves(players, a, results, rest, 3), 'p5')).toBeNull();
  });
});

describe('seatMismatches', () => {
  test('lists ids whose table or side differ', () => {
    const wrong = { ...next, p1: { ...next.p1, tableId: 2 } };
    expect(seatMismatches(wrong, next)).toEqual(['p1']);
  });
  test('empty when equal', () => { expect(seatMismatches(next, next)).toEqual([]); });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/game-logic.test.js`
Expected: FAIL, `seatMoves is not a function` (and the same for the others)

- [ ] **Step 3: Implement `seatMoves`, `yourMove`, `seatMismatches` in `src/js/game-logic.js`**

`seatMoves`: for each table, the `won`/`lost` people come from `assignments` filtered by table and side (`results[t].winner`), ordered by `seat`. Group each pair's players by their `nextAssignments[id].tableId`, giving one move per destination. Direction comes from comparing `toTable` to `fromTable`. Players missing from `nextAssignments` get no move. `after` is built like `buildTableLayout` but from `nextAssignments`. A missing player record falls back to `{ name: '?', isGhost: false }`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- tests/game-logic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/game-logic.js src/js/sample-night.js tests/game-logic.test.js
git commit -m "Add seatMoves, yourMove and seatMismatches"
```

---

### Task 2: SVG renderer, move copy, and styles

**Files:**
- Create: `src/js/seat-diagram.js`
- Modify: `src/styles/base.css` (append a `/* Seat diagram */` block)
- Test: `tests/seat-diagram.test.js`

**Interfaces:**
- Consumes: the `seatMoves` result and the `yourMove` result from Task 1
- Produces:
  ```js
  seatDiagramSvg(sm, { round, highlightId } = {}) => string   // '<svg class="seat-diagram" ...>…</svg>'
  describeMove(move /* yourMove result */) => { headline: string, why: string, headTable: boolean }
  shortName(name) => string                                    // >10 chars → first 9 + '…'
  ```
  Column headings are `Round ${round}` and `Round ${round + 1}`.

**Geometry (starting point, from the mockup):** `viewBox="0 0 320 ${20 + numTables * 100}"`. Left boxes are at x=6, w=124, h=80, y = 20 + (t-1)*100. Right boxes are at x=192, w=122. The won line is at y+34 and the lost line at y+62. Arrows run from x=132 at the pair's line to x=188 near the destination box's middle, using a cubic curve when the tables differ and a straight line when they're the same.

**Classes:** `seat-diagram`, `sd-box`, `sd-box is-head`, `sd-arrow is-up|is-down|is-stay`, `sd-ghost` (on a `<tspan>` with a 👻 prefix), `is-faded` (on non-highlighted groups), `sd-me` (bold name). Arrowheads use one `<marker>` per direction class, filled with `context-stroke` or one marker per class.

- [ ] **Step 1: Write failing tests**

```js
test('one arrow per move, classed by direction', () => {
  const svg = seatDiagramSvg(sm, { round: 2 });
  document.body.innerHTML = svg;
  expect(document.querySelectorAll('.sd-arrow')).toHaveLength(6);
  expect(document.querySelectorAll('.sd-arrow.is-up')).toHaveLength(2);
  expect(document.querySelectorAll('.sd-arrow.is-down')).toHaveLength(1);
  expect(document.querySelector('svg').getAttribute('role')).toBe('img');
  expect(document.body.textContent).toContain('Round 3');
});
test('escapes names in text and aria-label', () => {
  const svg = seatDiagramSvg(seatMoves({ ...players, p1: { name: '<b>Jo</b>', isGhost: false } }, a, results, next, 3), { round: 2 });
  expect(svg).not.toContain('<b>');
  document.body.innerHTML = svg;
  expect(document.body.textContent).toContain('<b>Jo</b>');   // 9 chars, so not shortened
  expect(document.querySelector('svg').getAttribute('aria-label')).toContain('<b>Jo</b>');
});
test('shortName trims long names', () => {
  expect(shortName('Bernadette-Anne')).toBe('Bernadett…');
  expect(shortName('Ann')).toBe('Ann');
});
test('highlight fades everything but the player path and bolds the name', () => {
  document.body.innerHTML = seatDiagramSvg(sm, { round: 2, highlightId: 'p5' });
  expect(document.querySelectorAll('.sd-me').length).toBe(2);
  expect(document.querySelectorAll('.sd-arrow:not(.is-faded)')).toHaveLength(1);
});
test('ghost names carry the ghost marker', () => {
  document.body.innerHTML = seatDiagramSvg(ghostSm, { round: 2 });
  expect(document.querySelectorAll('.sd-ghost').length).toBeGreaterThan(0);
});
test('describeMove copy', () => {
  expect(describeMove({ direction: 'up', fromTable: 2, toTable: 1, outcome: 'won', lastPartner: 'Fay' }))
    .toEqual({ headline: '↑ Move up to Table 1', why: 'You and Fay won at Table 2.', headTable: true });
  expect(describeMove({ direction: 'stay', fromTable: 2, toTable: 2, outcome: 'lost', lastPartner: null }).why)
    .toBe('You lost at Table 2.');
  expect(describeMove({ direction: 'down', fromTable: 1, toTable: 3, outcome: 'lost', lastPartner: 'Dot' }).headline)
    .toBe('↓ Drop to Table 3');
});
```

Build `sm`, `players`, `a`, `results` and `next` from `SAMPLE_NIGHT` as in Task 1. `ghostSm` is the same, with p9–p12 marked `isGhost: true`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/seat-diagram.test.js`
Expected: FAIL, cannot find module `../src/js/seat-diagram.js`

- [ ] **Step 3: Implement `src/js/seat-diagram.js` and the CSS block**

Use a local `esc` (same one-liner as `table-cards.js`). The `aria-label` lists each move, e.g. `"Eve and Fay move up from table 2 to table 1; Cara and Dot drop from table 1 to table 3; …"`. CSS: box fill `var(--card)`, stroke `var(--rule)` (`is-head` uses `var(--pen)` at width 2), text `var(--ink)`, `.sd-arrow` with `fill:none; stroke-width:2`, `.is-up { stroke: var(--pen) }`, `.is-down { stroke: var(--margin) }`, `.is-stay { stroke: var(--ink-soft); opacity:.5 }`, `.is-faded { opacity:.3 }`, `.sd-me { font-weight:800; fill: var(--pen) }`, and the highlighted arrow gets `stroke-width:3.5`. Container: `.seat-diagram { width:100%; height:auto; display:block; }`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: all suites PASS

- [ ] **Step 5: Commit**

```bash
git add src/js/seat-diagram.js src/styles/base.css tests/seat-diagram.test.js
git commit -m "Add the seat diagram renderer and styles"
```

---

### Task 3: Players' between-rounds view: "your move" card and diagram

**Files:**
- Modify: `src/pages/game.astro` (`#br-next-seat` block in `#view-between-rounds`)
- Modify: `src/js/game-controller.js` (`showBetweenRoundsView`, around lines 871–897)
- Create: `src/js/between-rounds-seats.js` (DOM glue, so it can be unit-tested)
- Test: `tests/between-rounds-seats.test.js`
- Modify: `e2e/round-cycle.spec.js`

**Interfaces:**
- Consumes: `seatMoves`, `yourMove` (Task 1); `seatDiagramSvg`, `describeMove` (Task 2)
- Produces: `renderBetweenRoundsSeats(root, sm, { round, playerId })`. `root` contains `#br-next-seat`, `#br-move-headline`, `#br-move-head-pill`, `#br-move-why`, `#br-next-teammate`, `#br-next-opponents` and `#br-seat-diagram`. It hides the card when `yourMove` is null and always replaces `#br-seat-diagram`'s contents.

- [ ] **Step 1: Write failing tests** (jsdom, like `tests/table-cards.test.js`)

```js
test('fills the card for a seated player and highlights them', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  expect(document.getElementById('br-move-headline').textContent).toBe('↑ Move up to Table 1');
  expect(document.getElementById('br-move-why').textContent).toBe('You and Fay won at Table 2.');
  expect(document.getElementById('br-next-seat').hidden).toBe(false);
  expect(document.querySelectorAll('#br-seat-diagram .sd-me').length).toBe(2);
});
test('hides the card and draws unhighlighted for an unseated device', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: null });
  expect(document.getElementById('br-next-seat').hidden).toBe(true);
  expect(document.querySelectorAll('#br-seat-diagram .is-faded')).toHaveLength(0);
});
test('re-rendering replaces the diagram rather than appending', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  expect(document.querySelectorAll('#br-seat-diagram svg')).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/between-rounds-seats.test.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement**

- `game.astro`: replace the `#br-next-seat` card's contents. The "Your next seat" label and `#br-next-table` give way to a headline `<p id="br-move-headline">` plus `<span id="br-move-head-pill" hidden>★ Head table</span>` and `<p id="br-move-why">`. Keep the Partner/Against `<dl>` with its ids. Add `<div id="br-seat-diagram"></div>` right after the card, before the standings section. Switch the card from `style="display:none"` to the `hidden` attribute.
- `between-rounds-seats.js`: `renderBetweenRoundsSeats` as in Interfaces. Use `textContent` for card fields. For an empty partner, show `—`. Opponents are joined with `' & '`, matching today's card.
- `game-controller.js`: in `showBetweenRoundsView`, keep the existing `nextAssignments` fallback. When `round < 6`, build `sm = seatMoves(players, assignments, roundResults, nextAssignments, numTables)` and call `renderBetweenRoundsSeats(document.getElementById('view-between-rounds'), sm, { round, playerId: myPlayerId })`. When `round === 6`, hide the card and clear `#br-seat-diagram`. Remove the old next-seat code this replaces.

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: all PASS

- [ ] **Step 5: Extend the e2e (owner runs it; it hits live Firebase)**

In `e2e/round-cycle.spec.js`, after `#view-between-rounds` is visible, add:
```js
await expect(session.hostPage.locator("#br-seat-diagram svg.seat-diagram")).toBeVisible();
```
Run: `npx playwright test e2e/round-cycle.spec.js` only if the owner says so. Otherwise note it as not run.

- [ ] **Step 6: Check in the browser**

Run `npm run build && npx astro preview`, open `game.html`, and check the between-rounds view at 375px width in both themes. If a live game can't be run, render the view from a fixture with a temporary script, and say so.

- [ ] **Step 7: Commit**

```bash
git add src/pages/game.astro src/js/game-controller.js src/js/between-rounds-seats.js tests/between-rounds-seats.test.js e2e/round-cycle.spec.js
git commit -m "Show each player's move and the room diagram between rounds"
```

---

### Task 4: Non-playing host on the standings page

**Files:**
- Modify: `src/pages/standings.astro` (inside `#advance-round-section`, above the button)
- Modify: `src/js/standings-controller.js` (`checkAndShowAdvanceButton`)

**Interfaces:**
- Consumes: `seatMoves` (Task 1), `seatDiagramSvg` (Task 2)

- [ ] **Step 1: Implement**

Add `<div id="advance-seat-diagram"></div>` before `#advance-round-btn`. In `checkAndShowAdvanceButton`, when every table is in and `round < 6`, compute `nextAssignments` with the same fallback (`data.rounds?.[round+1]?.assignments || calculateNextRoundSeating(...)`, with results from `roundWinners(tables, assignments, buncos, numTables)`), then set `innerHTML = seatDiagramSvg(seatMoves(...), { round })`. When `round === 6` or not every table is in, set it to `''`.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: all PASS (this is glue covered by Tasks 1–2, so no new unit test)

- [ ] **Step 3: Commit**

```bash
git add src/pages/standings.astro src/js/standings-controller.js
git commit -m "Show the seat diagram to a non-playing host before the next round"
```

---

### Task 5: Debug page: a diagram per round change, with mismatches flagged

**Files:**
- Modify: `src/pages/debug.astro` (add `<section id="seat-history"></section>` above `#event-timeline`)
- Modify: `src/js/debug-controller.js`

**Interfaces:**
- Consumes: `watchGame` (firebase.js); `roundWinners`, `calculateNextRoundSeating`, `seatMoves`, `seatMismatches` (Task 1); `seatDiagramSvg` (Task 2)

- [ ] **Step 1: Implement**

Call `watchGame(code, data => …)` alongside `watchEvents`. For each `r` from 1 to 5 where both `rounds[r].assignments` and `rounds[r+1].assignments` exist, render a `<h2>Round r → r+1</h2>` and `seatDiagramSvg(seatMoves(players, rounds[r].assignments, roundWinners(rounds[r].tables, rounds[r].assignments, rounds[r].buncos, n), rounds[r+1].assignments, n), { round: r })`. Then compute `seatMismatches(rounds[r+1].assignments, calculateNextRoundSeating(rounds[r].assignments, results, n))`. If it's non-empty, add `<p class="field-error">Seated off-rule: Ann, Eve</p>` (escaped names). Replace `#seat-history` contents on each snapshot. The diagram shows the stored seats, so a bug looks wrong in the picture as well as in the red line.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: all PASS

- [ ] **Step 3: Check in the browser**

Build and preview, then open `debug.html?code=XXXX` for a finished game code the owner gives you (read-only against live data). If there's none, skip this and say so.

- [ ] **Step 4: Commit**

```bash
git add src/pages/debug.astro src/js/debug-controller.js
git commit -m "Show seat moves per round on the debug page"
```

---

### Task 6: Landing page sample under "Rotate and repeat"

**Files:**
- Modify: `src/pages/index.astro` (frontmatter import; markup after step 5 of `.steps`)
- Modify: `src/styles/base.css` (`.rules-figure` margin and caption style)

**Interfaces:**
- Consumes: `SAMPLE_NIGHT`, `calculateNextRoundSeating`, `seatMoves` (Task 1); `seatDiagramSvg` (Task 2)

- [ ] **Step 1: Implement**

In `index.astro`'s frontmatter, build `sampleSvg = seatDiagramSvg(seatMoves(P, A, R, calculateNextRoundSeating(A, R, 3), 3), { round: 2 })` from `SAMPLE_NIGHT`. Render it after the `.steps` list in a `<figure class="rules-figure">` with `set:html={sampleSvg}` and `<figcaption>`: "Round 2 to round 3 with 12 players. Winners at Table 1 stay; everywhere else winners move up. Losers at Table 1 drop to the last table." Because it uses the real seating function, the picture can't drift from the rule.

- [ ] **Step 2: Run tests and build**

Run: `npm test && npm run build`
Expected: all PASS; build succeeds, and `dist/index.html` contains `class="seat-diagram"`

- [ ] **Step 3: Check in the browser**

Preview the landing page at 375px in light and dark, and screenshot both.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/styles/base.css
git commit -m "Illustrate the Head Table rule on the landing page"
```

---

## Done when

- `npm test` passes, and `npm run build` succeeds.
- Every check-in-the-browser step either has a screenshot or a note saying why it was skipped.
- The PR is based on `head-table-rotation` (or on `main` once #60 merges), lists the e2e that wasn't run, and references a new GitHub issue for this feature.
