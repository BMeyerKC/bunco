# Paper Score-Sheet Theme + Light/Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark-only purple theme with a paper score-sheet aesthetic — light mode is a paper score pad, dark mode is a chalkboard — with system-following, manually overridable theme switching.

**Architecture:** Semantic CSS tokens defined twice (`:root[data-theme="light"]` / `:root[data-theme="dark"]`) in `base.css`; all component CSS reads only tokens. A pre-paint inline script in `Layout.astro` sets `data-theme` + `data-bs-theme` from `localStorage`/system preference; `src/js/theme.js` handles toggle + live system changes and is unit-tested.

**Tech Stack:** Astro 6, Bootstrap 5.3 (kept), Jest (jsdom), Playwright. Google Fonts: Caveat (handwriting) + Nunito (body). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-09-paper-theme-design.md`

## Global Constraints

- Run unit tests with `npm test` (NOT `npx jest` — the script needs `--experimental-vm-modules`).
- Jest tests live in `tests/` (that's the configured root), use standard `describe`/`test`/`expect`, jsdom environment.
- Keep all existing element IDs and `data-view` structure — e2e tests and controllers depend on them.
- localStorage key for theme: `bunco_theme` (matches existing `bunco_device_id` convention).
- Token names `--bg, --surface, --border, --text, --text-secondary, --muted, --very-muted` MUST keep their names — page inline styles reference them. Purple/gold tokens (`--purple`, `--purple-mid`, `--purple-light`, `--gold`, `--gold-deep`) are deleted; nothing may reference them when done.
- Commit after every task. `docs/` is gitignored — plan/spec commits need `git add -f`.

---

### Task 1: Theme module with unit tests

**Files:**
- Create: `src/js/theme.js`
- Test: `tests/theme.test.js`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `resolveTheme(stored, systemPrefersDark) → 'light'|'dark'`, `applyTheme(theme)`, `getStoredTheme() → string|null`, `setStoredTheme(theme)`, `currentTheme() → 'light'|'dark'`, `toggleTheme() → newTheme`, `initTheme()` (wires `#theme-toggle` click + system-change listener). Storage key `'bunco_theme'`.

- [ ] **Step 1: Write the failing test**

Create `tests/theme.test.js`:

```js
// tests/theme.test.js
import {
  resolveTheme,
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  currentTheme,
  toggleTheme,
} from '../src/js/theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-bs-theme');
});

describe('resolveTheme', () => {
  test('stored light wins over system dark', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });
  test('stored dark wins over system light', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  test('no stored value falls back to system dark', () => {
    expect(resolveTheme(null, true)).toBe('dark');
  });
  test('no stored value falls back to system light', () => {
    expect(resolveTheme(null, false)).toBe('light');
  });
  test('invalid stored value falls back to system', () => {
    expect(resolveTheme('purple', true)).toBe('dark');
  });
});

describe('applyTheme', () => {
  test('sets both data-theme and data-bs-theme on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });
});

describe('stored theme', () => {
  test('setStoredTheme persists and getStoredTheme reads it back', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(localStorage.getItem('bunco_theme')).toBe('dark');
  });
  test('getStoredTheme returns null when localStorage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getStoredTheme()).toBeNull();
    spy.mockRestore();
  });
});

describe('toggleTheme', () => {
  test('flips light to dark, applies it, and persists', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(currentTheme()).toBe('dark');
    expect(localStorage.getItem('bunco_theme')).toBe('dark');
  });
  test('flips dark to light', () => {
    applyTheme('dark');
    expect(toggleTheme()).toBe('light');
    expect(currentTheme()).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/theme.test.js`
Expected: FAIL — "Cannot find module '../src/js/theme.js'"

- [ ] **Step 3: Write the implementation**

Create `src/js/theme.js`:

