# Mobile Type Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the minimum readable font size across the Bunco app via four font-size design tokens, so mobile players can read labels, helper text, and standings without losing the paper/chalkboard design.

**Architecture:** Add `--fs-caption` / `--fs-small` / `--fs-body` / `--fs-hand-sm` custom properties to the existing token block in `src/styles/base.css` (same pattern as the color tokens), then re-point every hardcoded small `font-size` in the stylesheets, page inline styles, and JS template strings at them. No markup structure, logic, or layout changes.

**Tech Stack:** Astro 6, plain CSS custom properties, Bootstrap 5.3 (CDN), Jest (`npm test`), Playwright (`npm run e2e`).

**Spec:** `docs/superpowers/specs/2026-07-10-mobile-type-scale-design.md`

## Global Constraints

- Token values are exact: `--fs-caption: 0.8125rem`, `--fs-small: 0.9375rem`, `--fs-body: 1rem`, `--fs-hand-sm: 1.45rem`.
- Only `font-size` values change. Never change font families, colors, weights, letter-spacing, markup, or JS logic.
- Large type is untouched: score clamps, headings, `.card-title`, `.waiting-code-display`, BUNCO overlay, scorer `.label` (1.6rem), theme-toggle icon, decrement buttons.
- Out of scope: `src/pages/tests.astro`, `src/pages/debug.astro`, `src/js/debug-controller.js`, `src/js/admin-gate.js`.
- The repo gitignores `docs/`; specs/plans are committed with `git add -f` (established precedent).
- All work on `main` (repo convention: direct commits to main).

## Mapping rule (used throughout)

| Old value | New value | Why |
|---|---|---|
| ≤ 0.75rem (and 9px) | `var(--fs-caption)` | micro-label tier, floor 13px |
| 0.8rem uppercase micro-labels | `var(--fs-caption)` | role is caption despite size |
| 0.8–0.9rem | `var(--fs-small)` | reading-text tier, 15px |
| 0.95rem / 1rem body-ish | `var(--fs-body)` | tokenized, unchanged size |
| Caveat 1.15–1.4rem small uses | `var(--fs-hand-sm)` | short x-height compensation |

---

### Task 1: Tokens + base.css re-point

**Files:**
- Modify: `src/styles/base.css`

**Interfaces:**
- Produces: CSS custom properties `--fs-caption`, `--fs-small`, `--fs-body`, `--fs-hand-sm` on `:root`, available to every page (all layouts import `base.css`). All later tasks consume these exact names.

- [ ] **Step 1: Add the four tokens to the `:root` font block**

In `src/styles/base.css`, the block at ~line 59 currently reads:

```css
:root {
  --font-hand: 'Caveat', 'Segoe Print', cursive;
  --font-body: 'Nunito', system-ui, sans-serif;
  /* Wobbly border-radius gives the hand-drawn look without images */
  --wobble-sm: 125px 10px 115px 10px / 10px 115px 10px 125px;
}
```

Change it to:

```css
:root {
  --font-hand: 'Caveat', 'Segoe Print', cursive;
  --font-body: 'Nunito', system-ui, sans-serif;
  /* Type scale — raised floor for mobile readability.
     caption: micro-labels (13px floor); small: helper text (15px);
     hand-sm: Caveat's short x-height needs a bigger nominal size. */
  --fs-caption: 0.8125rem;
  --fs-small:   0.9375rem;
  --fs-body:    1rem;
  --fs-hand-sm: 1.45rem;
  /* Wobbly border-radius gives the hand-drawn look without images */
  --wobble-sm: 125px 10px 115px 10px / 10px 115px 10px 125px;
}
```

- [ ] **Step 2: Re-point the small sizes in base.css**

Four edits (find each `font-size` line and replace the value only):

| Selector | Old | New |
|---|---|---|
| `.label-upper` | `font-size: 0.6875rem;` | `font-size: var(--fs-caption);` |
| `.card-text` | `font-size: 0.875rem;` | `font-size: var(--fs-small);` |
| `.player-chip` | `font-size: 0.8125rem;` | `font-size: var(--fs-small);` |
| `.app-toast` | `font-size: 1rem;` | `font-size: var(--fs-body);` |

