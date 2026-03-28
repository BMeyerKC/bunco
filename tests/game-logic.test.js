// tests/game-logic.test.js
import {
  generateGameCode,
  assignRandomSeats,
  calculateNextRoundSeating,
  determineWinner,
  updateStandings,
} from '../js/game-logic.js';

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