```js
// js/theme.js — light/dark theme resolution, persistence, and toggle.
// Initial pre-paint application happens in an inline script in Layout.astro
// (it can't import modules); resolveTheme is the single source of truth for
// the resolution rule, and the inline script mirrors it.

const STORAGE_KEY = 'bunco_theme';

/**
 * @param {string|null} stored - value from localStorage, if any
 * @param {boolean} systemPrefersDark
 * @returns {'light'|'dark'}
 */
export function resolveTheme(stored, systemPrefersDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Sets the theme on <html> for both our tokens and Bootstrap. */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
}

/** @returns {string|null} stored override, or null (also when storage is unavailable) */
export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage denied — theme still applies for this page view.
  }
}

/** @returns {'light'|'dark'} theme currently applied to <html> */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Flips the theme, applies it, persists it. @returns the new theme */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setStoredTheme(next);
  return next;
}

/**
 * Wires up the toggle button and follows live system changes
 * (only while the user has no manual override).
 */
export function initTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(resolveTheme(null, e.matches));
  });
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/theme.test.js`
Expected: PASS (10 tests)

Then run the whole suite: `npm test` — expected: all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/theme.test.js src/js/theme.js
git commit -m "feat: theme module — resolve/apply/toggle light-dark with persistence"
```

---

### Task 2: Layout.astro — fonts, pre-paint script, toggle button

**Files:**
- Modify: `src/layouts/Layout.astro`

**Interfaces:**
- Consumes: `initTheme` from `src/js/theme.js` (Task 1); storage key `'bunco_theme'`.
- Produces: `<html>` gets `data-theme` + `data-bs-theme` before first paint; `#theme-toggle` button with `.theme-toggle` class and two icon spans (`.theme-icon-to-dark`, `.theme-icon-to-light`) exists on every page (styled in Task 3); Caveat + Nunito fonts loaded.

Note: after this task and until Task 3 lands, light mode temporarily shows the old dark palette (old `:root` tokens ignore `data-theme`). The site stays fully usable; Task 3 completes the switch.

- [ ] **Step 1: Replace the font link and remove the hardcoded theme**

In `src/layouts/Layout.astro`, change the `<html>` tag (remove `data-bs-theme="dark"`):

```html
<html lang="en">
```

Replace the Outfit font link:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
```

with:

```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Add the pre-paint theme script**

In the `<head>`, immediately after `<title>{title}</title>` (before any stylesheet links, so the theme attribute exists when CSS applies):

```html
<script is:inline>
  // Pre-paint theme application — mirrors resolveTheme() in src/js/theme.js.
  (function () {
    var stored = null;
    try { stored = localStorage.getItem('bunco_theme'); } catch (e) {}
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
  })();
</script>
```

- [ ] **Step 3: Add the toggle button and init script**

In `<body>`, immediately before `<slot />`:

```html
<button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch between light and dark theme">
  <span class="theme-icon-to-dark" aria-hidden="true">☾</span>
  <span class="theme-icon-to-light" aria-hidden="true">☀</span>
</button>
```

After the Bootstrap bundle `<script is:inline src="...bootstrap.bundle.min.js">` line, add a bundled module script:

```html
<script>
  import { initTheme } from '../js/theme.js';
  initTheme();
</script>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds with no errors.

Run: `npm test`
Expected: all suites still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: pre-paint theme script, toggle button, Caveat+Nunito fonts"
```

---

### Task 3: base.css — token system + global component restyle (+ toast classes)

**Files:**
- Modify: `src/styles/base.css` (full rewrite)
- Modify: `src/js/ui.js` (`showToast` — inline colors → CSS classes)

**Interfaces:**
- Consumes: `data-theme` attribute from Task 2; `#theme-toggle` markup from Task 2.
- Produces: the complete token vocabulary used by Tasks 4–5: `--bg, --surface, --border, --sketch, --text, --ink, --ink-soft, --text-secondary, --muted, --very-muted, --accent, --accent-contrast, --accent-soft, --highlight, --highlight-soft, --line, --bg-veil, --overlay-veil, --shadow, --grain-opacity, --font-hand, --font-body, --wobble, --wobble-sm`. Also classes `.theme-toggle`, `.app-toast`/`.app-toast-{info,success,warning}`, `.card-featured`, `.ruled-heading`.

