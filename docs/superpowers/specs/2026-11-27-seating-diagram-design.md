# Seating diagram: who moves where between rounds

Date: 2026-11-27 · Status: approved design, not built · Depends on PR #60 (Head Table rotation)

## Why

Between rounds, people stand up and ask "where do I go?" Today each player gets a text card ("Your next seat: Table 2") and the host gets standings plus a Start button. Nobody can see the whole room move. The owner wants one picture of the move that works for three audiences:

1. **The host's phone between rounds.** See where everyone is supposed to go before starting the next round.
2. **Debugging.** See each round's seating and spot anyone seated where the rule doesn't send them.
3. **Explaining the rules.** A sample night shows the Head Table rule better than five sentences do. This also helps with the open question of why hosting feels like a barrier.

Players see it too, with their own move pulled out on top.

## What it looks like (chosen: option B, "before → after")

Mockups (local, brainstorm companion): `.superpowers/brainstorm/1707-1795799226/content/seating-picture.html` (option B) and `player-view.html`.

```
 Round 2                         Round 3
 Table 1 ★  Won: Ann, Beth  ──grey──▶  Table 1 ★  Ann + Eve  vs Beth + Fay
            Lost: Cara, Dot ──red───▶  Table 3
 Table 2    Won: Eve, Fay   ──blue──▶  Table 1
            Lost: Gail, Hope──grey──▶  Table 2    Gail + Ivy vs Hope + Jo
 Table 3    Won: Ivy, Jo    ──blue──▶  Table 2
            Lost: Kay, Lou  ──grey──▶  Table 3    Kay + Cara vs Lou + Dot
```

