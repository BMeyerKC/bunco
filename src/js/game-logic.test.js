import {
  generateGameCode,
  assignRandomSeats,
  calculateNextRoundSeating,
  determineWinner,
  updateStandings,
  buildTableLayout,
} from './game-logic.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
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

// ─── generateGameCode ───────────────────────────────────────

runner.test('generateGameCode returns 4-char string', (t) => {
  const code = generateGameCode();
  t.assertEqual(code.length, 4, 'Code should be 4 characters');
  t.assert(/^[A-Z0-9]+$/.test(code), 'Code should contain only uppercase letters and digits');
});

runner.test('generateGameCode generates different codes', (t) => {
  const codes = new Set();
  for (let i = 0; i < 100; i++) {
    codes.add(generateGameCode());
  }
  t.assert(codes.size > 50, 'Should generate various codes');
});

// ─── assignRandomSeats ──────────────────────────────────────

runner.test('assignRandomSeats assigns all players', (t) => {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  const assignments = assignRandomSeats(playerIds, 2);
  t.assertEqual(Object.keys(assignments).length, 8, 'All players should be assigned');
  playerIds.forEach(id => {
    t.assert(assignments[id], `Player ${id} should have assignment`);
  });
});

runner.test('assignRandomSeats distributes players across tables', (t) => {
  const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
  const assignments = assignRandomSeats(playerIds, 2);
  const table1 = Object.values(assignments).filter(a => a.tableId === 1);
  const table2 = Object.values(assignments).filter(a => a.tableId === 2);
  t.assertEqual(table1.length, 4, 'Table 1 should have 4 players');
  t.assertEqual(table2.length, 4, 'Table 2 should have 4 players');
});

runner.test('assignRandomSeats uses correct sides and seats', (t) => {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];
  const assignments = assignRandomSeats(playerIds, 1);
  const usPlayers = Object.values(assignments).filter(a => a.side === 'us');
  const themPlayers = Object.values(assignments).filter(a => a.side === 'them');
  t.assertEqual(usPlayers.length, 2, 'Should have 2 us players');
  t.assertEqual(themPlayers.length, 2, 'Should have 2 them players');
  usPlayers.forEach(a => t.assert([1, 2].includes(a.seat), 'Seat should be 1 or 2'));
  themPlayers.forEach(a => t.assert([1, 2].includes(a.seat), 'Seat should be 1 or 2'));
});

// ─── determineWinner ────────────────────────────────────────

runner.test('determineWinner picks us on tie', (t) => {
  const winner = determineWinner(21, 21);
  t.assertEqual(winner, 'us', 'Should pick us on tie');
});

runner.test('determineWinner picks us on higher score', (t) => {
  const winner = determineWinner(25, 20);
  t.assertEqual(winner, 'us', 'Should pick us on higher score');
});

runner.test('determineWinner picks them on higher score', (t) => {
  const winner = determineWinner(15, 21);
  t.assertEqual(winner, 'them', 'Should pick them on higher score');
});

// ─── calculateNextRoundSeating ──────────────────────────────

runner.test('calculateNextRoundSeating rotates losers', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us', seat: 1 },
    p6: { tableId: 2, side: 'us', seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };
  const roundResults = {
    1: { winner: 'us' },
    2: { winner: 'us' },
  };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 2);

  // Winners stay at same table
  t.assertEqual(next.p1.tableId, 1, 'Winner p1 stays at table 1');
  t.assertEqual(next.p2.tableId, 1, 'Winner p2 stays at table 1');
  t.assertEqual(next.p5.tableId, 2, 'Winner p5 stays at table 2');
  t.assertEqual(next.p6.tableId, 2, 'Winner p6 stays at table 2');

  // Losers from table 1 go to last table (2)
  t.assertEqual(next.p3.tableId, 2, 'Loser p3 rotates to last table');
  t.assertEqual(next.p4.tableId, 2, 'Loser p4 rotates to last table');

  // Losers from table 2 go to table 1
  t.assertEqual(next.p7.tableId, 1, 'Loser p7 rotates toward table 1');
  t.assertEqual(next.p8.tableId, 1, 'Loser p8 rotates toward table 1');
});