- [ ] **Step 1: Replace the entire contents of `src/styles/base.css`**

```css
/* View system — must override Bootstrap's d-flex !important */
[data-view]:not(.view-active) {
  display: none !important;
}

/* ── Design tokens ──
   Two materials, one personality:
   light = paper score pad, dark = chalkboard at night. */

:root,
:root[data-theme="light"] {
  color-scheme: light;
  --bg:              #f8f4ea;  /* warm off-white paper */
  --surface:         #fffdf6;  /* index card */
  --border:          #d8d2c0;  /* pencil gray */
  --sketch:          #3a372f;  /* drawn ink line */
  --text:            #26241f;  /* soft-black ink */
  --ink:             #26241f;
  --ink-soft:        #5b564a;
  --text-secondary:  #5b564a;
  --muted:           #8a8375;
  --very-muted:      #b3ac9c;
  --accent:          #c9403a;  /* red ball-point pen */
  --accent-contrast: #fffdf6;
  --accent-soft:     rgba(201, 64, 58, 0.10);
  --highlight:       #f7e17d;  /* yellow marker */
  --highlight-soft:  rgba(247, 225, 125, 0.45);
  --line:            #b8cade;  /* ruled-line blue */
  --bg-veil:         rgba(248, 244, 234, 0.92);
  --overlay-veil:    rgba(58, 55, 47, 0.5);
  --shadow:          0 2px 8px rgba(90, 80, 60, 0.18);
  --grain-opacity:   0.05;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg:              #232e29;  /* slate-green chalkboard */
  --surface:         #2b3833;
  --border:          rgba(236, 239, 232, 0.30);
  --sketch:          rgba(236, 239, 232, 0.55);  /* chalk line */
  --text:            #ecefe8;  /* chalk white */
  --ink:             #ecefe8;
  --ink-soft:        #c2c9bd;
  --text-secondary:  #c2c9bd;
  --muted:           #96a099;
  --very-muted:      #6b756e;
  --accent:          #f0a8a2;  /* chalk pink */
  --accent-contrast: #232e29;
  --accent-soft:     rgba(240, 168, 162, 0.14);
  --highlight:       #eee3a8;  /* chalk yellow */
  --highlight-soft:  rgba(238, 227, 168, 0.20);
  --line:            rgba(236, 239, 232, 0.35);
  --bg-veil:         rgba(35, 46, 41, 0.92);
  --overlay-veil:    rgba(0, 0, 0, 0.6);
  --shadow:          0 2px 10px rgba(0, 0, 0, 0.35);
  --grain-opacity:   0.07;
}

:root {
  --font-hand: 'Caveat', 'Segoe Print', cursive;
  --font-body: 'Nunito', system-ui, sans-serif;
  /* Wobbly border-radius gives the hand-drawn look without images */
  --wobble-sm: 125px 10px 115px 10px / 10px 115px 10px 125px;
}

/* ── Base ── */
body {
  background-color: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
}

/* Paper grain / chalk dust — fixed low-opacity noise film over everything */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: none;
  opacity: var(--grain-opacity);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── Typography ── */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-hand);
  letter-spacing: 0.01em;
}

.ruled-heading {
  border-bottom: 2px solid var(--line);
  padding-bottom: 2px;
}

.text-muted { color: var(--muted) !important; }

.label-upper {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.175em;
  text-transform: uppercase;
  font-family: var(--font-body);
  color: var(--very-muted);
}

/* ── Cards ── */
.card {
  background-color: var(--surface);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  box-shadow: var(--shadow);
}
.card-title { color: var(--text); font-weight: 700; font-size: 1.6rem; }
.card-text  { color: var(--muted); font-size: 0.875rem; font-family: var(--font-body); }

.card-featured {
  border-color: var(--accent);
  background: linear-gradient(0deg, var(--accent-soft), var(--accent-soft)), var(--surface);
}

/* ── Buttons ── */
.btn-primary, .btn-light, .btn-success {
  background: var(--accent);
  color: var(--accent-contrast);
  border: 2px solid var(--accent);
  border-radius: var(--wobble-sm);
  font-family: var(--font-body);
  font-weight: 800;
  box-shadow: var(--shadow);
}
.btn-primary:hover, .btn-light:hover, .btn-success:hover {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: var(--accent);
  filter: brightness(0.94) saturate(1.1);
}
.btn-primary:disabled, .btn-light:disabled, .btn-success:disabled {
  background: var(--surface);
  color: var(--very-muted);
  border: 2px dashed var(--border);
  box-shadow: none;
}

.btn-outline-light {
  background: transparent;
  color: var(--ink);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  font-family: var(--font-body);
  font-weight: 700;
}
.btn-outline-light:hover {
  background: var(--accent-soft);
  color: var(--ink);
  border-color: var(--sketch);
}

.btn-outline-secondary {
  background: transparent;
  color: var(--muted);
  border: 1.5px solid var(--border);
  border-radius: var(--wobble-sm);
  font-family: var(--font-body);
}
.btn-outline-secondary:hover {
  background: var(--accent-soft);
  color: var(--text-secondary);
  border-color: var(--muted);
}

/* ── Form controls ── */
.form-control, .form-select {
  background-color: var(--surface);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  color: var(--text);
  font-family: var(--font-body);
}
.form-control:focus, .form-select:focus {
  background-color: var(--surface);
  border-color: var(--accent);
  color: var(--text);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.form-control::placeholder { color: var(--very-muted); }

/* ── Player chip — name-tag sticker ── */
.player-chip {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--font-body);
  background: var(--surface);
  color: var(--ink-soft);
  border: 1.5px solid var(--sketch);
  box-shadow: var(--shadow);
  transform: rotate(-1deg);
  transition: translate 0.2s ease, opacity 0.2s ease;
}
.player-chip:nth-child(even) { transform: rotate(1.2deg); }
/* Animate `translate` (not `transform`) so the sticker rotation survives */
.player-chip.chip-new {
  animation: chipSlideIn 0.25s ease;
}
@keyframes chipSlideIn {
  from { translate: 0 8px; opacity: 0; }
  to   { translate: 0 0;   opacity: 1; }
}

/* ── Accordion ── */
.accordion-item {
  background-color: var(--surface);
  border-color: var(--border);
}
.accordion-button {
  background-color: var(--surface);
  color: var(--text);
  font-family: var(--font-body);
  font-weight: 700;
}
.accordion-button:not(.collapsed) {
  background-color: var(--accent-soft);
  color: var(--ink);
  box-shadow: inset 0 -1px 0 var(--border);
}
/* Arrow icon: Bootstrap 5.3 swaps it per data-bs-theme — no filter needed */
.accordion-body {
  background-color: var(--surface);
  color: var(--text-secondary);
  font-family: var(--font-body);
}

/* ── Theme toggle ── */
.theme-toggle {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 900;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  box-shadow: var(--shadow);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transform: rotate(2deg);
  transition: transform 0.15s ease;
}
.theme-toggle:hover { transform: rotate(-2deg) scale(1.06); }
/* Show the icon of the mode you'd switch TO */
:root[data-theme="light"] .theme-icon-to-light { display: none; }
:root[data-theme="dark"] .theme-icon-to-dark { display: none; }

/* ── Toasts (created by ui.js showToast) ── */
.app-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: var(--wobble-sm);
  font-size: 1rem;
  font-family: var(--font-body);
  font-weight: 700;
  z-index: 9999;
  border: 2px solid var(--sketch);
  box-shadow: var(--shadow);
}
.app-toast-info    { background: var(--surface); color: var(--text); }
.app-toast-success { background: var(--accent); color: var(--accent-contrast); border-color: var(--accent); }
.app-toast-warning { background: var(--highlight); color: #26241f; border-color: #26241f; }

.toast { font-family: var(--font-body); }
```