- **Left column:** each table in the round that just ended, split into its winning pair ("Won: …") and losing pair ("Lost: …").
- **Right column:** each table in the next round, shown as partners: "A + B vs C + D".
- **Arrows:** one from each pair to the table it lands at. The color comes from where it goes, not from the rule. Blue means the pair moves to a lower table number (up). Red means it moves to a higher one (down, like table 1's losers dropping to the last table). Grey means it stays. Because the color is geometric, a seating bug shows up as an arrow that looks wrong.
- Table 1 is marked ★ Head table in both columns.
- Ghost seats show the ghost's name with a small ghost marker and move like anyone else.
- It's two columns at every size. With 6 tables it's about 600px tall and the page scrolls.
- It's an SVG drawn with theme tokens, so it works in the paper (light) and chalkboard (dark) themes.

### Player version

A **"your move" card** sits on top and replaces today's "Your next seat" card:

- The move, as a headline: "↑ Move up to Table 1 ★ Head table", "Stay at Table 2", or "↓ Drop to Table 3".
- Why: "You and Fay won at Table 2." / "You and Gail lost at Table 2."
- Partner and Against for the next round (same data the current card shows).

The full diagram goes below it. The player's own two tables and arrow are full strength, their name is bold on both sides, and everything else is faded.

A device with no seat (a spectator on the game page) gets no card and an unhighlighted diagram.

## Where it appears

| Place | Who | What |
|---|---|---|
| Between-rounds view (`game.html`, `#view-between-rounds`) | Every seated player, including a host who plays | "Your move" card + full diagram with their path highlighted, above "Standings so far". The host also keeps "Start round N". |
| Standings page (`standings.html`), inside `#advance-round-section` | A host who isn't playing (these devices are redirected here between rounds) | Full diagram, nobody highlighted, above "Start round N". |
| Debug page (`debug.html?code=XXXX`) | Owner | One diagram per round change (1→2 … 5→6) for the game, above the event log. Any player whose stored seat differs from what `calculateNextRoundSeating` says gets flagged in red text under that diagram. |
| Landing page (`index.astro`), under "Rotate and repeat" | Anyone reading the rules | A static sample night with made-up names (the 12-player, 3-table example from the mockups), rendered at build time. |

Rounds 1–5 only. After round 6 there's no next round, so no diagram.

## How it's built

**Approaches considered**

- **A. One pure "moves" function + one SVG string renderer, used everywhere (chosen).** `seatMoves()` turns (this round's seats, this round's results, next round's seats) into a plain list of tables and moves. `seatDiagramSvg()` turns that into an SVG string. Every page calls the same two functions, and Astro calls the renderer at build time for the landing page, the same way `tallyHtml()` is used today. One drawing, one set of tests.
- **B. HTML/CSS boxes with CSS-drawn connectors.** Curved arrows between arbitrary tables are awkward without SVG, and it would differ visually from the rules version. Dropped.
- **C. A charting/diagram library (e.g. d3).** A new dependency for six arrows and a dozen boxes. Dropped.

The owner described outcomes and left the how to the builder, so A is the builder's call.

**Pieces**

1. `seatMoves(players, assignments, results, nextAssignments, numTables)` in `src/js/game-logic.js` (pure, unit-tested). It returns, per table in the round that ended: the winning and losing pairs (names, ghost flags, ids), and for each pair the table(s) its players land at next round. A pair normally lands together. If its two players land at different tables (only possible with bad data), it reports one move per player so the debug view can draw both. The return also includes the next-round tables as partner pairs ("us" pair vs "them" pair).
   - `results` comes from the existing `roundWinners()` (Bunco wins the table).
   - `nextAssignments` is `rounds[r+1].assignments` when it exists, else `calculateNextRoundSeating(...)`. This is the same fallback the current next-seat card uses, because next-round seats aren't saved until the host starts the round.
2. `seatDiagramSvg(moves, { highlightId } = {})` in a new `src/js/seat-diagram.js`. Returns an SVG string. It uses CSS classes, not hard-coded colors, so tokens drive both themes. Styles go in `src/styles/base.css` (loaded by every layout) so the landing, game, standings and debug pages all get them. It escapes names (player names are user input). With `highlightId`, everything except that player's two tables and their arrow is faded, and their name is bold.
3. `yourMove(moves, playerId)` (pure, in `game-logic.js`). Returns `{ kind: 'up'|'stay'|'down', from, to, partnerFromLastRound, wonLastRound, nextPartner, nextOpponents }` for the "your move" card.
4. Wire-up:
   - `game-controller.js` `showBetweenRoundsView`: replace the `#br-next-seat` card markup and logic with the "your move" card, and add a diagram container. Reuse the existing `nextAssignments` fallback.
   - `standings-controller.js`: render the diagram into `#advance-round-section` when it's shown.
   - `debug-controller.js` + `debug.astro`: also `watchGame(code)`, render one diagram per completed round change, and flag mismatches against `calculateNextRoundSeating`.
   - `index.astro`: a sample-night fixture, rendered at build time under step 5 of "How to play".
5. Accessibility: the SVG gets `role="img"` and an `aria-label` that summarizes the moves ("Eve and Fay move up from table 2 to table 1; …"). The "your move" card carries the essentials as text, so a screen reader user isn't relying on the drawing.

## Goals

- A host can see every move for the next round on their phone without asking anyone.
- A player can see their own move at a glance, and why.
- The landing page rules show the Head Table rule as a picture.
- The debug page shows seating per round and makes a bad seat obvious.

## Non-goals

- Animation (a possible later step for the rules picture).
- Showing round 1's random seating as "moves" (there's no previous round).
- Editing seats from the diagram.
- Other rotation rules (#6). The diagram doesn't care about the rule, but the landing sample shows Head Table only.

## Anti-goals

- A diagram that disagrees with the seat the player is actually given. The diagram and the "your move" card must come from the same `nextAssignments` the game will save.
- Hard-coded colors that break in the chalkboard (dark) theme.
- Making a player scroll past the diagram to find their table. The "your move" card comes first.

## Testing

- Unit tests (Jest, `tests/`): `seatMoves` (2, 3 and 6 tables; ghosts; a Bunco-won table; split-pair bad data), `yourMove` (up, stay, down, table 1 winner, table 1 loser), and `seatDiagramSvg` (escapes names, one arrow per pair, highlight fades others, arrow class by direction).
- E2e: extend an existing two-round spec to check that the between-rounds view shows the "your move" card with the right table and that the diagram is present. These specs hit live Firebase, so the owner runs them.

## Left to the builder

- Exact SVG geometry, spacing and arrow curves (the mockup's 320-wide viewBox is a starting point).
- Faded-state opacity and the ghost marker glyph.
- The wording of the `aria-label` summary.
- Whether the debug page's diagrams sit above or interleaved with the event log.

## Calls made during design (not asked of the owner)

- The "your move" card replaces the existing "Your next seat" card rather than stacking on it.
- The non-playing host sees the diagram on the standings page, because that's where those devices are sent between rounds.
- The debug page flags seats that differ from the rule.
- The landing sample is static and rendered at build time.
