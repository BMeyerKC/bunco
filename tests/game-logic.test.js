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
  buncoClaimUpdate,
  describeResumableGame,
  uncallGameUpdate,
  roundWinners,
  ghostClaimUpdate,
  submitLiveUpdate,
  tapSyncUpdate,
  deriveStandings,
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

  test('winners at table 2 move up to table 1, losers stay', () => {
    const results = { 1: { winner: 'us' }, 2: { winner: 'them' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    // p7, p8 won at table 2 — move up to table 1
    expect(next['p7'].tableId).toBe(1);
    expect(next['p8'].tableId).toBe(1);
    // p5, p6 lost at table 2 — stay at table 2
    expect(next['p5'].tableId).toBe(2);
    expect(next['p6'].tableId).toBe(2);
  });

  test('table 1 keeps its winners and drops its losers to the last table', () => {
    const results = { 1: { winner: 'them' }, 2: { winner: 'us' } };
    const next = calculateNextRoundSeating(assignments, results, 2);
    expect(next['p3'].tableId).toBe(1);
    expect(next['p4'].tableId).toBe(1);
    expect(next['p1'].tableId).toBe(2);
    expect(next['p2'].tableId).toBe(2);
  });

  test('Head Table across 3 tables keeps four at every table', () => {
    const three = { ...assignments,
      p9:  { tableId: 3, side: 'us',   seat: 1 },
      p10: { tableId: 3, side: 'us',   seat: 2 },
      p11: { tableId: 3, side: 'them', seat: 1 },
      p12: { tableId: 3, side: 'them', seat: 2 },
    };
    const results = { 1: { winner: 'us' }, 2: { winner: 'us' }, 3: { winner: 'them' } };
    const next = calculateNextRoundSeating(three, results, 3);
    const table = (...ids) => ids.map(id => next[id].tableId);
    expect(table('p1', 'p2')).toEqual([1, 1]);   // table 1 winners stay
    expect(table('p3', 'p4')).toEqual([3, 3]);   // table 1 losers drop to the last table
    expect(table('p5', 'p6')).toEqual([1, 1]);   // table 2 winners move up
    expect(table('p7', 'p8')).toEqual([2, 2]);   // table 2 losers stay
    expect(table('p11', 'p12')).toEqual([2, 2]); // table 3 winners move up
    expect(table('p9', 'p10')).toEqual([3, 3]);  // table 3 losers stay
    for (let t = 1; t <= 3; t++) {
      expect(Object.values(next).filter(a => a.tableId === t)).toHaveLength(4);
    }
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
    expect(rows[0]).toEqual({ code: 'BARE', createdAt: 0, status: 'Unknown', round: 0, playerCount: 0, location: null });
  });

  test('returns empty array for empty or missing input', () => {
    expect(buildGameRows([])).toEqual([]);
    expect(buildGameRows(null)).toEqual([]);
  });
});

describe('buildGameRows location join', () => {
  const game = (code, createdAt) => ({
    code,
    meta: { currentRound: 0, gameCalledBy: null, createdAt },
    players: {},
  });

  test('joins city and region when both are present', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: 'Kansas City', region: 'Missouri', country: 'United States' } }
    );
    expect(rows[0].location).toBe('Kansas City, Missouri');
  });

  test('falls back to country when city and region are missing', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: null, region: null, country: 'United States' } }
    );
    expect(rows[0].location).toBe('United States');
  });

  test('uses city alone when region is missing', () => {
    const rows = buildGameRows(
      [game('ABCD', 100)],
      { ABCD: { city: 'Kansas City', region: null, country: 'United States' } }
    );
    expect(rows[0].location).toBe('Kansas City');
  });

  test('is null when there is no matching origin record', () => {
    const rows = buildGameRows([game('ABCD', 100)], {});
    expect(rows[0].location).toBeNull();
  });

  test('defaults origins to {} when omitted', () => {
    const rows = buildGameRows([game('ABCD', 100)]);
    expect(rows[0].location).toBeNull();
  });
});

describe('buncoClaimUpdate', () => {
  test('claims the bunco when none exists yet', () => {
    expect(buncoClaimUpdate(null, 'p1', 2, 12345)).toEqual({
      playerId: 'p1',
      tableId: 2,
      ts: 12345,
    });
  });

  test('returns undefined (aborts) when a bunco is already claimed', () => {
    const existing = { playerId: 'p9', tableId: 1, ts: 1 };
    expect(buncoClaimUpdate(existing, 'p1', 2, 12345)).toBeUndefined();
  });

  test('treats undefined current the same as null (fresh round)', () => {
    expect(buncoClaimUpdate(undefined, 'p3', 1, 99)).toEqual({
      playerId: 'p3',
      tableId: 1,
      ts: 99,
    });
  });
});