- [ ] **Step 2: Update `showToast` in `src/js/ui.js`**

Replace the whole `showToast` function (keep the id `bunco-toast` — controllers/e2e reference it):

```js
/**
 * Shows a toast notification styled by .app-toast classes in base.css.
 * @param {string} message
 * @param {'info'|'success'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bunco-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bunco-toast';
  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
```

- [ ] **Step 3: Verify**

Run: `npm test` — expected: all PASS.
Run: `npm run build` — expected: success.
Run: `npm run dev` in the background, open `http://localhost:4321/` in a browser, and confirm: paper background in light, chalkboard in dark (flip via the toggle button), no purple anywhere on the home page body (the game page still shows old purple in `game.css` — that's Task 4). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/styles/base.css src/js/ui.js
git commit -m "feat: paper/chalkboard token system and global component restyle"
```

---

### Task 4: game.css restyle + game.astro/debug.astro token fixes

**Files:**
- Modify: `src/styles/game.css` (full rewrite)
- Modify: `src/pages/game.astro` (line ~178 inline checkmark style → class; confetti colors → theme tokens)
- Modify: `src/pages/debug.astro` (line 8: `var(--purple-light)` → `var(--accent)`)

**Interfaces:**
- Consumes: all tokens from Task 3.
- Produces: class `.submitted-check` (used by game.astro). All layout/IDs/animation class names unchanged (`playBuncoAnimation` and controllers keep working).

- [ ] **Step 1: Replace the entire contents of `src/styles/game.css`**

```css
/* css/game.css — game-specific layout and animations */

/* ── View fade transitions ── */
[data-view].view-active {
  animation: viewFadeIn 0.2s ease forwards;
}
@keyframes viewFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Scoring screen ── */
#view-scoring {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.score-topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 12px 16px;
  z-index: 20;
  background: var(--bg-veil);
  border-bottom: 2px solid var(--line);
}

