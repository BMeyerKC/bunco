// js/game-logic.js

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateGameCode() {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

/**
 * Assigns playerIds to seats across numTables.
 * Seats: side 'us' or 'them', seat 1 or 2.
 * @param {string[]} playerIds
 * @param {number} numTables
 * @returns {{ [id: string]: { tableId: number, side: string, seat: number } }}
 */
export function assignRandomSeats(playerIds, numTables) {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result = {};
  shuffled.forEach((id, i) => {
    const tableId = Math.floor(i / 4) + 1;
    const pos = i % 4; // 0=us1, 1=us2, 2=them1, 3=them2
    result[id] = {
      tableId,
      side: pos < 2 ? 'us' : 'them',
      seat: (pos % 2) + 1,
    };
  });
  return result;
}

/**
 * Calculates next-round seating after a round completes.
 * - Losers rotate toward the head table (table 1).
 *   Losers from table 1 go to the last table.
 * - Winners stay but split: one goes to 'us' seat 1, one to 'them' seat 1.
 * - Incoming losers also split: one to 'us' seat 2, one to 'them' seat 2.
 *
 * @param {{ [id: string]: { tableId, side, seat } }} currentAssignments
 * @param {{ [tableId: number]: { winner: 'us'|'them' } }} roundResults
 * @param {number} numTables
 * @returns {{ [id: string]: { tableId: number, side: string, seat: number } }}
 */
export function calculateNextRoundSeating(currentAssignments, roundResults, numTables) {
  const incomingByTable = {};
  const winnersByTable = {};

  for (let tableId = 1; tableId <= numTables; tableId++) {
    const { winner } = roundResults[tableId];
    const loser = winner === 'us' ? 'them' : 'us';

    const winners = Object.entries(currentAssignments)
      .filter(([, a]) => a.tableId === tableId && a.side === winner)
      .map(([id]) => id);

    const losers = Object.entries(currentAssignments)
      .filter(([, a]) => a.tableId === tableId && a.side === loser)
      .map(([id]) => id);

    winnersByTable[tableId] = winners;

    // Losers from table 1 go to last table; others go one table down (toward 1)
    const dest = tableId === 1 ? numTables : tableId - 1;
    incomingByTable[dest] = losers;
  }

  const next = {};
  for (let tableId = 1; tableId <= numTables; tableId++) {
    const [w1, w2] = winnersByTable[tableId] || [];
    const [i1, i2] = incomingByTable[tableId] || [];

    if (w1) next[w1] = { tableId, side: 'us',   seat: 1 };
    if (w2) next[w2] = { tableId, side: 'them',  seat: 1 };
    if (i1) next[i1] = { tableId, side: 'us',   seat: 2 };
    if (i2) next[i2] = { tableId, side: 'them',  seat: 2 };
  }

  return next;
}

/**
 * @param {number} usScore
 * @param {number} themScore
 * @returns {'us'|'them'}
 */
export function determineWinner(usScore, themScore) {
  return usScore >= themScore ? 'us' : 'them';
}

/**
 * Merges round results into cumulative standings.
 *
 * @param {{ [id: string]: { wins, losses, buncos, totalPoints } }} currentStandings
 * @param {{ [tableId: number]: { usScore, themScore, submitted } }} tableResults
 * @param {{ [tableId: number]: { winner: 'us'|'them' } }} roundResults
 * @param {{ [id: string]: { tableId, side, seat } }} assignments
 * @param {{ [id: string]: number }} buncos  player → bunco count this round
 * @returns {{ [id: string]: { wins, losses, buncos, totalPoints } }}
 */
export function updateStandings(currentStandings, tableResults, roundResults, assignments, buncos) {
  const next = JSON.parse(JSON.stringify(currentStandings));

  for (const [id, { tableId, side }] of Object.entries(assignments)) {
    if (!next[id]) next[id] = { wins: 0, losses: 0, buncos: 0, totalPoints: 0 };
    const won = roundResults[tableId].winner === side;
    if (won) next[id].wins += 1; else next[id].losses += 1;
    const tr = tableResults[tableId];
    next[id].totalPoints += side === 'us' ? tr.usScore : tr.themScore;
    if (buncos[id]) next[id].buncos += buncos[id];
  }

  return next;
}

/**
 * Groups players and assignments into a per-table structure for rendering.
 *
 * @param {{ [id: string]: { name: string, isGhost: boolean } }} players
 * @param {{ [id: string]: { tableId: number, side: 'us'|'them', seat: number } }} assignments
 * @param {number} numTables
 * @returns {{ tableId: number, us: {id,name,isGhost}[], them: {id,name,isGhost}[] }[]}
 */
export function buildTableLayout(players, assignments, numTables) {
  if (!assignments) return [];
  const tables = [];
  for (let t = 1; t <= numTables; t++) {
    const us = [];
    const them = [];
    Object.entries(assignments).forEach(([id, a]) => {
      if (a.tableId !== t) return;
      const p = players[id];
      if (!p) return;
      const slot = { id, name: p.name, isGhost: !!p.isGhost };
      (a.side === 'us' ? us : them).push(slot);
    });
    tables.push({ tableId: t, us, them });
  }
  return tables;
}

/**
 * Human-readable game status from the meta record.
 * Ended checks run first: a called game is Ended even mid-round.
 * @param {{ currentRound: number, gameCalledBy: * }|null|undefined} meta
 * @returns {string} 'Unknown' | 'Ended' | 'Waiting' | 'Round N'
 */
export function gameStatus(meta) {
  if (!meta) return 'Unknown';
  if (meta.gameCalledBy != null || meta.currentRound >= 7) return 'Ended';
  if (meta.currentRound === 0) return 'Waiting';
  return `Round ${meta.currentRound}`;
}

/**
 * Shapes raw game records into display rows for the admin dashboard.
 * @param {Array<{ code: string, meta?: object, players?: object }>} games
 * @returns {Array<{ code: string, createdAt: number, status: string, playerCount: number }>}
 *   sorted newest-first by createdAt
 */
export function buildGameRows(games) {
  return (games || [])
    .map(g => ({
      code: g.code,
      createdAt: g.meta?.createdAt ?? 0,
      status: gameStatus(g.meta),
      playerCount: Object.values(g.players || {}).filter(p => !p.isGhost).length,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Transaction updater for claiming the single per-round bunco.
 * First writer wins: aborts (returns undefined) if a claim already exists.
 *
 * @param {{ playerId, tableId, ts }|null|undefined} current  existing claim node
 * @param {string} playerId  player being credited
 * @param {number} tableId   table the bunco happened at
 * @param {number} ts        client timestamp (ms)
 * @returns {{ playerId: string, tableId: number, ts: number }|undefined}
 */
export function buncoClaimUpdate(current, playerId, tableId, ts) {
  if (current) return undefined; // someone already claimed it — abort
  return { playerId, tableId, ts };
}
