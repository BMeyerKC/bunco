// tests/game-logic.test.js
import {
  generateGameCode,
  assignRandomSeats,
  calculateNextRoundSeating,
  determineWinner,
  updateStandings,
  buildTableLayout,
  gameStatus,
  buildGameRows,
} from '../src/js/game-logic.js';

describe('generateGameCode', () => {
  test('returns a 4-character string', () => {
    expect(generateGameCode()).toHaveLength(4);
  });

  test('only contains valid characters', () => {
    expect(generateGameCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});

describe('assignRandomSeats', () => {
  test('assigns all players to seats', () => {
    const players = ['p1','p2','p3','p4','p5','p6','p7','p8'];
    const result = assignRandomSeats(players, 2);
    expect(Object.keys(result)).toHaveLength(8);
  });

  test('each table has 2 us and 2 them players', () => {
    const players = ['p1','p2','p3','p4'];
    const result = assignRandomSeats(players, 1);
    const us = Object.values(result).filter(a => a.side === 'us');
    const them = Object.values(result).filter(a => a.side === 'them');
    expect(us).toHaveLength(2);
    expect(them).toHaveLength(2);
  });
});

describe('calculateNextRoundSeating', () => {
  // 2-table setup: p1-p4 at table 1, p5-p8 at table 2
  const assignments = {
    p1: { tableId: 1, side: 'us',   seat: 1 },
    p2: { tableId: 1, side: 'us',   seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us',   seat: 1 },
    p6: { tableId: 2, side: 'us',   seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };

  test('losers from table 2 rotate to table 1', () => {
    const results = { 1: { winner: 'us' }, 2: { winner: 'them' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p7, p8 won at table 2 — stay at table 2
    expect(next['p7'].tableId).toBe(2);
    expect(next['p8'].tableId).toBe(2);
    // p5, p6 lost at table 2 — rotate to table 1
    expect(next['p5'].tableId).toBe(1);
    expect(next['p6'].tableId).toBe(1);
  });

  test('losers from table 1 rotate to the last table', () => {
    const results = { 1: { winner: 'them' }, 2: { winner: 'us' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p1, p2 lost at table 1 — rotate to table 2 (last table)
    expect(next['p1'].tableId).toBe(2);
    expect(next['p2'].tableId).toBe(2);
  });

  test('winners split across sides', () => {
    const results = { 1: { winner: 'us' }, 2: { winner: 'us' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p1 and p2 won at table 1 — must be on opposite sides
    expect(next['p1'].side).not.toBe(next['p2'].side);
    // p5 and p6 won at table 2 — must be on opposite sides
    expect(next['p5'].side).not.toBe(next['p6'].side);
  });
});

describe('determineWinner', () => {
  test('us wins when us score is higher', () => {
    expect(determineWinner(21, 10)).toBe('us');
  });

  test('them wins when them score is higher', () => {
    expect(determineWinner(10, 21)).toBe('them');
  });

  test('us wins on tie', () => {
    expect(determineWinner(21, 21)).toBe('us');
  });
});

describe('updateStandings', () => {
  test('increments wins and totalPoints for winning player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 21, themScore: 10, submitted: true } };
    const roundResults = { 1: { winner: 'us' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = {};
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].wins).toBe(1);
    expect(next['p1'].totalPoints).toBe(21);
  });

  test('increments losses for losing player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 5, themScore: 21, submitted: true } };
    const roundResults = { 1: { winner: 'them' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = {};
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].losses).toBe(1);
  });

  test('records buncos for player', () => {
    const standings = { p1: { wins: 0, losses: 0, buncos: 0, totalPoints: 0 } };
    const tableResults = { 1: { usScore: 5, themScore: 3, submitted: true } };
    const roundResults = { 1: { winner: 'us' } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    const buncos = { p1: 1 };
    const next = updateStandings(standings, tableResults, roundResults, assignments, buncos);
    expect(next['p1'].buncos).toBe(1);
  });
});

describe('buildTableLayout', () => {
  test('groups players into us/them by table', () => {
    const players = {
      p1: { name: 'Alice', isGhost: false },
      p2: { name: 'Bob',   isGhost: false },
      p3: { name: 'Carol', isGhost: false },
      p4: { name: 'Dave',  isGhost: false },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us',   seat: 1 },
      p2: { tableId: 1, side: 'us',   seat: 2 },
      p3: { tableId: 1, side: 'them', seat: 1 },
      p4: { tableId: 1, side: 'them', seat: 2 },
    };
    const result = buildTableLayout(players, assignments, 1);
    expect(result).toHaveLength(1);
    expect(result[0].tableId).toBe(1);
    expect(result[0].us.map(p => p.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    expect(result[0].them.map(p => p.name)).toEqual(expect.arrayContaining(['Carol', 'Dave']));
    expect(result[0].us.find(p => p.name === 'Alice').id).toBe('p1');
  });

  test('marks ghost players with isGhost: true', () => {
    const players = {
      p1: { name: 'Ghost', isGhost: true  },
      p2: { name: 'Alice', isGhost: false },
      p3: { name: 'Bob',   isGhost: false },
      p4: { name: 'Dave',  isGhost: false },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us',   seat: 1 },
      p2: { tableId: 1, side: 'us',   seat: 2 },
      p3: { tableId: 1, side: 'them', seat: 1 },
      p4: { tableId: 1, side: 'them', seat: 2 },
    };
    const result = buildTableLayout(players, assignments, 1);
    const ghost = result[0].us.find(p => p.name === 'Ghost');
    expect(ghost.isGhost).toBe(true);
    const real  = result[0].us.find(p => p.name === 'Alice');
    expect(real.isGhost).toBe(false);
  });

  test('returns tables ordered by tableId ascending', () => {
    const players = {
      p1: { name: 'A', isGhost: false }, p2: { name: 'B', isGhost: false },
      p3: { name: 'C', isGhost: false }, p4: { name: 'D', isGhost: false },
      p5: { name: 'E', isGhost: false }, p6: { name: 'F', isGhost: false },
      p7: { name: 'G', isGhost: false }, p8: { name: 'H', isGhost: false },
    };
    const assignments = {
      p1: { tableId: 2, side: 'us',   seat: 1 }, p2: { tableId: 2, side: 'us',   seat: 2 },
      p3: { tableId: 2, side: 'them', seat: 1 }, p4: { tableId: 2, side: 'them', seat: 2 },
      p5: { tableId: 1, side: 'us',   seat: 1 }, p6: { tableId: 1, side: 'us',   seat: 2 },
      p7: { tableId: 1, side: 'them', seat: 1 }, p8: { tableId: 1, side: 'them', seat: 2 },
    };
    const result = buildTableLayout(players, assignments, 2);
    expect(result[0].tableId).toBe(1);
    expect(result[1].tableId).toBe(2);
  });

  test('skips assignment entries with no matching player', () => {
    const players = {
      p1: { name: 'Alice', isGhost: false },
    };
    const assignments = {
      p1:      { tableId: 1, side: 'us',   seat: 1 },
      missing: { tableId: 1, side: 'us',   seat: 2 },
    };
    const result = buildTableLayout(players, assignments, 1);
    expect(result[0].us).toHaveLength(1);
    expect(result[0].us[0].name).toBe('Alice');
  });

  test('does not bleed players from one table into another', () => {
    const players = {
      p1: { name: 'A', isGhost: false }, p2: { name: 'B', isGhost: false },
      p3: { name: 'C', isGhost: false }, p4: { name: 'D', isGhost: false },
      p5: { name: 'E', isGhost: false }, p6: { name: 'F', isGhost: false },
      p7: { name: 'G', isGhost: false }, p8: { name: 'H', isGhost: false },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us',   seat: 1 }, p2: { tableId: 1, side: 'us',   seat: 2 },
      p3: { tableId: 1, side: 'them', seat: 1 }, p4: { tableId: 1, side: 'them', seat: 2 },
      p5: { tableId: 2, side: 'us',   seat: 1 }, p6: { tableId: 2, side: 'us',   seat: 2 },
      p7: { tableId: 2, side: 'them', seat: 1 }, p8: { tableId: 2, side: 'them', seat: 2 },
    };
    const result = buildTableLayout(players, assignments, 2);
    expect(result[0].us.map(p => p.name)).toEqual(expect.arrayContaining(['A', 'B']));
    expect(result[0].them.map(p => p.name)).toEqual(expect.arrayContaining(['C', 'D']));
    expect(result[1].us.map(p => p.name)).toEqual(expect.arrayContaining(['E', 'F']));
    expect(result[1].them.map(p => p.name)).toEqual(expect.arrayContaining(['G', 'H']));
    expect(result[0].us).toHaveLength(2);
    expect(result[1].us).toHaveLength(2);
  });
});

describe('gameStatus', () => {
  test('returns Unknown for missing meta', () => {
    expect(gameStatus(null)).toBe('Unknown');
    expect(gameStatus(undefined)).toBe('Unknown');
  });

  test('returns Waiting for round 0', () => {
    expect(gameStatus({ currentRound: 0, gameCalledBy: null })).toBe('Waiting');
  });

  test('returns Round N during rounds 1-6', () => {
    expect(gameStatus({ currentRound: 1, gameCalledBy: null })).toBe('Round 1');
    expect(gameStatus({ currentRound: 6, gameCalledBy: null })).toBe('Round 6');
  });

  test('returns Ended when currentRound reaches 7', () => {
    expect(gameStatus({ currentRound: 7, gameCalledBy: null })).toBe('Ended');
  });

  test('returns Ended when game was called, even mid-round', () => {
    expect(gameStatus({ currentRound: 3, gameCalledBy: 2 })).toBe('Ended');
  });
});

describe('buildGameRows', () => {
  const game = (code, createdAt, players = {}) => ({
    code,
    meta: { currentRound: 0, gameCalledBy: null, createdAt },
    players,
  });

  test('sorts newest first', () => {
    const rows = buildGameRows([game('OLD1', 100), game('NEW1', 300), game('MID1', 200)]);
    expect(rows.map(r => r.code)).toEqual(['NEW1', 'MID1', 'OLD1']);
  });

  test('counts only non-ghost players', () => {
    const rows = buildGameRows([
      game('ABCD', 100, {
        p1: { name: 'Ann', isGhost: false },
        p2: { name: 'Ghost 1', isGhost: true },
        p3: { name: 'Bea', isGhost: false },
      }),
    ]);
    expect(rows[0].playerCount).toBe(2);
  });

  test('derives status via gameStatus', () => {
    const rows = buildGameRows([
      { code: 'ENDD', meta: { currentRound: 7, gameCalledBy: null, createdAt: 50 }, players: {} },
    ]);
    expect(rows[0].status).toBe('Ended');
  });

  test('tolerates missing meta and players', () => {
    const rows = buildGameRows([{ code: 'BARE' }]);
    expect(rows[0]).toEqual({ code: 'BARE', createdAt: 0, status: 'Unknown', playerCount: 0 });
  });

  test('returns empty array for empty or missing input', () => {
    expect(buildGameRows([])).toEqual([]);
    expect(buildGameRows(null)).toEqual([]);
  });
});
