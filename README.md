# Bunco Score Keeper

Live scoring app for Bunco game nights, hosted at **bunco.io**.

## What it is

A static web app — no backend, no build step — that supports two play modes:

- **Quick Scorer** (`scorer.html`) — single-table score tracker, landscape-optimized tap interface, no setup
- **Full Game** (`game.html`) — host/join via 4-character code, full 6-round game with automatic seat rotation, standings, and Bunco tracking. Real-time sync via Firebase Realtime Database.

## Project structure

```
index.html          Landing page (rules, SEO content, navigation)
scorer.html         Quick single-table scorer
game.html           Full multiplayer game (host + join views)
standings.html      Live standings dashboard
js/
  firebase.js       Firebase Realtime Database read/write helpers
  game-logic.js     Pure game logic (seat assignment, rotation, standings)
  game-controller.js  UI controller wiring Firebase + game-logic + DOM
  ui.js             Shared UI helpers (showView, showToast, getParam, getDeviceId)
css/
  base.css          Shared styles
tests/
  game-logic.test.js  Jest unit tests for game-logic.js
```

## How the full game works

1. Host creates a game (tables, ghost slots) → Firebase record created → 4-char code shared
2. Players join by entering the code and their name
3. Host assigns random seats → starts round 1
4. Each table submits scores independently; host device auto-advances rounds when all tables submit
5. After round 6, standings page shows final results (wins → Buncos → total points)

Player identity is tracked via `localStorage` (device ID for host, player ID per game code for players).

## Running locally

No build step needed. Serve the root directory with any static file server, e.g.:

```bash
npx serve .
```

Firebase config is hard-coded in `js/firebase.js` (public web config — this is normal for Firebase client apps).

## Tests

```bash
npm test
```

Jest unit tests cover `game-logic.js` (seat assignment, rotation, standings calculation).

## Tech stack

- Vanilla HTML/CSS/JS (ES modules)
- Bootstrap 5.3 (dark theme, CDN)
- Firebase Realtime Database (CDN SDK, no npm)
- Jest (dev dependency, unit tests only)