runner.test('calculateNextRoundSeating assigns winners to seat 1', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
  };
  const roundResults = { 1: { winner: 'us' } };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 1);

  t.assertEqual(next.p1.seat, 1, 'Winner p1 assigned to seat 1');
  t.assertEqual(next.p2.seat, 1, 'Winner p2 assigned to seat 1');
});

runner.test('calculateNextRoundSeating assigns incoming losers to seat 2', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us', seat: 1 },
    p6: { tableId: 2, side: 'us', seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };
  const roundResults = { 1: { winner: 'us' }, 2: { winner: 'them' } };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 2);

  // Losers from table 2 move to table 1
  const incomingPlayers = [p => next[p].tableId === 1 && next[p].seat === 2];
  t.assertEqual(next.p5.seat, 2, 'Incoming p5 assigned to seat 2');
  t.assertEqual(next.p6.seat, 2, 'Incoming p6 assigned to seat 2');
});

runner.test('calculateNextRoundSeating handles 2 tables with all us wins', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us', seat: 1 },
    p6: { tableId: 2, side: 'us', seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };
  const roundResults = {
    1: { winner: 'us' },
    2: { winner: 'us' },
  };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 2);

  // Table 1 losers (them) go to table 2
  t.assertEqual(next.p3.tableId, 2, 'Table 1 them losers go to table 2');
  t.assertEqual(next.p4.tableId, 2, 'Table 1 them losers go to table 2');

  // Table 2 losers (them) go to table 1
  t.assertEqual(next.p7.tableId, 1, 'Table 2 them losers go to table 1');
  t.assertEqual(next.p8.tableId, 1, 'Table 2 them losers go to table 1');

  // Winners stay at their tables
  t.assertEqual(next.p1.tableId, 1, 'Table 1 us winner stays at table 1');
  t.assertEqual(next.p5.tableId, 2, 'Table 2 us winner stays at table 2');
});

runner.test('calculateNextRoundSeating handles 2 tables with split wins', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us', seat: 1 },
    p6: { tableId: 2, side: 'us', seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
  };
  const roundResults = {
    1: { winner: 'us' },
    2: { winner: 'them' },
  };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 2);

  // Table 1 losers (them) go to table 2
  t.assertEqual(next.p3.tableId, 2, 'Table 1 them losers go to table 2');

  // Table 2 losers (us) go to table 1
  t.assertEqual(next.p5.tableId, 1, 'Table 2 us losers go to table 1');
});

runner.test('calculateNextRoundSeating handles 3 tables', (t) => {
  const currentAssignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
    p5: { tableId: 2, side: 'us', seat: 1 },
    p6: { tableId: 2, side: 'us', seat: 2 },
    p7: { tableId: 2, side: 'them', seat: 1 },
    p8: { tableId: 2, side: 'them', seat: 2 },
    p9: { tableId: 3, side: 'us', seat: 1 },
    p10: { tableId: 3, side: 'us', seat: 2 },
    p11: { tableId: 3, side: 'them', seat: 1 },
    p12: { tableId: 3, side: 'them', seat: 2 },
  };
  const roundResults = {
    1: { winner: 'us' },
    2: { winner: 'us' },
    3: { winner: 'them' },
  };
  const next = calculateNextRoundSeating(currentAssignments, roundResults, 3);

  // Losers from table 1 go to table 3
  t.assertEqual(next.p3.tableId, 3, 'Table 1 losers go to table 3');
  t.assertEqual(next.p4.tableId, 3, 'Table 1 losers go to table 3');

  // Losers from table 2 go to table 1
  t.assertEqual(next.p7.tableId, 1, 'Table 2 losers go to table 1');
  t.assertEqual(next.p8.tableId, 1, 'Table 2 losers go to table 1');

  // Losers from table 3 go to table 2
  t.assertEqual(next.p9.tableId, 2, 'Table 3 losers go to table 2');
  t.assertEqual(next.p10.tableId, 2, 'Table 3 losers go to table 2');
});

