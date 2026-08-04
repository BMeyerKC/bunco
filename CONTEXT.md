# Bunco

Domain vocabulary for the Full Game flow — a Firebase-backed, multi-table, host-led session of Bunco played across six rounds. (Quick Scorer, the single-table local tally mode, is out of scope for this glossary — it has no host or lifecycle.)

## Lifecycle

A Game moves through four phases:

- **Setup** — host is seating players, hasn't started Round 1 yet (`currentRound === 0`)
- **Round In Progress** — players are actively playing a round (`currentRound` 1–6); may contain a Round Called event without changing phase
- **Round Complete** — every table has submitted for the current round; host hasn't advanced yet. This is a *derived* phase (computed from table submission state), not a stored flag — same principle as Standings. Corresponds to the real, natural break between rounds where players get up and move tables.
- **Ended** — all six rounds finished (`currentRound === 7`)

_Future idea, not yet designed_: a countdown display when the host starts the next round, giving players time to settle at their new table before scoring begins. Tracked as a future ticket, out of scope for this session.

## Rotation Rules

How players move between tables after a round is a **named, swappable rule**, not one fixed mechanic. Tables are numbered 1..N. Three variants:

- **Losers Move** _(today's only implemented rule, `calculateNextRoundSeating`)_ — winners always stay at their current table, regardless of position. Losers always move, rotating toward table 1; a losing pair already at table 1 wraps to table N.
- **Winners Move** _(not yet implemented)_ — losers always stay at their current table, regardless of position. Winners always move, rotating toward table 1; a winning pair already at table 1 wraps to table N. The mirror image of Losers Move.
- **Head Table** _(not yet implemented)_ — table 1 is the Head Table, a fixed destination worth climbing to. At every table except table 1: winners move up one table, losers stay. At table 1 specifically, the roles flip: winners stay (the reward for reaching it), losers drop all the way to table N.

All three share one underlying principle: **partnerships don't persist across rounds.** A pair that moves together (or stays together) as of the table assignment still gets reshuffled into new partnerships once seated — e.g. two players who won together and both land at the same next table can end up as opponents there, not partners. "The team moves" describes *which table two individuals land at together*, not a persistent partnership.

## Language

**Round Called**:
The event where a table signals it has finished play for the current round (via Bunco or reaching the target score), notifying the rest of the game. It does not lock or end anything — it is informational only, since the app facilitates a live session rather than governing player behavior.
_Avoid_: Game called (the code's `gameCalledBy` field is scoped to one round, not the whole game — the name is a known mismatch, not a redefinition of the term)

**Us / Them**:
Table-relative labels for the two sides playing head-to-head at a table in a given round. Neither side has inherent status — no tie-break privilege, no fixed identity across rounds (seats rotate each round).

**Round Result**:
The recorded outcome of a table's round: each side's score plus which side won. Points are captured for standings, but the meaningful domain fact is *which players won at their table* — not the margin. A tie between Us and Them is not a state the app needs to handle: house rules require players to roll off until broken before anyone submits a score.

**Host**:
The device that created the game, recorded as `meta.hostDeviceId`, one per game, fixed at creation. Controls round progression (assigning seats, starting/advancing rounds). Enforced only by client-side convention, not by data-layer permissions — intentional, since the app facilitates a physical in-person session for a trusted group rather than a public service. See ADR-0003.
_Known limitation_: no host-transfer mechanism exists. If the host's device is lost (not just reloaded — `bunco_host_code` survives reloads via localStorage), no other client has UI to advance the game. Accepted as a rare-edge-case risk for now, not designed around yet.

**Bunco**:
A player rolling three-of-a-kind on their called number, worth bonus credit and triggering a Round Called for their table. Scoped **per table** — each table can independently credit its own Bunco in a round; one table's Bunco does not block another table's Bunco in the same round.
_Avoid_: Global first-claim-wins semantics (the current implementation's `recordBunco` transaction rejects a second Bunco claim game-wide per round — this is a known bug to fix, not the intended rule)
_Known gap_: the host needs the ability to edit or erase a Bunco recorded by accident. Not yet built.

**Standings**:
The cumulative wins, losses, points, and buncos for each player across the game so far. A *derived view* over all Round Results to date — recomputed on read, not persisted as its own stored value. See ADR-0002.
_Avoid_: Treating standings as stored/authoritative state to be incrementally updated (the current implementation does this and has a known double-count race — see ADR-0002)
