// js/game-utils.js

export const GHOST_NAMES = [
  'Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank',
  'Iris','Jack','Karen','Leo','Mia','Nate','Olivia','Pete',
  'Quinn','Rosa','Sam','Tina','Uma','Vince','Wendy','Xander',
  'Yara','Zoe','Amber','Brett','Chloe','Derek'
];

export function isNameTaken(players, name) {
  const taken = Object.values(players).map(p => (p.name ?? '').toLowerCase());
  return taken.includes(name.toLowerCase());
}

export function getAvailableGhostSeats(players, assignments) {
  return Object.entries(players)
    .filter(([, p]) => p.isGhost)
    .map(([ghostId]) => {
      const a = assignments[ghostId];
      if (!a) return null;
      const teammate = Object.entries(assignments).find(([id, b]) =>
        id !== ghostId && b.tableId === a.tableId && b.side === a.side
      );
      const teammateName = teammate ? (players[teammate[0]]?.name ?? null) : null;
      return { ghostId, tableId: a.tableId, teammateName };
    })
    .filter(Boolean);
}

export function getGhostOnlyTableIds(assignments, players, numTables) {
  const result = [];
  for (let t = 1; t <= numTables; t++) {
    const hasRealPlayer = Object.entries(assignments).some(
      ([id, a]) => a.tableId === t && !players[id]?.isGhost
    );
    if (!hasRealPlayer) result.push(t);
  }
  return result;
}

export function allTablesSubmitted(tables, numTables) {
  for (let t = 1; t <= numTables; t++) {
    if (!tables[t]?.submitted) return false;
  }
  return true;
}

export function pickGhostNames(count) {
  const pool = [...GHOST_NAMES];
  const safeCount = Math.min(count, pool.length);
  const picked = [];
  for (let i = 0; i < safeCount; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export const MIN_TABLES  = 2;
export const MAX_PLAYERS = 24;

/**
 * Turns the host's headcount into a table layout: as few tables as fit
 * everyone (never fewer than two), with ghosts in the leftover seats.
 * @param {number} players - real people playing, 1..MAX_PLAYERS
 * @returns {{ players: number, tables: number, ghosts: number }}
 */
export function seatPlan(players) {
  const n = Math.min(MAX_PLAYERS, Math.max(1, Math.round(Number(players) || 0)));
  const tables = Math.max(MIN_TABLES, Math.ceil(n / 4));
  return { players: n, tables, ghosts: tables * 4 - n };
}
