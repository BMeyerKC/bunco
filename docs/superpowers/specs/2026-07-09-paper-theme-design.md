# Paper Score-Sheet Theme + Light/Dark Mode — Design

**Date:** 2026-07-09
**Status:** Approved

## Goal

Replace the current dark-only purple-gradient theme (the generic "modern AI-built site" look) with a distinctive **paper score-sheet** aesthetic, and add a light/dark mode: light is the paper score pad, dark is a chalkboard. Applies to all pages (index, game, scorer, standings, admin, debug).

## Decisions made

- **Direction:** paper score-sheet / hand-drawn (over vintage casino, brutalist, 70s retro).
- **Dark mode concept:** "chalkboard night" — dark mode is a different material (slate chalkboard + chalk), not a dimmed paper.
- **Mode control:** follows system `prefers-color-scheme` by default; a manual toggle overrides and persists in `localStorage`.
- **Implementation approach:** retheme on top of Bootstrap 5.3 — keep all existing markup and Bootstrap behaviors; the change is tokens + component CSS + a small toggle script. (Rejected: dropping Bootstrap — more distinctive ceiling but too much markup churn/regression risk on a working realtime app.)

## Architecture

### Token system (`src/styles/base.css`)

Replace the current purple token set with semantic tokens defined twice:

```css
:root[data-theme="light"] { /* paper */ }
:root[data-theme="dark"]  { /* chalkboard */ }
```

Tokens: `--bg`, `--surface`, `--ink` (primary text), `--ink-soft` (secondary), `--muted`, `--accent` (red pen / chalk pink), `--highlight` (marker yellow / chalk yellow), `--line` (ruled-line color), `--border`, plus shadow/texture tokens as needed. **All component CSS reads only tokens** — one stylesheet serves both modes.

Each theme block also sets `color-scheme: light` / `dark` so native scrollbars and form controls match.

### Theme resolution & toggle

- Small module `src/js/theme.js` exporting `resolveTheme(stored, systemPrefersDark)` → `'light' | 'dark'` (pure, unit-testable) plus apply/toggle helpers.
- **Inline script in `Layout.astro` `<head>`** (before paint, prevents flash of wrong theme): reads `localStorage.theme`, falls back to `prefers-color-scheme`, sets **both** `data-theme` and `data-bs-theme` on `<html>` so Bootstrap-native widgets (toasts, accordion, modals) flip too.
- Live `prefers-color-scheme` change listener applies only when there is no stored manual override.
- **Toggle button:** small fixed control, top-right corner, on all pages (rendered by `Layout.astro`). Hand-drawn sun/moon doodle style. Click flips theme and writes `localStorage.theme`.

## Visual language

### Light — "the score pad"

- Background: warm off-white paper `#f8f4ea` with subtle grain (inline SVG noise data-URI — no image assets).
- Text: soft-black ink (near `#26241f`).
- Accent: **red ball-point pen** (~`#c9403a`) for primary actions and highlights.
- Emphasis: **yellow-highlighter swipe** (e.g., standings leader row).
- Headings sit on ruled underlines, like a printed score sheet.

### Dark — "the chalkboard"

- Background: deep slate-green board `#232e29` with chalk-dust texture.
- Text: chalk white (~`#ecefe8`).
- Accents: pastel chalk — chalk pink replaces red pen, chalk yellow replaces highlighter.
- Borders read as chalk-drawn: slightly rough, semi-transparent white.
- Same components and personality as light; only the material changes.

### Typography

Drop Outfit. Two Google Fonts:

- **Caveat** (bold) — headings, labels, and the big score numbers (legible at the 90–180px score size, and handwritten scores are the point of the theme).
- **Nunito** — body/UI text where legibility matters (forms, buttons, standings stats).

## Component treatments

- **Buttons:** sketchy ink-outlined rectangles; primary = red-pen fill (light) / chalk-pink fill (dark). No gradients, no glow shadows.
- **Cards:** index-card look — surface slightly brighter than page, thin ink border, faint paper shadow.
- **Scoring screen (`game.css`):** the two team halves become two columns of a score pad separated by a ruled vertical line; US/THEM as handwritten column headers. Remove purple/gold gradient tints.
- **BUNCO! overlay:** red rubber-stamp "BUNCO!" slamming down (existing rotate/scale animation, restyled); dice become hand-drawn white dice with ink pips; confetti canvas colors re-pointed at the theme palette (update the JS color array).
- **Player chips:** torn-tape / sticker look.
- **Standings:** winner row gets the highlighter swipe instead of gold gradient.
- **Forms, accordion, toasts, admin/debug:** token-driven restyle — functional and on-theme, no bespoke flourishes.

## Error handling / edge cases

- No `localStorage` (private mode): resolution falls back to system preference; toggle still works for the session.
- First paint: inline head script runs before CSS applies, so no theme flash.
- Old `data-bs-theme="dark"` hardcode in `Layout.astro` is removed (script owns it).

## Testing

- **Unit (Jest, `npm test`):** `resolveTheme()` — stored override beats system; absent/invalid stored value falls back to system.
- **E2E:** existing suites should pass unchanged (markup deltas are the toggle button + class hooks only). Manually verify both themes across index, game, scorer, standings, admin.
- **Accessibility:** verify WCAG AA contrast for ink-on-paper and chalk-on-slate token pairs.

## Out of scope

- Dropping Bootstrap.
- New pages or behavioral changes to game logic.
- Per-page custom themes.
