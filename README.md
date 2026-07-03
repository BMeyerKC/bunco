# Bunco Score Keeper

Live scoring app for Bunco game nights, hosted at **bunco.io**.

## What it is

A static web app that supports two play modes:

- **Quick Scorer** (`scorer.html`) — single-table score tracker, landscape-optimized tap interface, no setup
- **Full Game** (`game.html`) — host/join via 4-character code, full 6-round game with automatic seat rotation, standings, and Bunco tracking. Real-time sync via Firebase Realtime Database.

## Project structure

```
src/
  pages/
    index.astro       Landing page (rules, SEO content, navigation)
    game.astro        Full multiplayer game (host + join views)
    standings.astro   Live standings dashboard
    scorer.astro      Quick single-table scorer
    debug.astro       Developer event log timeline (debug.html?code=XXXX)
    admin.astro       Gated admin hub (admin.html) — quick links, recent games, stats
    tests.astro       Browser-based unit test runner
  layouts/
    Layout.astro      Master layout (Bootstrap CDN, Outfit font, version footer)
    GameLayout.astro  Extends Layout, adds game.css
  js/
    firebase.js       Firebase Realtime Database read/write helpers + EVENT constants + logEvent
    game-logic.js     Pure game logic (seat assignment, rotation, standings)
    game-controller.js  UI controller wiring Firebase + game-logic + DOM
    game-utils.js     Shared utilities (ghost names, seat helpers)
    ui.js             Shared UI helpers (showView, showToast, getParam, getDeviceId)
    standings-controller.js  Standings page logic
    debug-controller.js      Event log timeline rendering for debug page
    admin-gate.js            Passphrase gate for admin page (Firebase Auth slot-in later)
    admin-controller.js      Admin dashboard rendering (recent games, stats, debug jump)
  styles/
    base.css          Shared styles
    game.css          Game page styles
public/
  ads.txt
tests/
  game-logic.test.js     Jest unit tests for game-logic.js
  game-utils.test.js     Jest unit tests for game-utils.js
  table-cards.test.js    Jest unit tests for table-cards.js
  firebase-event.test.js Jest unit tests for EVENT constants in firebase.js
```

## How the full game works

1. Host creates a game (tables, ghost slots) → Firebase record created → 4-char code shared
2. Players join by entering the code and their name
3. Host assigns random seats → starts round 1
4. Each table submits scores independently; all clients auto-navigate to a between-rounds view when all tables submit
5. Host silently prepares next round seating; non-host players see standings and next seat assignment
6. After round 6, standings page shows final results (wins → Buncos → total points)

Player identity is tracked via `localStorage` (device ID for host, player ID per game code for players).

### Ghost players

Ghost slots fill empty seats so games can run with fewer real players. The host sets the number of ghost slots when creating the game — up to `(tables × 4) − 1`. Ghosts get random names drawn from a pool so demo games look realistic. Ghost tables (all-ghost seats) are auto-submitted at round start.

### Joining mid-game

The join screen subscribes to Firebase immediately on load, giving players live status. If the round is already in progress when a player arrives, they can:

- **Spectate** — redirected to the live standings page
- **Take a ghost seat** — pick an available ghost slot, enter a name; the ghost record is updated in-place so no seat reassignment is needed

## Running locally

```bash
npm run dev
```

Starts the Astro dev server at `http://localhost:4321`. Hot-reload included.

Firebase config is hard-coded in `src/js/firebase.js` (public web config — this is normal for Firebase client apps).

## Building

```bash
npm run build
```

Outputs to `dist/`. Each `.astro` page compiles to a `.html` file, preserving existing URL structure. JS and CSS are content-hashed by Vite for cache busting.

## Deployment

Pushes to `main` automatically build and deploy to GitHub Pages via `.github/workflows/deploy.yml`. The `PUBLIC_VERSION` env var is set to the git commit SHA and appears in the footer of every page.

## Tests

```bash
npm test
```

Jest unit tests cover game logic, utilities, and table card rendering.

## E2E tests (Playwright)

Playwright runs against a local static server and uses the real Firebase backend.

```bash
npm run e2e
```

Optional UI runner:

```bash
npm run e2e:ui
```

## Tech stack

- Astro 6 (static output, `.html` file format)
- Vite (via Astro — content-hashed JS/CSS bundles)
- Firebase Realtime Database (npm SDK, tree-shaken by Vite)
- Bootstrap 5.3 (dark theme, CDN)
- Outfit font (Google Fonts, CDN)
- Jest (unit tests)
- Playwright (E2E tests)
- GitHub Actions → GitHub Pages (CI/CD)