.score-topbar .round-label {
  color: var(--ink-soft);
  font-family: var(--font-hand);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.game-called-pill {
  display: none;
  background: var(--highlight-soft);
  color: var(--ink);
  border: 1.5px dashed var(--accent);
  padding: 3px 12px;
  border-radius: 4px;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.game-called-pill.visible { display: inline-block; }

.score-halves {
  display: flex;
  width: 100%;
  height: 100%;
  padding-top: 48px;
  padding-bottom: 70px;
}

.score-half {
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

/* Score-pad columns are plain paper; the ruled divider separates them */
.score-half-divider {
  width: 0;
  border-left: 2px dashed var(--line);
  align-self: stretch;
  margin-top: 48px;
  margin-bottom: 70px;
}

.half-team-label {
  color: var(--ink-soft);
  font-family: var(--font-hand);
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.half-player-names {
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
  padding: 0 12px;
}

.half-score-num {
  font-family: var(--font-hand);
  font-size: clamp(90px, 16vw, 180px);
  font-weight: 700;
  color: var(--ink);
  line-height: 1;
  transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
.half-score-num.score-pop {
  animation: scorePop 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes scorePop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.09); }
  100% { transform: scale(1); }
}

.half-dec-btn {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 1.6rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s;
}
.half-dec-btn:hover {
  border-color: var(--sketch);
  color: var(--ink-soft);
}

/* ── Scoring footer ── */
.score-footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 16px;
  z-index: 20;
  background: var(--bg-veil);
  border-top: 2px solid var(--line);
}

#bunco-btn {
  background: var(--accent);
  color: var(--accent-contrast);
  border: 2px solid var(--accent);
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 11px 24px;
  border-radius: var(--wobble-sm);
  cursor: pointer;
  box-shadow: var(--shadow);
  transform: rotate(-1.5deg);
  transition: transform 0.15s, filter 0.15s;
}
#bunco-btn:hover {
  filter: brightness(0.94) saturate(1.1);
  transform: rotate(-1.5deg) translateY(-1px);
}
#bunco-btn:disabled {
  background: transparent;
  color: var(--very-muted);
  border: 2px dashed var(--border);
  box-shadow: none;
  transform: none;
  cursor: not-allowed;
}