Do NOT touch `.card-title` (1.6rem) or `.theme-toggle` (1.15rem icon).

- [ ] **Step 3: Verify with dev server**

Run: `npm run dev` (background), open `http://localhost:4321/` in a browser.
Expected: home page renders; the "LABEL" style text (form labels on the host page use `.label-upper`) is visibly larger but still styled as small caps; no layout breakage.

- [ ] **Step 4: Commit**

```bash
git add src/styles/base.css
git commit -m "feat: add raised-floor font-size tokens, re-point base.css"
```

---

### Task 2: game.css re-point

**Files:**
- Modify: `src/styles/game.css`

**Interfaces:**
- Consumes: the four `--fs-*` tokens from Task 1.
- Produces: nothing consumed later; independent.

- [ ] **Step 1: Re-point all small sizes in game.css**

Twelve edits (replace the `font-size` value only, everything else on the line stays):

| Selector | Old | New |
|---|---|---|
| `.score-topbar .round-label` | `font-size: 1.15rem;` | `font-size: var(--fs-hand-sm);` |
| `.game-called-pill` | `font-size: 0.75rem;` | `font-size: var(--fs-caption);` |
| `.half-team-label` | `font-size: 1.4rem;` | `font-size: var(--fs-hand-sm);` |
| `.half-player-names` | `font-size: 0.875rem;` | `font-size: var(--fs-small);` |
| `#bunco-btn` | `font-size: 1rem;` | `font-size: var(--fs-body);` |
| `#call-game-btn, #submit-scores-btn` | `font-size: 0.8125rem;` | `font-size: var(--fs-small);` |
| `#bunco-pts` | `font-size: 1rem;` | `font-size: var(--fs-body);` |
| `.live-count-pill` | `font-size: 0.875rem;` | `font-size: var(--fs-small);` |
| `.standings-rank` | `font-size: 0.75rem;` | `font-size: var(--fs-caption);` |
| `.standings-name` | `font-size: 0.875rem;` | `font-size: var(--fs-small);` |
| `.standings-stat` | `font-size: 0.8125rem;` | `font-size: var(--fs-small);` |
| `.bunco-picker-player` | `font-size: 1rem;` | `font-size: var(--fs-body);` |
| `.bunco-picker-cancel` | `font-size: 0.875rem;` | `font-size: var(--fs-small);` |

Do NOT touch: `.half-score-num` (clamp), `.half-dec-btn` (1.6rem − glyph), `.waiting-code-display` (clamp), `.bunco-picker-title` (1.5rem), `#bunco-text` (clamp), `.bunco-die` (28px pips).

- [ ] **Step 2: Check the scoring footer at 360px width**

With `npm run dev` running, open `http://localhost:4321/game.html?host=true`, create a game, and reach the scoring view (or temporarily inspect `#view-scoring` via devtools by forcing it visible). Set viewport to 360×740.
Expected: `🎲 BUNCO!` / `Call Game` / `Submit` fit on one row in the footer.

**Contingency (only if the footer wraps or overflows at 360px):** tighten spacing, not font size — in `game.css` change `.score-footer` `gap: 12px` → `gap: 8px`, and `#call-game-btn, #submit-scores-btn` `padding: 9px 18px` → `padding: 9px 13px`.

- [ ] **Step 3: Commit**

```bash
git add src/styles/game.css
git commit -m "feat: game.css small text on raised-floor tokens"
```

---

### Task 3: Page inline styles (game, index, scorer, admin, layout)

**Files:**
- Modify: `src/pages/game.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/scorer.astro`
- Modify: `src/pages/admin.astro`
- Modify: `src/layouts/Layout.astro`

**Interfaces:**
- Consumes: the four `--fs-*` tokens from Task 1.
- Produces: nothing consumed later; independent.

- [ ] **Step 1: game.astro — replace inline font-size values**

All in `style="..."` attributes; replace only the `font-size` portion:

