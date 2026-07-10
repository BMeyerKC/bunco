# Mobile Type Scale — Raised-Floor Font Tokens

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan

## Problem

User feedback: the app looks great on mobile, but the text is small and difficult
to read. The design uses a tier of 11–14px text (uppercase labels, pills, player
chips, helper text, standings rows, secondary buttons) that is legible on desktop
but hard to read at arm's length on a phone. The handwriting font (Caveat) makes
this worse at small sizes because its x-height is short — it reads roughly 20%
smaller than its nominal size.

The fix must not sacrifice the paper/chalkboard personality: no layout changes,
no font swaps, no loss of the "small label" visual style.

## Approach

Raise the floor globally with font-size design tokens, mirroring the existing
color-token system in `src/styles/base.css`. Every hardcoded small font size is
re-pointed at a named token; the tokens set a readable minimum. Rejected
alternatives:

- **Root font-size bump on mobile** (`html { font-size: 17px }` in a media
  query): proportional scaling keeps the bad ratio — 11px becomes 11.7px, still
  unreadable, while already-large text grows for no benefit.
- **Hybrid** (small root bump + fix worst offenders): leaves two sizing systems
  tangled and loses the one-place-to-tune benefit.
- **User-facing text-size setting**: deferred. The floor bump likely resolves
  the complaint; a setting can be added later if low-vision users need more.

## Tokens

Added to the `:root` block in `src/styles/base.css`, alongside `--font-hand`
and `--font-body`:

| Token | Value | Role | Replaces |
|---|---|---|---|
| `--fs-caption` | `0.8125rem` (13px) | Uppercase micro-labels, pills, rank numbers, footer version | 0.65–0.75rem tier |
| `--fs-small` | `0.9375rem` (15px) | Helper text, player chips, standings names/stats, secondary buttons, card text | 0.8125–0.9rem tier |
| `--fs-body` | `1rem` (16px) | Default reading text (unchanged; tokenized so it is tunable) | hardcoded `1rem` |
| `--fs-hand-sm` | `1.45rem` | Caveat handwriting at its smallest uses (round label, team labels) | 1.15–1.4rem |

Design rationale:

- **13px is the floor** for anything a player must read. The micro-label style
  keeps its "small" feel through letter-spacing (`0.175em`), weight (800), and
  uppercase — not through tininess.
- **Caveat gets a bigger bump** (`--fs-hand-sm`) than Nunito text because of its
  short x-height.
- **Large text is untouched**: score numbers (`clamp(90px, 16vw, 180px)`),
  headings, waiting-room code, and the BUNCO! overlay are already legible.

## Application map

Style-value changes only — no markup structure or logic changes. Most edits
are CSS; a few are `font-size` values inside JS template strings that render
user-facing game UI (discovered during planning; amended 2026-07-10).

- **`src/styles/base.css`**: `.label-upper`, `.card-text`, `.player-chip`,
  `.app-toast`; add the four tokens.
- **`src/styles/game.css`**: `.round-label`, `.game-called-pill`,
  `.half-team-label`, `.half-player-names`, `#call-game-btn` /
  `#submit-scores-btn`, `.live-count-pill`, `.standings-rank`,
  `.standings-name`, `.standings-stat`, `.bunco-picker-cancel`,
  `.bunco-picker-player`, `#bunco-pts`, `#bunco-btn`.
- **`src/pages/game.astro`**: inline `font-size` styles (0.7–0.9rem tier) and
  any Bootstrap `.small` usage on user-facing text.
- **`src/pages/index.astro`**: inline sizes. (The `.small` ad-slot div is an
  empty placeholder with no visible text — no change needed.)
- **`src/pages/scorer.astro`**: the page's own `<style>` block (0.75rem and
  0.85rem entries; the giant score clamp stays).
- **`src/pages/admin.astro`**: inline 0.75/0.8rem stat labels (cheap
  consistency; admin is desktop-leaning but there is no reason to leave it
  behind).
- **`src/layouts/Layout.astro`**: footer version stamp (0.65rem → caption
  token).
- **`src/js/game-controller.js`**: submitted-dots table labels (9px → caption
  token) and between-rounds standings rows (0.85–0.95rem tier) — inline styles
  inside template strings; no logic changes.
- **`src/js/table-cards.js`**: table-card header label (0.8rem) and Submitted
  badge (0.75rem) → caption token.
- **`src/js/admin-controller.js`**: created-date cell (0.85rem → small token),
  matching the admin.astro cleanup.

**Out of scope:** `tests.astro` (dev-only page), `debug.astro` timeline
(internal tooling; already ≥0.9rem where it matters), font families, colors,
layout, and the large-type elements listed above.

## Risk

Bigger text inside the fixed scoring top bar and footer could wrap or crowd on
narrow phones. Mitigation: visual pass at a 360px-wide viewport after the
change; if the footer buttons crowd, reduce their horizontal padding rather
than their font size.

## Verification

1. `npm test` — must pass unchanged (JS edits are style values inside
   template strings only; no logic changes).
2. Visual pass at 360px viewport, light and dark themes, through: home → host
   setup → join → waiting room → scoring → standings, plus the scorer page.
3. Grep check: no remaining `font-size` below `0.8125rem` in user-facing
   files.