#call-game-btn, #submit-scores-btn {
  background: transparent;
  border: 2px solid var(--sketch);
  color: var(--ink-soft);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 9px 18px;
  border-radius: var(--wobble-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
#call-game-btn:hover, #submit-scores-btn:hover {
  background: var(--accent-soft);
  color: var(--ink);
}

/* ── BUNCO! animation overlay ── */
#bunco-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  display: none;
}
#bunco-overlay.playing { display: block; }

#bunco-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

#bunco-flash {
  position: absolute;
  inset: 0;
  background: var(--highlight-soft);
  opacity: 0;
}
#bunco-flash.go { animation: flashFade 0.4s ease forwards; }
@keyframes flashFade {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}

#bunco-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

/* Rubber-stamp BUNCO! */
#bunco-text {
  font-family: var(--font-hand);
  font-size: clamp(48px, 10vw, 72px);
  font-weight: 700;
  color: var(--accent);
  border: 5px solid var(--accent);
  border-radius: var(--wobble-sm);
  padding: 2px 26px;
  background: var(--bg-veil);
  transform: scale(0);
  opacity: 0;
  line-height: 1.15;
}
#bunco-text.pop {
  animation: buncoTextPop 0.5s cubic-bezier(0.17, 0.67, 0.3, 1.4) forwards;
}
@keyframes buncoTextPop {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.12) rotate(-1deg); opacity: 1; }
  100% { transform: scale(1) rotate(-4deg); opacity: 1; }
}

#bunco-dice {
  display: flex;
  gap: 14px;
  transform: translateY(18px);
  opacity: 0;
}
#bunco-dice.slide-in {
  animation: diceSlideUp 0.4s 0.45s ease forwards;
}
@keyframes diceSlideUp {
  to { transform: translateY(0); opacity: 1; }
}

/* Hand-drawn dice: paper face, ink pips */
.bunco-die {
  width: 52px; height: 52px;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--sketch);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: var(--shadow);
}
.bunco-die.shake {
  animation: dieShake 0.5s 0.65s ease both;
}
@keyframes dieShake {
  0%,100% { transform: rotate(0deg); }
  20%  { transform: rotate(-12deg) scale(1.1); }
  40%  { transform: rotate(10deg) scale(1.15); }
  60%  { transform: rotate(-8deg) scale(1.1); }
  80%  { transform: rotate(6deg); }
}

#bunco-pts {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink-soft);
  opacity: 0;
}
#bunco-pts.fade-in { animation: ptsFadeIn 0.3s 0.95s ease forwards; }
@keyframes ptsFadeIn { to { opacity: 1; } }

/* ── Waiting room ── */
.waiting-code-display {
  font-family: var(--font-hand);
  font-size: clamp(40px, 12vw, 64px);
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--ink);
  line-height: 1;
}

/* ── Join screen live count ── */
.live-count-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--highlight-soft);
  border: 1.5px dashed var(--sketch);
  border-radius: var(--wobble-sm);
  padding: 10px 14px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--ink);
  font-weight: 700;
}
.live-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: livePulse 1.5s ease-in-out infinite;
}
@keyframes livePulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}

/* ── Submitted progress dots ── */
.table-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.3s ease;
}
.table-dot.submitted { background: var(--accent); }
.table-dot.waiting   { animation: dotPulse 1.5s ease-in-out infinite; }
@keyframes dotPulse {
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 1; }
}

/* ── Submitted checkmark badge ── */
.submitted-check {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--accent-soft);
  border: 2px solid var(--accent);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin: 0 auto 1.25rem;
}

/* ── Seat info card ── */
.seat-info-card {
  background: var(--accent-soft);
  border: 1.5px solid var(--accent);
  border-radius: var(--wobble-sm);
  padding: 16px;
}