| Line (approx) | Element | Old | New |
|---|---|---|---|
| 12 | "Set up tables and ghost slots" | `font-size:0.9rem` | `font-size:var(--fs-small)` |
| 38 | "Scan to join" | `font-size:0.75rem` | `font-size:var(--fs-caption)` |
| 40 | "Players joined:" | `font-size:0.875rem` | `font-size:var(--fs-small)` |
| 53 | "Waiting for the host to start Round 1…" | `font-size:0.875rem` | `font-size:var(--fs-small)` |
| 88 | "Watch as spectator →" | `font-size:0.875rem` | `font-size:var(--fs-small)` |
| 97 | "Or take an open seat:" | `font-size:0.875rem` | `font-size:var(--fs-small)` |
| 198 | `label-upper` "Standings" | delete `font-size:0.7rem;` from the style attr entirely | (class token applies) |
| 204 | `label-upper` "Your next seat" | delete `font-size:0.7rem;` from the style attr entirely | (class token applies) |
| 206 | "With <teammate>" | `font-size:0.9rem` | `font-size:var(--fs-small)` |
| 207 | "vs. <opponents>" | `font-size:0.9rem` | `font-size:var(--fs-small)` |
| 212 | "Waiting for host to start next round…" | `font-size:0.875rem` | `font-size:var(--fs-small)` |

For lines 198/204 the result is e.g. `<p class="label-upper mb-3">Standings</p>` — the inline override was the only reason it was 0.7rem.

- [ ] **Step 2: index.astro — tokenize the tagline**

Line ~100: `<p style="color:var(--muted); margin-bottom:2.5rem; font-size:1rem;">Live scoring for game night</p>` → `font-size:var(--fs-body)`.
Do NOT touch the logo sizes, `h1`, or the join-code input (1.1rem).

- [ ] **Step 3: scorer.astro — style block**

In the `<style is:global>` block:

| Selector | Old | New |
|---|---|---|
| `#back-btn` | `font-size: 0.75rem;` | `font-size: var(--fs-caption);` |
| `#reset-btn` | `font-size: 0.85rem;` | `font-size: var(--fs-small);` |

Do NOT touch `.label` (1.6rem Caveat), `.score` (clamp), `.decrement` (2rem).

- [ ] **Step 4: admin.astro — stat labels and error line**

| Line (approx) | Old | New |
|---|---|---|
| 22 (`#debug-code-error`) | `font-size:0.8rem` | `font-size:var(--fs-small)` |
| 30, 34, 38 (three stat sublabels) | `font-size:0.75rem` | `font-size:var(--fs-caption)` |

Do NOT touch the 1.6rem stat numbers.

- [ ] **Step 5: Layout.astro — footer version stamp**

Line ~44: `font-size:0.65rem` → `font-size:var(--fs-caption)` in the fixed footer style attribute.

- [ ] **Step 6: Verify no stray small sizes remain in these files**

Run (Git Bash):
```bash
grep -rnE 'font-size:\s*0\.(6|7)' src/pages/game.astro src/pages/index.astro src/pages/scorer.astro src/pages/admin.astro src/layouts/Layout.astro src/styles/
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/pages/game.astro src/pages/index.astro src/pages/scorer.astro src/pages/admin.astro src/layouts/Layout.astro
git commit -m "feat: page inline styles on raised-floor font tokens"
```

---

### Task 4: JS-injected styles

**Files:**
- Modify: `src/js/game-controller.js`
- Modify: `src/js/table-cards.js`
- Modify: `src/js/admin-controller.js`
- Test: existing suites only (`npm test`) — these are style-value edits inside template strings; no logic changes, no new tests.

**Interfaces:**
- Consumes: the four `--fs-*` tokens from Task 1 (resolved by the browser at render time).
- Produces: nothing consumed later; independent.

- [ ] **Step 1: game-controller.js — submitted-dots labels (~line 312)**

Old:
```js
label.style.cssText = `font-size:9px;font-weight:700;color:${done ? 'var(--accent)' : 'var(--very-muted)'};`;
```
New:
```js
label.style.cssText = `font-size:var(--fs-caption);font-weight:700;color:${done ? 'var(--accent)' : 'var(--very-muted)'};`;
```