// ─── updateStandings ────────────────────────────────────────

runner.test('updateStandings increments wins and losses', (t) => {
  const currentStandings = {};
  const tableResults = {
    1: { usScore: 25, themScore: 20, submitted: true },
  };
  const roundResults = { 1: { winner: 'us' } };
  const assignments = {
    p1: { tableId: 1, side: 'us' },
    p2: { tableId: 1, side: 'us' },
    p3: { tableId: 1, side: 'them' },
    p4: { tableId: 1, side: 'them' },
  };
  const buncos = {};

  const next = updateStandings(currentStandings, tableResults, roundResults, assignments, buncos);

  t.assertEqual(next.p1.wins, 1, 'Winner p1 gets 1 win');
  t.assertEqual(next.p3.losses, 1, 'Loser p3 gets 1 loss');
});

runner.test('updateStandings accumulates points by side', (t) => {
  const currentStandings = {};
  const tableResults = {
    1: { usScore: 25, themScore: 20, submitted: true },
  };
  const roundResults = { 1: { winner: 'us' } };
  const assignments = {
    p1: { tableId: 1, side: 'us' },
    p2: { tableId: 1, side: 'us' },
    p3: { tableId: 1, side: 'them' },
  };
  const buncos = {};

  const next = updateStandings(currentStandings, tableResults, roundResults, assignments, buncos);

  t.assertEqual(next.p1.totalPoints, 25, 'Us player gets us score');
  t.assertEqual(next.p3.totalPoints, 20, 'Them player gets them score');
});

runner.test('updateStandings counts buncos', (t) => {
  const currentStandings = {};
  const tableResults = {
    1: { usScore: 21, themScore: 0, submitted: true },
  };
  const roundResults = { 1: { winner: 'us' } };
  const assignments = {
    p1: { tableId: 1, side: 'us' },
  };
  const buncos = { p1: 3 };

  const next = updateStandings(currentStandings, tableResults, roundResults, assignments, buncos);

  t.assertEqual(next.p1.buncos, 3, 'Player should have 3 buncos');
});

// ─── buildTableLayout ───────────────────────────────────────

runner.test('buildTableLayout groups players by table', (t) => {
  const players = {
    p1: { name: 'Alice', isGhost: false },
    p2: { name: 'Bob', isGhost: false },
    p3: { name: 'Carol', isGhost: false },
    p4: { name: 'Dave', isGhost: false },
  };
  const assignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
    p3: { tableId: 1, side: 'them', seat: 1 },
    p4: { tableId: 1, side: 'them', seat: 2 },
  };

  const layout = buildTableLayout(players, assignments, 1);

  t.assertEqual(layout.length, 1, 'Should have 1 table');
  t.assertEqual(layout[0].us.length, 2, 'Table 1 should have 2 us players');
  t.assertEqual(layout[0].them.length, 2, 'Table 1 should have 2 them players');
  t.assertEqual(layout[0].us[0].name, 'Alice', 'Should include player names');
});

runner.test('buildTableLayout marks ghosts', (t) => {
  const players = {
    p1: { name: 'Alice', isGhost: false },
    p2: { name: 'Ghost', isGhost: true },
  };
  const assignments = {
    p1: { tableId: 1, side: 'us', seat: 1 },
    p2: { tableId: 1, side: 'us', seat: 2 },
  };

  const layout = buildTableLayout(players, assignments, 1);

  t.assert(!layout[0].us[0].isGhost, 'Real player should not be marked ghost');
  t.assert(layout[0].us[1].isGhost, 'Ghost player should be marked ghost');
});