/* ── Standings rows ── */
.standings-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-family: var(--font-body);
}
/* Leader gets the highlighter swipe */
.standings-row-first {
  background:
    linear-gradient(100deg,
      transparent 0.5%,
      var(--highlight-soft) 2.5%,
      var(--highlight-soft) 97.5%,
      transparent 99.5%),
    var(--surface);
  border: 1px solid var(--highlight);
}
.standings-rank { font-size: 0.75rem; font-weight: 800; color: var(--very-muted); width: 18px; flex-shrink: 0; }
.standings-rank-1 { color: var(--accent); }
.standings-name { font-size: 0.875rem; font-weight: 700; color: var(--text); flex: 1; }
.standings-stat { font-size: 0.8125rem; font-weight: 800; color: var(--muted); min-width: 28px; text-align: center; }
.standings-stat-highlight { color: var(--text); }

/* ── BUNCO player picker modal ── */
.bunco-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 40; /* above score footer (20), below the BUNCO celebration overlay (100) */
  background: var(--overlay-veil);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.bunco-picker-card {
  background: var(--surface);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  box-shadow: var(--shadow);
  padding: 20px;
  width: 100%;
  max-width: 340px;
  text-align: center;
}

.bunco-picker-title {
  font-weight: 700;
  font-size: 1.5rem;
  margin-bottom: 14px;
}

.bunco-picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.bunco-picker-player {
  background: var(--accent);
  color: var(--accent-contrast);
  border: 2px solid var(--accent);
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 800;
  padding: 12px 16px;
  border-radius: var(--wobble-sm);
  cursor: pointer;
}

.bunco-picker-cancel {
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 700;
  padding: 8px 16px;
  cursor: pointer;
}
```

- [ ] **Step 2: Fix hardcoded colors in `src/pages/game.astro`**

Replace the inline-styled checkmark div in the `view-submitted` view (currently `<div style="width:64px; height:64px; border-radius:50%; background:rgba(124,58,237,0.15); ...">✓</div>`) with:

```html
<div class="submitted-check">✓</div>
```

In the inline `launchConfetti` function, replace:

```js
const colors = ['#a855f7','#fbbf24','#c084fc','#ffffff','#f59e0b','#e879f9'];
```

with:

```js
const styles = getComputedStyle(document.documentElement);
const themeColors = ['--accent', '--highlight', '--line', '--ink-soft']
  .map(n => styles.getPropertyValue(n).trim())
  .filter(Boolean);
const colors = themeColors.length ? themeColors : ['#c9403a', '#f7e17d'];
```

- [ ] **Step 3: Fix `src/pages/debug.astro`**

Line 8: change `color:var(--purple-light)` to `color:var(--accent)`.

- [ ] **Step 4: Verify no dead token references remain**

Run: `grep -rn "purple\|--gold" src/` (Grep tool: pattern `--purple|--gold` in `src/`)
Expected: no matches.

Run: `npm test` — all PASS. Run: `npm run build` — success.

- [ ] **Step 5: Commit**

```bash
git add src/styles/game.css src/pages/game.astro src/pages/debug.astro
git commit -m "feat: restyle game screens to paper/chalkboard theme"
```

---

### Task 5: index.astro + scorer.astro cleanups

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/pages/scorer.astro`

**Interfaces:**
- Consumes: tokens and `.card-featured` / `.ruled-heading` classes from Task 3.
- Produces: no new interfaces; pages fully tokenized.

- [ ] **Step 1: index.astro edits**

1. Delete the purple radial-glow div (the `<div style="position:absolute; ... radial-gradient(circle, rgba(124,58,237,0.22) ...">` inside the logo block).
2. On the "Start a Game" card, replace the inline style with the featured class:

```html
<div class="card card-featured h-100 text-center p-3">
```

3. Add `ruled-heading` to the two section headings:

```html
<h2 class="h4 fw-bold mb-3 ruled-heading">How to Play Bunco</h2>
```

```html
<h2 class="h4 fw-bold mb-3 ruled-heading">Full Bunco Reference</h2>
```

- [ ] **Step 2: scorer.astro — tokenize the page-local style block**

In the `<style is:global>` block, make these replacements (layout rules unchanged):

