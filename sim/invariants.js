// sim/invariants.js — rules every finished bot game must satisfy.
// Pure: takes the game record + event list, returns violation strings.
import { roundWinners, calculateNextRoundSeating, deriveStandings } from '../src/js/game-logic.js';

// Table reads and writes, plus the server's accept/reject replies (they carry no path)
export const isTableFrame = frame => frame.includes('tables') || frame.includes('"b":{"s":"');

// Most games only trip the event-log counts (#34): no recording needed for those
export const needsWire = violations => violations.some(v => !/ (started|logged) \d+ times$/.test(v));

/**
 * @param {object} game  games/{code} from the database
 * @param {object[]} events  values of games/{code}/events
 * @param {{ [round: number]: { [tableId: number]: { us: number, them: number } } }} [expected]
 *   the final live scores the bots tapped in, per round and table
 * @returns {string[]}
 */
export function checkGame(game, events = [], expected = {}) {
  const v = [];
  const meta = game?.meta;
  if (!meta) return ['no meta'];
  const numTables = meta.tables;
  const players = game.players || {};
  const ended = meta.currentRound >= 7;
  const lastRound = Math.min(meta.currentRound, 6);
  if (!ended) v.push(`game stuck in round ${meta.currentRound}`);

  for (let r = 1; r <= lastRound; r++) {
    const round = game.rounds?.[r] || {};
    const assignments = round.assignments || {};
    const tables = round.tables || {};
    const at = `round ${r}`;

    // Seating: every player seated once, every table 2 us + 2 them
    const seated = Object.keys(assignments);
    if (seated.length !== numTables * 4) v.push(`${at}: ${seated.length} seated, expected ${numTables * 4}`);
    for (const id of seated) if (!players[id]) v.push(`${at}: unknown player ${id} seated`);
    for (let t = 1; t <= numTables; t++) {
      const sides = Object.values(assignments).filter(a => a.tableId === t).map(a => a.side);
      const us = sides.filter(s => s === 'us').length;
      if (us !== 2 || sides.length !== 4) v.push(`${at} table ${t}: ${us} us / ${sides.length - us} them`);
    }

    // Losers Move: this round's seats follow from last round's results
    if (r > 1) {
      const prev = game.rounds?.[r - 1] || {};
      const want = calculateNextRoundSeating(
        prev.assignments || {},
        roundWinners(prev.tables || {}, prev.assignments || {}, prev.buncos || {}, numTables),
        numTables,
      );
      for (const [id, a] of Object.entries(want)) {
        const got = assignments[id];
        if (!got || got.tableId !== a.tableId || got.side !== a.side) {
          v.push(`${at}: ${players[id]?.name ?? id} seated at ${got?.tableId}/${got?.side}, rotation says ${a.tableId}/${a.side}`);
        }
      }
    }

    for (let t = 1; t <= numTables; t++) {
      const tb = tables[t] || {};
      const humans = Object.entries(assignments).filter(([id, a]) => a.tableId === t && !players[id]?.isGhost);
      if (!tb.submitted) { v.push(`${at} table ${t}: never submitted`); continue; }
      if (humans.length === 0) continue; // ghost-only tables are scored by hand or auto 0-0

      // The submitted score must be the score the table's phones were showing
      if (tb.usScore !== (tb.liveUs ?? 0) || tb.themScore !== (tb.liveThem ?? 0)) {
        v.push(`${at} table ${t}: submitted ${tb.usScore}-${tb.themScore} but live score was ${tb.liveUs ?? 0}-${tb.liveThem ?? 0}`);
      }
      const exp = expected[r]?.[t];
      if (exp && (exp.us !== (tb.liveUs ?? 0) || exp.them !== (tb.liveThem ?? 0))) {
        v.push(`${at} table ${t}: bots tapped ${exp.us}-${exp.them} but live score is ${tb.liveUs ?? 0}-${tb.liveThem ?? 0}`);
      }
    }

    // Buncos: humans only, one per table, recorded at the roller's own table
    for (const [id, n] of Object.entries(round.buncos || {})) {
      if (players[id]?.isGhost) v.push(`${at}: ghost ${players[id].name} credited a Bunco`);
      if (n > 1) v.push(`${at}: ${players[id]?.name ?? id} credited ${n} Buncos`);
    }
    for (const [t, b] of Object.entries(round.bunco || {})) {
      if (!b) continue;
      if (assignments[b.playerId]?.tableId !== Number(t)) v.push(`${at}: table ${t} Bunco by a player seated elsewhere`);
    }
  }

  // Events: each round starts once; a finished game ends once
  const count = pred => events.filter(pred).length;
  for (let r = 1; r <= lastRound; r++) {
    const n = count(e => e.type === 'round_started' && e.round === r);
    if (n !== 1) v.push(`round ${r} started ${n} times`);
  }
  const endings = count(e => e.type === 'game_ended');
  if (endings !== (ended ? 1 : 0)) v.push(`game_ended logged ${endings} times`);

  // Standings: every player played every completed round exactly once
  if (ended) {
    const standings = deriveStandings(game.rounds, meta.currentRound, numTables);
    for (const [id, p] of Object.entries(players)) {
      const s = standings[id] || { wins: 0, losses: 0 };
      if (s.wins + s.losses !== 6) v.push(`${p.name}: ${s.wins}W + ${s.losses}L over 6 rounds`);
    }
  }

  return v;
}
