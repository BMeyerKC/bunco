# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Groups playing Bunco in person at a game night, mostly mid-to-late-aged women, each on their own phone. Two roles carry equal weight:

- **Host**: organizes the night. Creates the game, seats players, starts and advances rounds.
- **Players**: join with a code and tap scores for their table mid-game, usually with dice in the other hand. The host is normally also a player.

Neither role should be assumed technical. Nobody signs up for anything.

## Product Purpose

Bunco Score Keeper (bunco.io) replaces the paper score pad at a Bunco night. It keeps score, tells people where to sit next round, and shows standings, so the group can get on with playing. Success is a full six-round night where nobody has to stop the game to sort out the app.

Monetization is **undecided**. `public/ads.txt` exists, but whether the product is ad-supported is an open question; do not design for or against ads without asking.

## Positioning

The app facilitates a live session between people who trust each other; it does not govern play (ADR-0001). It records and informs, and never locks players out or referees. There are no accounts: a 4-character code gets a whole room into the same game, and a single table can score with no setup at all.

## Operating Context

- A living room or kitchen, several tables of four, dice, snacks, conversation. Often dim and loud.
- Phones held one-handed, glanced at between rolls. Screens need to stay awake.
- Players physically get up and change tables between rounds; that break is when they look at seating and standings.
- Two ways in: **Quick Scorer** (one table, local tally, no host or lifecycle) and **Full Game** (host-led, multi-table, six rounds, synced live).

## Capabilities and Constraints

- Full Game lifecycle: Setup, Round In Progress, Round Complete (derived), Ended. Vocabulary is defined in `CONTEXT.md`; use those terms (Round Called, Us / Them, Round Result, Host, Bunco, Standings).
- Seat rotation is a named, swappable rule. Only Losers Move is implemented. Partnerships do not persist across rounds.
- Standings are a derived view over Round Results, not stored state (ADR-0002).
- Host is a UI convention tied to the creating device, not enforced by permissions (ADR-0003). There is no host transfer.
- Ghost players fill empty seats and can be claimed by a real player.
- House rules, owner-confirmed: the side that rolls a Bunco wins the table whatever the tapped score; ghosts never roll (a human rolls for them) and cannot earn a Bunco; three of a kind off the round number is a baby Bunco worth 5 points, and so is a ghost's three of the round number; ties are rolled off before a score is submitted. Ask the owner before inventing any other rule.
- Identity is per device via localStorage. No accounts, no login.
- Stack: Astro static site, Firebase Realtime Database, no CSS framework.
- Known gaps: host cannot edit or erase a Bunco recorded by accident; no countdown between rounds; Winners Move and Head Table rotation are not built.

## Brand Commitments

- Name: Bunco Score Keeper, at bunco.io.
- Voice: plain, friendly, sentence case. Speaks like someone at the table, not like software.

## Evidence on Hand

- The live app at bunco.io, with rules and how-to-play copy on the home page.
- Domain glossary in `CONTEXT.md`; decisions in `docs/adr/`.
- No testimonials, user counts, press, or pricing exist. Do not fabricate any.

## Product Principles

1. **Facilitate, don't govern.** The people at the table are in charge; the app keeps up with them.
2. **The game is the point.** Every screen should get someone back to the dice in a glance and a tap.
3. **Host and players are equals.** Setup and scoring get the same care; neither is the afterthought.
4. **Nothing to learn, nothing to sign up for.** A code, a name, and you are playing.
5. **House rules win.** The app follows how this group actually plays, as confirmed by the owner.

## Accessibility & Inclusion

- WCAG 2.1 AA is the standard: contrast, keyboard, and screen-reader support.
- Large text and generous tap targets; readable without reading glasses, forgiving of imprecise taps.
- Works in dim, noisy rooms: usable one-handed, screen stays awake during play, nothing depends on sound.