runner.test('updateStandings handles multiple rounds', (t) => {
  const currentStandings = {
    p1: { wins: 1, losses: 0, buncos: 0, totalPoints: 25 },
    p2: { wins: 1, losses: 0, buncos: 0, totalPoints: 25 },
  };
  const tableResults = {
    1: { usScore: 21, themScore: 15, submitted: true },
  };
  const roundResults = { 1: { winner: 'us' } };
  const assignments = {
    p1: { tableId: 1, side: 'us' },
    p2: { tableId: 1, side: 'them' },
  };
  const buncos = { p1: 1 };

  const next = updateStandings(currentStandings, tableResults, roundResults, assignments, buncos);

  t.assertEqual(next.p1.wins, 2, 'Wins should accumulate across rounds');
  t.assertEqual(next.p1.totalPoints, 46, 'Points should accumulate across rounds');
  t.assertEqual(next.p1.buncos, 1, 'Buncos should accumulate across rounds');
  t.assertEqual(next.p2.losses, 1, 'Losses should accumulate across rounds');
});

runner.test('determineWinner handles 0 scores', (t) => {
  const winner = determineWinner(0, 0);
  t.assertEqual(winner, 'us', 'Should pick us on 0-0 tie');
});

runner.test('assignRandomSeats handles single table', (t) => {
  const playerIds = ['p1', 'p2', 'p3', 'p4'];
  const assignments = assignRandomSeats(playerIds, 1);

  const allAtTable1 = Object.values(assignments).every(a => a.tableId === 1);
  t.assert(allAtTable1, 'All players should be at table 1');
});

runner.test('buildTableLayout handles empty assignments', (t) => {
  const players = {};
  const assignments = {};

  const layout = buildTableLayout(players, assignments, 1);

  t.assertEqual(layout.length, 1, 'Should have 1 table entry');
  t.assertEqual(layout[0].us.length, 0, 'Us side should be empty');
  t.assertEqual(layout[0].them.length, 0, 'Them side should be empty');
});

// ─── Integration: Complete round flow ────────────────────────

runner.test('calculateNextRoundSeating handles 4 tables', (t) => {
  const playerIds = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);
  const currentAssignments = {};
  playerIds.forEach((id, i) => {
    const tableId = Math.floor(i / 4) + 1;
    const pos = i % 4;
    currentAssignments[id] = {
      tableId,
      side: pos < 2 ? 'us' : 'them',
      seat: (pos % 2) + 1,
    };
  });

  const roundResults = {
    1: { winner: 'us' },
    2: { winner: 'them' },
    3: { winner: 'us' },
    4: { winner: 'them' },
  };

  const next = calculateNextRoundSeating(currentAssignments, roundResults, 4);

  // Verify loser rotation for 4 tables
  // Table 1 losers (them: p3, p4) go to table 4
  t.assertEqual(next.p3.tableId, 4, 'Table 1 them losers go to table 4');
  t.assertEqual(next.p4.tableId, 4, 'Table 1 them losers go to table 4');

  // Table 2 losers (us: p5, p6) go to table 1
  t.assertEqual(next.p5.tableId, 1, 'Table 2 us losers go to table 1');
  t.assertEqual(next.p6.tableId, 1, 'Table 2 us losers go to table 1');

  // Table 3 losers (them: p11, p12) go to table 2
  t.assertEqual(next.p11.tableId, 2, 'Table 3 them losers go to table 2');
  t.assertEqual(next.p12.tableId, 2, 'Table 3 them losers go to table 2');

  // Table 4 losers (us: p13, p14) go to table 3
  t.assertEqual(next.p13.tableId, 3, 'Table 4 us losers go to table 3');
  t.assertEqual(next.p14.tableId, 3, 'Table 4 us losers go to table 3');

  // Verify all players are still assigned
  const assignedCount = Object.keys(next).length;
  t.assertEqual(assignedCount, 16, 'All 16 players should be assigned');
});

