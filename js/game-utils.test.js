// js/game-utils.test.js
import {
  isNameTaken,
  getAvailableGhostSeats,
  allTablesSubmitted,
  pickGhostNames,
  GHOST_NAMES,
} from './game-utils.js';

class TestRunner {
  constructor() { this.tests = []; this.results = []; }
  test(name, fn) { this.tests.push({ name, fn }); }
  assert(condition, message) { if (!condition) throw new Error(message || 'Assertion failed'); }
  assertEqual(actual, expected, message) {
    if (actual !== expected) throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  async run() {
    for (const test of this.tests) {
      try {
        await test.fn(this);
        this.results.push({ name: test.name, status: 'PASS', error: null });
      } catch (err) {
        this.results.push({ name: test.name, status: 'FAIL', error: err.message });
      }
    }
    return this.results;
  }
}

export const runner = new TestRunner();

// ─── isNameTaken ────────────────────────────────────────────

runner.test('isNameTaken returns false for empty players', (t) => {
  t.assertEqual(isNameTaken({}, 'Alice'), false);
});

runner.test('isNameTaken returns false when name not taken', (t) => {
  const players = { p1: { name: 'Bob', isGhost: false } };
  t.assertEqual(isNameTaken(players, 'Alice'), false);
});

runner.test('isNameTaken returns true on exact match', (t) => {
  const players = { p1: { name: 'Alice', isGhost: false } };
  t.assertEqual(isNameTaken(players, 'Alice'), true);
});

runner.test('isNameTaken is case-insensitive', (t) => {
  const players = { p1: { name: 'Alice', isGhost: false } };
  t.assert(isNameTaken(players, 'alice'), 'lowercase should match');
  t.assert(isNameTaken(players, 'ALICE'), 'uppercase should match');
});

runner.test('isNameTaken checks ghost players too', (t) => {
  const players = { g1: { name: 'Ghost', isGhost: true } };
  t.assertEqual(isNameTaken(players, 'Ghost'), true);
});

// ─── getAvailableGhostSeats ─────────────────────────────────

runner.test('getAvailableGhostSeats returns empty when no ghosts', (t) => {
  const players = { p1: { name: 'Alice', isGhost: false } };
  const assignments = { p1: { tableId: 1, side: 'us', seat: 1 } };
  t.assertEqual(getAvailableGhostSeats(players, assignments).length, 0);
});

runner.test('getAvailableGhostSeats returns empty when ghost has no assignment', (t) => {
  const players = { g1: { name: 'Ghost', isGhost: true } };
  t.assertEqual(getAvailableGhostSeats(players, {}).length, 0);
});

runner.test('getAvailableGhostSeats returns seat with teammate name', (t) => {
  const players = {
    g1: { name: 'Ghost', isGhost: true },
    p1: { name: 'Alice', isGhost: false },
  };
  const assignments = {
    g1: { tableId: 1, side: 'us', seat: 1 },
    p1: { tableId: 1, side: 'us', seat: 2 },
  };
  const result = getAvailableGhostSeats(players, assignments);
  t.assertEqual(result.length, 1);
  t.assertEqual(result[0].ghostId, 'g1');
  t.assertEqual(result[0].tableId, 1);
  t.assertEqual(result[0].teammateName, 'Alice');
});

runner.test('getAvailableGhostSeats returns null teammateName when no teammate', (t) => {
  const players = { g1: { name: 'Ghost', isGhost: true } };
  const assignments = { g1: { tableId: 1, side: 'us', seat: 1 } };
  const result = getAvailableGhostSeats(players, assignments);
  t.assertEqual(result.length, 1);
  t.assertEqual(result[0].teammateName, null);
});

runner.test('getAvailableGhostSeats returns multiple ghosts', (t) => {
  const players = {
    g1: { name: 'Ghost1', isGhost: true },
    g2: { name: 'Ghost2', isGhost: true },
  };
  const assignments = {
    g1: { tableId: 1, side: 'us', seat: 1 },
    g2: { tableId: 2, side: 'them', seat: 1 },
  };
  t.assertEqual(getAvailableGhostSeats(players, assignments).length, 2);
});

runner.test('getAvailableGhostSeats handles two ghosts on the same side', (t) => {
  const players = {
    g1: { name: 'Ghost1', isGhost: true },
    g2: { name: 'Ghost2', isGhost: true },
  };
  const assignments = {
    g1: { tableId: 1, side: 'us', seat: 1 },
    g2: { tableId: 1, side: 'us', seat: 2 },
  };
  const result = getAvailableGhostSeats(players, assignments);
  t.assertEqual(result.length, 2);
  t.assertEqual(result.find(s => s.ghostId === 'g1').teammateName, 'Ghost2');
  t.assertEqual(result.find(s => s.ghostId === 'g2').teammateName, 'Ghost1');
});

runner.test('getAvailableGhostSeats returns null teammateName when teammate missing from players', (t) => {
  const players = { g1: { name: 'Ghost', isGhost: true } };
  const assignments = {
    g1: { tableId: 1, side: 'us', seat: 1 },
    p_missing: { tableId: 1, side: 'us', seat: 2 },
  };
  const result = getAvailableGhostSeats(players, assignments);
  t.assertEqual(result.length, 1);
  t.assertEqual(result[0].teammateName, null);
});

// ─── allTablesSubmitted ─────────────────────────────────────

runner.test('allTablesSubmitted returns false for empty tables', (t) => {
  t.assertEqual(allTablesSubmitted({}, 2), false);
});

runner.test('allTablesSubmitted returns false when a table entry is missing', (t) => {
  const tables = { 1: { submitted: true } };
  t.assertEqual(allTablesSubmitted(tables, 2), false);
});

runner.test('allTablesSubmitted returns false when one table not submitted', (t) => {
  const tables = { 1: { submitted: true }, 2: { submitted: false } };
  t.assertEqual(allTablesSubmitted(tables, 2), false);
});

runner.test('allTablesSubmitted returns true when all submitted', (t) => {
  const tables = { 1: { submitted: true }, 2: { submitted: true } };
  t.assertEqual(allTablesSubmitted(tables, 2), true);
});

runner.test('allTablesSubmitted works for 1 through 6 tables', (t) => {
  for (let n = 1; n <= 6; n++) {
    const tables = {};
    for (let i = 1; i <= n; i++) tables[i] = { submitted: true };
    t.assert(allTablesSubmitted(tables, n), `Should pass for ${n} tables`);
  }
});

runner.test('allTablesSubmitted returns true for 0 tables', (t) => {
  t.assertEqual(allTablesSubmitted({}, 0), true);
});

// ─── pickGhostNames ─────────────────────────────────────────

runner.test('pickGhostNames returns empty array for count 0', (t) => {
  t.assertEqual(pickGhostNames(0).length, 0);
});

runner.test('pickGhostNames returns correct count', (t) => {
  t.assertEqual(pickGhostNames(5).length, 5);
});

runner.test('pickGhostNames returns no duplicates', (t) => {
  const names = pickGhostNames(10);
  t.assertEqual(new Set(names).size, 10, 'All 10 names should be unique');
});

runner.test('pickGhostNames caps at pool size', (t) => {
  t.assertEqual(pickGhostNames(50).length, GHOST_NAMES.length);
});

runner.test('pickGhostNames produces varied results across calls', (t) => {
  const results = new Set();
  for (let i = 0; i < 20; i++) results.add(pickGhostNames(3).join(','));
  t.assert(results.size > 1, 'Should not always return the same names');
});
