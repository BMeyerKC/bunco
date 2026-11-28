// js/sample-night.js — a made-up 12-player, 3-table night at the end of round 2.
// Drawn on the landing page to show the Head Table rule, and shared by tests.

const NAMES = ['Ann', 'Beth', 'Cara', 'Dot', 'Eve', 'Fay', 'Gail', 'Hope', 'Ivy', 'Jo', 'Kay', 'Lou'];

const players = {};
const assignments = {};
NAMES.forEach((name, i) => {
  const id = `p${i + 1}`;
  const pos = i % 4;
  players[id] = { name, isGhost: false };
  assignments[id] = { tableId: Math.floor(i / 4) + 1, side: pos < 2 ? 'us' : 'them', seat: (pos % 2) + 1 };
});

export const SAMPLE_NIGHT = Object.freeze({
  players,
  assignments,
  results: { 1: { winner: 'us' }, 2: { winner: 'us' }, 3: { winner: 'us' } },
  numTables: 3,
});