describe('uncallGameUpdate', () => {
  test('clears gameCalledBy when it still points at the undoing table', () => {
    expect(uncallGameUpdate(2, 2)).toBeNull();
  });

  test('aborts (leaves it alone) when another table has since called Game', () => {
    expect(uncallGameUpdate(3, 2)).toBeUndefined();
  });

  test('aborts when nothing has called Game', () => {
    expect(uncallGameUpdate(null, 2)).toBeUndefined();
  });
});

describe('describeResumableGame', () => {
  test('returns null when the game no longer exists', () => {
    expect(describeResumableGame('ABCD', null)).toBeNull();
  });

  test('waiting for round 1 (currentRound 0) points back to the game', () => {
    const game = { meta: { currentRound: 0 } };
    expect(describeResumableGame('ABCD', game)).toEqual({
      code: 'ABCD',
      ended: false,
      text: "You're still in game ABCD.",
      linkText: 'Rejoin game',
      href: 'game.html?code=ABCD',
    });
  });

  test('a round in progress (1-6) points back to the game', () => {
    const game = { meta: { currentRound: 3 } };
    expect(describeResumableGame('ABCD', game)).toMatchObject({
      ended: false,
      href: 'game.html?code=ABCD',
    });
  });

  test('a finished game (currentRound 7) points to final standings', () => {
    const game = { meta: { currentRound: 7 } };
    expect(describeResumableGame('WXYZ', game)).toEqual({
      code: 'WXYZ',
      ended: true,
      text: 'Game WXYZ has finished.',
      linkText: 'See final standings',
      href: 'standings.html?code=WXYZ&final=true',
    });
  });

  test('missing meta is treated as round 0 (waiting)', () => {
    expect(describeResumableGame('ABCD', {})).toMatchObject({ ended: false });
  });
});

describe('roundWinners', () => {
  const assignments = {
    a: { tableId: 1, side: 'us' },   b: { tableId: 1, side: 'us' },
    c: { tableId: 1, side: 'them' }, d: { tableId: 1, side: 'them' },
    e: { tableId: 2, side: 'us' },   f: { tableId: 2, side: 'them' },
  };

  test('without a Bunco the higher score wins', () => {
    const r = roundWinners({ 1: { usScore: 21, themScore: 9 }, 2: { usScore: 4, themScore: 21 } }, assignments, {}, 2);
    expect(r[1]).toEqual({ winner: 'us', bunco: false });
    expect(r[2]).toEqual({ winner: 'them', bunco: false });
  });

  test("a Bunco wins the table for the roller's team even when they're behind", () => {
    const r = roundWinners({ 1: { usScore: 18, themScore: 6 }, 2: { usScore: 21, themScore: 3 } }, assignments, { c: 1 }, 2);
    expect(r[1]).toEqual({ winner: 'them', bunco: true });
    expect(r[2]).toEqual({ winner: 'us', bunco: false }); // other tables unaffected
  });

  test('the Bunco win flows into standings as a win', () => {
    const tables = { 1: { usScore: 18, themScore: 6 }, 2: { usScore: 21, themScore: 3 } };
    const buncos = { c: 1 };
    const results = roundWinners(tables, assignments, buncos, 2);
    const next = updateStandings({}, tables, results, assignments, buncos);
    expect(next.c).toMatchObject({ wins: 1, losses: 0, buncos: 1 });
    expect(next.d).toMatchObject({ wins: 1, losses: 0 });
    expect(next.a).toMatchObject({ wins: 0, losses: 1 });
  });
});

