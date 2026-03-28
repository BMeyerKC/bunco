# bunco.io Platform Design Spec

**Date:** 2026-03-28

## Overview

Expand the existing single-file Bunco scorer into a full platform at bunco.io. The site offers two tools: a quick standalone set scorer and a full game-night tracking system. Hosted on GitHub Pages as a static site. Real-time multi-device sync via Firebase Realtime Database. Ad revenue via Google AdSense on non-gameplay pages.

---

## Site Structure

Multi-page static site. No build step. No framework. Bootstrap 5 loaded from CDN for UI. Shared logic in ES modules via `<script type="module">`.

```
bunco.io/
├── index.html           ← Landing page (AdSense)
├── scorer.html          ← Quick scorer (standalone set scorer)
├── game.html            ← Table scoring + host setup + waiting room
├── standings.html       ← Between-round standings + final review (AdSense on final)
├── js/
│   ├── firebase.js      ← Firebase init and shared DB helpers
│   ├── game-logic.js    ← Bunco rules: rotation, pairing, ghost handling, scoring
│   └── ui.js            ← Shared UI utilities (toast notifications, etc.)
└── css/
    └── base.css         ← Shared dark theme extending Bootstrap
```

---

## Landing Page (`index.html`)

Bootstrap dark theme. Centered layout. App name ("Bunco") and short tagline at the top.

Three Bootstrap cards as the main navigation:

| Card | Action |
|---|---|
| **Quick Scorer** | "Score a single set" → links to `scorer.html` |
| **Start a Game** | "Run a full game night" → opens host setup in `game.html` |
| **Join a Game** | Inline 4-character code input + Join button → takes player directly into the game |

AdSense responsive banner (728×90 desktop / 320×50 mobile) placed below the cards.

---

## Quick Scorer (`scorer.html`)

The existing `index.html` scorer moved here with minimal changes:
- Shared `base.css` applied
- Behavior unchanged: tap to score, decrement button, reset, win state at 21, landscape lock
- No Firebase dependency

---

## Full Game System (`game.html` + `standings.html`)

### Game Setup (Host)

Host navigates to `game.html` and:
1. Enters number of tables (2–6)
2. Specifies number of ghost player slots (0 or more)
3. App calculates total player seats = (tables × 4) − ghost slots
4. App generates a random 4-character join code (e.g., `R7K2`)
5. Firebase session is created with TTL of 24 hours
6. Host sees a waiting room showing names as players join in real time

### Player Join

Any player goes to bunco.io, enters the game code and a name they'll remember. Names must be unique within the session — no validation beyond uniqueness. Host can prompt duplicate names to differentiate (e.g., "Mike T").

Ghost slots are pre-filled as "Ghost" and do not require a player.

### Initial Seating

Once all players have joined, the host assigns initial table pairings one of two ways:
- **Manual:** Host uses dropdowns to assign players to tables and seats
- **Random Seat:** Single button auto-assigns all players randomly

The host can override random assignments before starting. When satisfied, host taps **Start Round 1**.

### Round Scoring (`game.html` — table view)

Each table device sees a scoring view closely matching the existing quick scorer:
- **"Us"** = team that stayed at the table (left side)
- **"Them"** = team that rotated in (right side)
- Round indicator at top (e.g., "Round 3 of 6")
- Tap left/right half to increment score
- Decrement (−) button at bottom of each half
- **Bunco button**: prominent, clearly labeled, tappable when a player rolls all three dice matching the current round number. Records a Bunco event for the player who rolled it.

### Calling Game

When a team's score reaches 21, any device at that table can tap **Call Game**. This:
1. Broadcasts a "Game Called" notification to all other table devices
2. Other tables see a banner: "Game Called — finish your roll"
3. Each table submits their final score when ready
4. Round ends once all tables have submitted

### Rotation Logic

After each round, `game-logic.js` calculates new seating:

- **Losing team** at each table rotates to the next table (clockwise)
- **Winning team** stays at the table but **splits up** — the two winning players each pair with one incoming rotating player
- **Ghost players** rotate exactly like normal players
- At the head table (table 1): the losing team rotates to the last table

The app tracks individual player assignments each round. No player pairs with the same partner in back-to-back rounds as a result of this rule.

### Standings (`standings.html`)

Accessible from any device at any point between rounds. Shows current totals per player:
- Wins
- Losses
- Buncos
- Total points scored

After round 6, the page displays **Final Standings** with the same stats. An AdSense responsive banner is shown on the final standings view only (not between rounds).

---

## Firebase Data Model

Session-scoped. All data auto-deletes 24 hours after creation via Firebase TTL rules.

```
games/{gameCode}/
  meta/
    tables: number
    ghostSlots: number
    currentRound: number        ← 0 = setup, 1–6 = active, 7 = complete
    gameCalledBy: tableId | null ← cleared when round ends
    hostDeviceId: string        ← random ID set by the device that created the game
    createdAt: timestamp
  players/{playerId}/
    name: string
    isGhost: boolean
  rounds/{roundNumber}/
    assignments/{playerId}/
      tableId: number
      side: string              ← "us" | "them"
    tables/{tableId}/
      usScore: number
      themScore: number
      submitted: boolean
    buncos/
      {playerId}: number        ← count of buncos this round
  standings/{playerId}/
    wins: number
    losses: number
    buncos: number
    totalPoints: number
```

`hostDeviceId` is a random ID generated by the creating device and stored in `localStorage`. Only the device whose ID matches `hostDeviceId` sees host controls (start round, override seating). Firebase security rules: any client can read/write within a valid game code. No authentication required.

---

## Ad Revenue

Google AdSense responsive ad units placed in two locations:

| Location | Placement |
|---|---|
| `index.html` | Below the three action cards |
| `standings.html` | Final standings view only (not shown between rounds) |

No ads appear on `scorer.html` or during active gameplay on `game.html`.

---

## Out of Scope

- User accounts or persistent history beyond the current session
- Push notifications
- Sounds or animations
- Tracking wins across multiple game nights
- Any server-side code
