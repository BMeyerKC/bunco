# Score-Sheet Redesign — Design

**Date:** 2026-10-06
**Status:** Approved (scope, host-setup stepper, Bootstrap removal confirmed in chat)

## Goal

Make every page easy to use at a real game night (phones, dim rooms, people
who are not "app people") while keeping the playful paper/chalkboard spirit.
The July paper theme was the right idea but stopped at re-skinning Bootstrap;
this pass commits to the score-sheet concept and fixes the usability gaps.

## Problems this fixes

- Joining (the most common action) is the third card and below the fold on phones.
- Quick Scorer has no way to start a new set, no "tap to add" hint, no 21 marker,
  and the screen can sleep mid-set.
- Host setup asks for "tables" and "ghost player slots" (0–11 dropdown).
- `alert()` for a bad join code; truncated placeholder on Standings; footer
  floating mid-screen; fixed Home/theme buttons covering content; empty ad gap.
- Three equal cards = no hierarchy. Tracked ALL-CAPS labels everywhere.
- Inline styles fighting Bootstrap's defaults → inconsistent spacing.

## Visual language

**Concept: the score sheet on the card table.** Light = a real ruled score pad;
dark = the chalkboard (unchanged concept). Red is reserved for the margin line
and the BUNCO! stamp so the big moment owns it.

| Token | Light (score pad) | Dark (chalkboard) | Role |
|---|---|---|---|
| `--paper` | `#fdfcf7` | `#232e29` | page |
| `--card` | `#ffffff` | `#2b3833` | index cards, fields |
| `--ink` | `#24262b` | `#ecefe8` | text |
| `--pen` | `#1f4aa8` | `#a9c8f0` | blue ballpoint: primary actions, scores, links |
| `--margin` | `#d9474c` | `#f0a8a2` | red margin line, BUNCO! stamp only |
| `--marker` | `#ffe66b` | `#eee3a8` | highlighter: leader, winner, "game called" |
| `--rule` | `#b4cbe6` | `rgba(236,239,232,.18)` | ruled lines, dividers |

**Type.** Kalam (handwriting) for headings and the big score numerals — scores
look written in pen. Nunito for everything people read. Body is 17px (older
audience); scale ≈1.25: 13 / 15 / 17 / 21 / 26 / 33 / 42 / 52. Sentence case
labels, no tracked caps.

**Shape.** Keep the hand-drawn "wobble" radius on buttons and cards; one
consistent 2px ink stroke. One shadow token, used sparingly.

**Motion.** BUNCO! stamp + confetti stays the one orchestrated moment.
Everything else: feedback-only motion (score pop, sheet open). Respect
`prefers-reduced-motion`.

## Shared shell

- Slim top bar in normal flow (not fixed): wordmark/Home link left, theme
  toggle right. The scoring screen keeps its own bar.
- Sticky footer (body is a flex column) with version + Feedback.
- `<dialog>` for the feedback form and BUNCO picker; `<details>` for the rules
  reference. Bootstrap removed in the final stage.
- 48px minimum tap targets, visible `:focus-visible` ring in `--pen`.
- Inline field errors (`.field-error`) instead of `alert()`.

## Pages

- **Home:** hero is the join box — four dice-like slots mirroring one real
  `<input>` (paste works, screen readers see a normal field) + "Join game".
  Resume note sits above it when relevant. Below: two quieter rows, "Host a
  game night" and "Just keep score". Rules as numbered steps (a real
  sequence) then a `<details>` reference.
- **Host setup:** one "How many players?" stepper (8–24). Shows "3 tables ·
  1 ghost seat" live, with a one-line explanation of ghosts. Writes the
  existing `#setup-tables` / `#setup-ghosts` values so the controller is unchanged.
- **Waiting room / join / between rounds / submitted:** same IDs, restyled as
  index cards on the sheet; JS-generated rows move from inline styles to classes.
- **Scoring + Quick Scorer:** scores in blue pen, 21 marked with highlighter,
  hint "Tap a side to add a point" until first tap. Quick Scorer gains "New
  set" (with undo toast) and a screen wake lock.
- **Standings:** proper table header, fixed placeholder, cleaner table cards.

## Staging

1. Foundation: tokens, type, shared components, top bar, footer, a11y floor.
2. Home + join.
3. Quick Scorer + game screens, including the host setup stepper.
4. Standings, admin/debug/tests restyle, remove Bootstrap.

Each stage is its own PR, stacked; e2e selectors updated where markup changes.