describe('deriveStandings', () => {
  // Shape of a real two-round game (code 3UJV) whose stored standings
  // double-counted round 1. Players renamed; firebase arrays keep index 0 null.
  const a = (tableId, side) => ({ tableId, side });
  const rounds = [
    null,
    {
      assignments: { jo: a(1, 'us'), wi: a(2, 'us'), fr: a(2, 'them'), sp: a(2, 'us'), ke: a(2, 'them'), mi: a(1, 'them'), pa: a(1, 'them'), ja: a(1, 'us') },
      tables: [null, { usScore: 0, themScore: 21, submitted: true }, { usScore: 21, themScore: 20, submitted: true }],
    },
    {
      assignments: { jo: a(2, 'us'), wi: a(2, 'us'), fr: a(1, 'us'), sp: a(2, 'them'), ke: a(1, 'them'), mi: a(1, 'us'), pa: a(1, 'them'), ja: a(2, 'them') },
      buncos: { mi: 1 },
      tables: [null, { usScore: 5, themScore: 21, submitted: true }, { usScore: 6, themScore: 12, submitted: true }],
    },
  ];

  test('counts each completed round exactly once', () => {
    const s = deriveStandings(rounds, 2, 2);
    expect(s.wi).toEqual({ wins: 1, losses: 1, buncos: 0, totalPoints: 27 });
    expect(s.sp).toEqual({ wins: 2, losses: 0, buncos: 0, totalPoints: 33 });
  });

  test('a Bunco wins round 2 for the roller and teammate despite the score', () => {
    const s = deriveStandings(rounds, 2, 2);
    expect(s.mi).toEqual({ wins: 2, losses: 0, buncos: 1, totalPoints: 26 });
    expect(s.fr).toEqual({ wins: 1, losses: 1, buncos: 0, totalPoints: 25 });
    expect(s.ke).toEqual({ wins: 0, losses: 2, buncos: 0, totalPoints: 41 });
  });

  test('an in-progress round adds only its Buncos', () => {
    const live = [rounds[0], rounds[1], { ...rounds[2], tables: [null, { submitted: true, usScore: 5, themScore: 21 }, {}] }];
    const s = deriveStandings(live, 2, 2);
    expect(s.mi).toEqual({ wins: 1, losses: 0, buncos: 1, totalPoints: 21 });
    expect(s.wi).toEqual({ wins: 1, losses: 0, buncos: 0, totalPoints: 21 });
  });

  test('ignores rounds past the current one and a finished game (round 7) counts all six', () => {
    expect(deriveStandings(rounds, 1, 2).wi).toEqual({ wins: 1, losses: 0, buncos: 0, totalPoints: 21 });
    expect(deriveStandings(rounds, 7, 2).wi).toEqual({ wins: 1, losses: 1, buncos: 0, totalPoints: 27 });
  });

  test('no rounds yet → empty standings', () => {
    expect(deriveStandings(undefined, 0, 2)).toEqual({});
  });
});

describe('ghostClaimUpdate', () => {
  test('claims an open ghost seat under the new name', () => {
    expect(ghostClaimUpdate({ name: 'Ghost Gus', isGhost: true }, 'Dot')).toEqual({ name: 'Dot', isGhost: false });
  });

  test('aborts when someone already took the seat', () => {
    expect(ghostClaimUpdate({ name: 'Eve', isGhost: false }, 'Dot')).toBeUndefined();
  });

  test('passes null through so the server retries with its value', () => {
    expect(ghostClaimUpdate(null, 'Dot')).toBeNull();
  });
});

describe('submitLiveUpdate', () => {
  test("records the table's live tally, not a phone's copy", () => {
    expect(submitLiveUpdate({ liveUs: 12, liveThem: 21, submitted: false }))
      .toEqual({ liveUs: 12, liveThem: 21, usScore: 12, themScore: 21, submitted: true });
  });

  test('a table nobody tapped submits 0-0', () => {
    expect(submitLiveUpdate(null)).toEqual({ usScore: 0, themScore: 0, submitted: true });
  });
});

describe('tapSyncUpdate', () => {
  const live = t => `${t.liveUs}-${t.liveThem}`;

  test("adds this phone's new taps to the live tally", () => {
    const t = tapSyncUpdate({ liveUs: 4, liveThem: 2, taps: { p1: { us: 1, them: 0 } } }, 'p1', { us: 2, them: 0 });
    expect(live(t)).toBe('5-2');
    expect(t.taps.p1).toEqual({ us: 2, them: 0 });
  });

  test('sending the same counts again changes nothing (a resend after a reload)', () => {
    const once = tapSyncUpdate({ liveUs: 4, liveThem: 2 }, 'p1', { us: 1, them: 0 });
    expect(tapSyncUpdate(once, 'p1', { us: 1, them: 0 })).toEqual(once);
  });

  test("leaves other phones' taps alone", () => {
    const t = tapSyncUpdate({ liveUs: 3, liveThem: 0, taps: { p2: { us: 3, them: 0 } } }, 'p1', { us: 0, them: 1 });
    expect(live(t)).toBe('3-1');
    expect(t.taps.p2).toEqual({ us: 3, them: 0 });
  });

  test("an undo can take back a tablemate's point, but never below 0", () => {
    const t = tapSyncUpdate({ liveUs: 1, liveThem: 0, taps: { p2: { us: 1, them: 0 } } }, 'p1', { us: -2, them: 0 });
    expect(live(t)).toBe('0-0');
    // ...and this phone's next tap still shows up
    expect(live(tapSyncUpdate(t, 'p1', { us: -1, them: 0 }))).toBe('1-0');
  });

  test("a tap that lands after a tablemate submitted moves the table's score too", () => {
    const t = tapSyncUpdate({ liveUs: 20, liveThem: 17, usScore: 20, themScore: 17, submitted: true }, 'p1', { us: 1, them: 0 });
    expect(`${t.usScore}-${t.themScore}`).toBe('21-17');
  });

  test("an unloaded table starts from this phone's counts", () => {
    expect(live(tapSyncUpdate(null, 'p1', { us: 0, them: 1 }))).toBe('0-1');
  });
});