- [ ] **Step 2: game-controller.js — between-rounds standings rows (~lines 741–745)**

Old:
```js
        <span style="color:var(--very-muted);min-width:18px;font-size:0.85rem;">${i + 1}</span>
        <span style="flex:1;font-weight:600;font-size:0.95rem;">${esc(r.name)}</span>
        <span style="color:var(--accent);font-weight:700;">${r.wins}W</span>
        <span style="color:var(--muted);font-size:0.9rem;">${r.losses}L</span>
        ${r.buncos > 0 ? `<span style="font-size:0.85rem;margin-left:2px;">🎲${r.buncos}</span>` : '<span style="min-width:24px;"></span>'}
```
New:
```js
        <span style="color:var(--very-muted);min-width:18px;font-size:var(--fs-small);">${i + 1}</span>
        <span style="flex:1;font-weight:600;font-size:var(--fs-body);">${esc(r.name)}</span>
        <span style="color:var(--accent);font-weight:700;">${r.wins}W</span>
        <span style="color:var(--muted);font-size:var(--fs-small);">${r.losses}L</span>
        ${r.buncos > 0 ? `<span style="font-size:var(--fs-small);margin-left:2px;">🎲${r.buncos}</span>` : '<span style="min-width:24px;"></span>'}
```

- [ ] **Step 3: table-cards.js — card header label and badge (~lines 36–37)**

Old:
```js
          <span class="text-muted" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;">Table ${Number(tableId)}</span>
          ${submitted ? '<span class="badge bg-success" style="font-size:0.75rem;">Submitted</span>' : ''}
```
New:
```js
          <span class="text-muted" style="font-size:var(--fs-caption);text-transform:uppercase;letter-spacing:0.08em;">Table ${Number(tableId)}</span>
          ${submitted ? '<span class="badge bg-success" style="font-size:var(--fs-caption);">Submitted</span>' : ''}
```

- [ ] **Step 4: admin-controller.js — created-date cell (~line 77)**

Old:
```js
    createdTd.style.cssText = 'font-size:0.85rem;color:var(--muted);';
```
New:
```js
    createdTd.style.cssText = 'font-size:var(--fs-small);color:var(--muted);';
```

- [ ] **Step 5: Run the unit tests**

Run: `npm test`
Expected: all suites pass (game-logic and game-utils tests exercise logic, not these template strings).

- [ ] **Step 6: Commit**

```bash
git add src/js/game-controller.js src/js/table-cards.js src/js/admin-controller.js
git commit -m "feat: JS-injected text on raised-floor font tokens"
```

---

### Task 5: Full verification pass

**Files:**
- None modified (verification only; contingency edits from Task 2 allowed).

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Grep floor check**

Run (Git Bash):
```bash
grep -rnE 'font-size:\s*(0\.[0-7][0-9]*rem|[0-9]px|1[01]px)' src/styles src/pages src/layouts src/js --include='*.css' --include='*.astro' --include='*.js' | grep -vE 'tests\.astro|debug|admin-gate'
```
Expected: no output (nothing below 0.8125rem/13px remains in scoped files).

- [ ] **Step 3: Visual pass at 360px, both themes**

With `npm run dev` running, at viewport 360×740, in light AND dark theme (toggle button top-right), walk:
1. `/` home — cards, tagline, join form
2. `/game.html?host=true` — host setup labels
3. Create game → waiting room — game code, "Scan to join", players-joined line
4. Scoring view — top bar, team labels, footer buttons on one row
5. Between-rounds / standings snapshot (or `/standings.html` with a game code)
6. `/scorer.html` — back/reset buttons

Expected: no wrapped footers, no clipped text, no horizontal scroll; small text legible at arm's length.

- [ ] **Step 4: E2E suite**

Run: `npm run e2e`
Expected: all Playwright tests pass (they assert behavior, not font sizes).

- [ ] **Step 5: Final commit if contingency edits were made**

```bash
git status
```
If Task 2's contingency (footer spacing) was applied during verification:
```bash
git add src/styles/game.css
git commit -m "fix: tighten score footer spacing for 360px viewports"
```