runner.test('calculateNextRoundSeating works for 2-6 tables dynamically', (assert) => {
  for (let numTables = 2; numTables <= 6; numTables++) {
    const playerCount = numTables * 4;
    const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);

    // Create initial assignments
    const currentAssignments = {};
    playerIds.forEach((id, i) => {
      const tableId = Math.floor(i / 4) + 1;
      const pos = i % 4;
      currentAssignments[id] = {
        tableId,
        side: pos < 2 ? 'us' : 'them',
        seat: (pos % 2) + 1,
      };
    });

    // Create round results (alternate winners)
    const roundResults = {};
    for (let tableId = 1; tableId <= numTables; tableId++) {
      roundResults[tableId] = { winner: tableId % 2 === 0 ? 'us' : 'them' };
    }

    // Calculate next round
    const next = calculateNextRoundSeating(currentAssignments, roundResults, numTables);

    // Verify all players are assigned
    assert.assertEqual(Object.keys(next).length, playerCount,
      `Table count ${numTables}: All ${playerCount} players should be assigned`);

    // Verify each player is at a valid table
    let validCount = 0;
    Object.entries(next).forEach(([id, assignment]) => {
      if (assignment.tableId >= 1 && assignment.tableId <= numTables &&
          ['us', 'them'].includes(assignment.side) &&
          [1, 2].includes(assignment.seat)) {
        validCount++;
      }
    });
    assert.assertEqual(validCount, playerCount,
      `Table count ${numTables}: All ${playerCount} players should have valid assignments`);
  }
});

runner.test('assignRandomSeats works for 1-6 tables dynamically', (assert) => {
  for (let numTables = 1; numTables <= 6; numTables++) {
    const playerCount = numTables * 4;
    const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);

    const assignments = assignRandomSeats(playerIds, numTables);

    // Verify all players assigned
    assert.assertEqual(Object.keys(assignments).length, playerCount,
      `Table count ${numTables}: All ${playerCount} players should be assigned`);

    // Verify distribution across tables
    let tablesValid = true;
    for (let tableId = 1; tableId <= numTables; tableId++) {
      const playersAtTable = Object.values(assignments).filter(a => a.tableId === tableId);
      if (playersAtTable.length !== 4) tablesValid = false;
    }
    assert.assert(tablesValid,
      `Table count ${numTables}: Each table should have 4 players`);

    // Verify sides are balanced
    const usCount = Object.values(assignments).filter(a => a.side === 'us').length;
    const themCount = Object.values(assignments).filter(a => a.side === 'them').length;
    assert.assertEqual(usCount, playerCount / 2,
      `Table count ${numTables}: Should have ${playerCount / 2} us players`);
    assert.assertEqual(themCount, playerCount / 2,
      `Table count ${numTables}: Should have ${playerCount / 2} them players`);
  }
});

runner.test('updateStandings works for 1-6 tables dynamically', (assert) => {
  for (let numTables = 1; numTables <= 6; numTables++) {
    const playerCount = numTables * 4;
    const playerIds = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);

    const tableResults = {};
    const roundResults = {};
    const assignments = {};

    // Create assignments and results
    playerIds.forEach((id, i) => {
      const tableId = Math.floor(i / 4) + 1;
      const pos = i % 4;
      const side = pos < 2 ? 'us' : 'them';
      assignments[id] = { tableId, side, seat: (pos % 2) + 1 };
    });

    for (let tableId = 1; tableId <= numTables; tableId++) {
      tableResults[tableId] = { usScore: 21 + tableId, themScore: 20 - tableId, submitted: true };
      roundResults[tableId] = { winner: determineWinner(tableResults[tableId].usScore, tableResults[tableId].themScore) };
    }

    const standings = updateStandings({}, tableResults, roundResults, assignments, {});

    // Verify all players have standings
    assert.assertEqual(Object.keys(standings).length, playerCount,
      `Table count ${numTables}: All ${playerCount} players should have standings`);

    // Verify each player has valid stats
    let statsValid = true;
    Object.values(standings).forEach(stats => {
      if (stats.wins + stats.losses !== 1 || stats.totalPoints < 0) {
        statsValid = false;
      }
    });
    assert.assert(statsValid,
      `Table count ${numTables}: Each player should have valid stats`);

    // Verify win distribution (2 winners per table)
    const totalWins = Object.values(standings).reduce((sum, s) => sum + s.wins, 0);
    assert.assertEqual(totalWins, numTables * 2,
      `Table count ${numTables}: Should have ${numTables * 2} total wins (2 per table)`);
  }
});