```css
html, body {
  width: 100%;
  height: 100%;
  background: var(--bg);
  overflow: hidden;
}

#back-btn {
  position: fixed;
  top: 12px;
  left: 12px;
  background: transparent;
  border: 1.5px solid var(--sketch);
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: var(--wobble-sm);
  cursor: pointer;
  z-index: 10;
  text-decoration: none;
}

#back-btn:hover { color: var(--ink-soft); border-color: var(--ink-soft); }
```

Half tints and winner states (replace the four `#us-half`/`#them-half` rules and `.winner .score`):

```css
#us-half   { background-color: var(--accent-soft); }
#them-half { background-color: var(--highlight-soft); }
#us-half.winner   { background-color: var(--accent); }
#us-half.winner .score, #us-half.winner .label { color: var(--accent-contrast); }
#them-half.winner { background-color: var(--highlight); }
#them-half.winner .score, #them-half.winner .label { color: #26241f; }

.winner .score { text-shadow: none; }

.half:active { background-color: var(--accent-soft); }
```

Labels, score, divider, decrement, reset (replace the corresponding rules; keep all layout properties as they are, changing only the properties shown):

```css
.label {
  color: var(--muted);
  font-family: var(--font-hand);
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: none;
  margin-bottom: 12px;
}

.score {
  color: var(--ink);
  font-family: var(--font-hand);
  font-size: clamp(120px, 22vw, 240px);
  font-weight: 700;
  line-height: 1;
}

.divider { width: 0; border-left: 2px dashed var(--line); background: none; align-self: stretch; }
```

In `.decrement`: `border: 2px solid var(--border); color: var(--muted);` (rest unchanged).
`.decrement:active { background: var(--accent-soft); color: var(--ink); }`
In `#reset-btn`: `border: 1.5px solid var(--sketch); color: var(--muted); font-family: var(--font-body); border-radius: var(--wobble-sm);` (rest unchanged).
`#reset-btn:active { border-color: var(--ink-soft); color: var(--ink-soft); }`

- [ ] **Step 3: Verify**

Run: `grep -rn "rgba(124" src/pages/` — expected: no matches.
Run: `npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/pages/scorer.astro
git commit -m "feat: tokenize index and scorer pages for paper theme"
```

---

### Task 6: Full verification

**Files:** none created — verification only.

- [ ] **Step 1: Unit tests**

Run: `npm test`
Expected: all suites PASS (including `tests/theme.test.js`).

- [ ] **Step 2: Build + e2e**

Run: `npm run build` — expected: success.
Run: `npx playwright test` — expected: all e2e tests PASS. If any fail, inspect whether the failure is a selector/visual assumption from the old theme (fix the styling or test accordingly — IDs and views were preserved, so failures should be rare).

- [ ] **Step 3: Manual dual-theme walkthrough**

Start `npm run dev` (background). In a browser, check in BOTH themes (flip with the toggle; verify the choice persists across a reload, and that clearing `localStorage.bunco_theme` makes it follow the system setting):

1. `/` — paper/chalkboard bg, Caveat headings, featured card, accordion, ruled headings.
2. `/game.html?host=true` — setup flow, waiting room code display, chips.
3. Scoring screen — score pad columns, ruled divider, BUNCO stamp button, footer.
4. `/scorer.html` — halves tinted accent/highlight, winner states readable.
5. `/standings.html` — leader row has highlighter swipe.
6. `/admin.html`, `/debug.html` — legible, no leftover purple.
7. No flash of wrong theme on hard reload in dark mode.

Stop the dev server.

- [ ] **Step 4: Contrast spot-check**

Verify these token pairs meet WCAG AA (4.5:1 for normal text) with a contrast checker:
- light: `#26241f` on `#f8f4ea` (ink on paper) — passes (~13:1)
- light: `#fffdf6` on `#c9403a` (button text on red pen) — passes (~4.6:1)
- dark: `#ecefe8` on `#232e29` (chalk on board) — passes (~12:1)
- dark: `#232e29` on `#f0a8a2` (button text on chalk pink) — passes (~7:1)

- [ ] **Step 5: Final commit (if any fixups were needed)**

```bash
git status
git add <changed files>
git commit -m "fix: theme walkthrough fixups"
```
