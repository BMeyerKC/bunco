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
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
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