runner.test('Integration: Buncos included in final standings', (t) => {
  const currentStandings = {};
  const tableResults = {
    1: { usScore: 21, themScore: 0, submitted: true },
  };
  const roundResults = { 1: { winner: 'us' } };
  const assignments = {
    p1: { tableId: 1, side: 'us' },
    p2: { tableId: 1, side: 'us' },
    p3: { tableId: 1, side: 'them' },
    p4: { tableId: 1, side: 'them' },
  };
  const buncos = { p1: 3, p2: 2 };

  const standings = updateStandings(currentStandings, tableResults, roundResults, assignments, buncos);

  t.assertEqual(standings.p1.buncos, 3, 'Player p1 should have 3 buncos in standings');
  t.assertEqual(standings.p2.buncos, 2, 'Player p2 should have 2 buncos in standings');
  t.assertEqual(standings.p3.buncos, 0, 'Player p3 should have 0 buncos');
});

runner.test('Integration: Round 1 completes and Round 2 assigns new seats', (t) => {
  // Setup: 8 players across 2 tables
  const players = {
    p1: { name: 'Alice', isGhost: false },
    p2: { name: 'Bob', isGhost: false },
    p3: { name: 'Carol', isGhost: false },
    p4: { name: 'Dave', isGhost: false },
    p5: { name: 'Eve', isGhost: false },
    p6: { name: 'Frank', isGhost: false },
    p7: { name: 'Grace', isGhost: false },
    p8: { name: 'Hank', isGhost: false },
  };

  const playerIds = Object.keys(players);

  // Round 1: Random seating
  const round1Assignments = assignRandomSeats(playerIds, 2);

  // Round 1: All tables submit scores
  const tableResults = {
    1: { usScore: 25, themScore: 20, submitted: true },
    2: { usScore: 18, themScore: 21, submitted: true },
  };

  // Determine winners
  const roundResults = {
    1: { winner: determineWinner(tableResults[1].usScore, tableResults[1].themScore) },
    2: { winner: determineWinner(tableResults[2].usScore, tableResults[2].themScore) },
  };

  // Update standings with some buncos
  const buncos = { p1: 2, p3: 1 };
  const standings = updateStandings({}, tableResults, roundResults, round1Assignments, buncos);

  // Calculate next round seating
  const round2Assignments = calculateNextRoundSeating(round1Assignments, roundResults, 2);

  // Verify all players are assigned in round 2
  const assignedInRound2 = Object.keys(round2Assignments);
  t.assertEqual(assignedInRound2.length, 8, 'All 8 players should be assigned in round 2');

  playerIds.forEach(id => {
    t.assert(round2Assignments[id], `Player ${id} should have round 2 assignment`);
    t.assert([1, 2].includes(round2Assignments[id].tableId), `Player should be at table 1 or 2`);
    t.assert(['us', 'them'].includes(round2Assignments[id].side), `Player should be on us or them side`);
    t.assert([1, 2].includes(round2Assignments[id].seat), `Player should have seat 1 or 2`);
  });

  // Verify standings were calculated
  playerIds.forEach(id => {
    t.assert(standings[id], `Player ${id} should have standings entry`);
    t.assertEqual(typeof standings[id].wins, 'number', 'Should have wins count');
    t.assertEqual(typeof standings[id].losses, 'number', 'Should have losses count');
    t.assertEqual(typeof standings[id].totalPoints, 'number', 'Should have total points');
  });

  // Verify losers were rotated
  const table1Losers = Object.entries(round1Assignments)
    .filter(([, a]) => a.tableId === 1 && a.side !== roundResults[1].winner)
    .map(([id]) => id);

  const expectedTable = roundResults[1].winner === 'us' ? 2 : 1;
  table1Losers.forEach(loserId => {
    t.assertEqual(round2Assignments[loserId].tableId, expectedTable,
      `Loser from table 1 should move to table ${expectedTable}`);
  });
});
