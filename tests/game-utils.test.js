// tests/game-utils.test.js
import { getGhostOnlyTableIds, allTablesSubmitted } from '../src/js/game-utils.js';

describe('getGhostOnlyTableIds', () => {
  test('returns empty array when every table has at least one real player', () => {
    const players = {
      p1: { name: 'Alice', isGhost: false },
      p2: { name: 'Bob',   isGhost: false },
      g1: { name: 'Eve',   isGhost: true  },
      g2: { name: 'Frank', isGhost: true  },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us',   seat: 1 },
      p2: { tableId: 1, side: 'them', seat: 1 },
      g1: { tableId: 1, side: 'us',   seat: 2 },
      g2: { tableId: 1, side: 'them', seat: 2 },
    };
    expect(getGhostOnlyTableIds(assignments, players, 1)).toEqual([]);
  });

  test('returns the table id when all four seats are ghosts', () => {
    const players = {
      p1: { name: 'Alice', isGhost: false },
      p2: { name: 'Bob',   isGhost: false },
      p3: { name: 'Carol', isGhost: false },
      p4: { name: 'Dave',  isGhost: false },
      g1: { name: 'Eve',   isGhost: true  },
      g2: { name: 'Frank', isGhost: true  },
      g3: { name: 'Grace', isGhost: true  },
      g4: { name: 'Hank',  isGhost: true  },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us',   seat: 1 },
      p2: { tableId: 1, side: 'us',   seat: 2 },
      p3: { tableId: 1, side: 'them', seat: 1 },
      p4: { tableId: 1, side: 'them', seat: 2 },
      g1: { tableId: 2, side: 'us',   seat: 1 },
      g2: { tableId: 2, side: 'us',   seat: 2 },
      g3: { tableId: 2, side: 'them', seat: 1 },
      g4: { tableId: 2, side: 'them', seat: 2 },
    };
    expect(getGhostOnlyTableIds(assignments, players, 2)).toEqual([2]);
  });

  test('returns multiple table ids when multiple all-ghost tables exist', () => {
    const players = {
      p1: { name: 'Alice', isGhost: false },
      g1: { name: 'Bob',   isGhost: true  },
      g2: { name: 'Carol', isGhost: true  },
    };
    const assignments = {
      p1: { tableId: 1, side: 'us', seat: 1 },
      g1: { tableId: 2, side: 'us', seat: 1 },
      g2: { tableId: 3, side: 'us', seat: 1 },
    };
    expect(getGhostOnlyTableIds(assignments, players, 3)).toEqual([2, 3]);
  });

  test('treats a table with no assignments as ghost-only', () => {
    const players = { p1: { name: 'Alice', isGhost: false } };
    const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
    expect(getGhostOnlyTableIds(assignments, players, 2)).toEqual([2]);
  });
});

describe('allTablesSubmitted', () => {
  test('returns true when all tables have submitted', () => {
    const tables = {
      1: { submitted: true },
      2: { submitted: true },
      3: { submitted: true },
    };
    expect(allTablesSubmitted(tables, 3)).toBe(true);
  });

  test('returns false when one table has not submitted', () => {
    const tables = {
      1: { submitted: true },
      2: { submitted: false },
      3: { submitted: true },
    };
    expect(allTablesSubmitted(tables, 3)).toBe(false);
  });

  test('returns false when a table entry is missing entirely', () => {
    const tables = {
      1: { submitted: true },
    };
    expect(allTablesSubmitted(tables, 2)).toBe(false);
  });

  test('returns false when tables object is empty', () => {
    expect(allTablesSubmitted({}, 2)).toBe(false);
  });

  test('returns true for a single table that has submitted', () => {
    expect(allTablesSubmitted({ 1: { submitted: true } }, 1)).toBe(true);
  });

  test('returns false when submitted is missing on a table entry', () => {
    const tables = { 1: { submitted: true }, 2: { liveUs: 5, liveThem: 3 } };
    expect(allTablesSubmitted(tables, 2)).toBe(false);
  });

  test('returns false when a ghost-only table is pre-submitted but a real table is still playing', () => {
    // Ghost tables are auto-submitted at round start; real tables submit manually
    const tables = {
      1: { submitted: false, liveUs: 5, liveThem: 3 },
      2: { submitted: true,  usScore: 0, themScore: 0 }, // ghost table pre-submitted
    };
    expect(allTablesSubmitted(tables, 2)).toBe(false);
  });

  test('returns true when real tables and pre-submitted ghost tables are all done', () => {
    const tables = {
      1: { submitted: true, usScore: 21, themScore: 10 },
      2: { submitted: true, usScore: 0,  themScore: 0  }, // ghost table pre-submitted
    };
    expect(allTablesSubmitted(tables, 2)).toBe(true);
  });
});
