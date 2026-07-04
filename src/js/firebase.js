import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onValue,
  off,
  runTransaction,
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
} from 'firebase/database';

import { buncoClaimUpdate } from './game-logic.js';

// ⚠️  databaseURL must match your Firebase Realtime Database URL.
// Verify at: Firebase Console → Realtime Database → Data tab (shown at top)
const firebaseConfig = {
  apiKey:            "AIzaSyCAjCEbofBw28Iw9nR4Ahko7RA8vPrvMNE",
  authDomain:        "bunco-60f5d.firebaseapp.com",
  databaseURL:       "https://bunco-60f5d-default-rtdb.firebaseio.com",
  projectId:         "bunco-60f5d",
  storageBucket:     "bunco-60f5d.firebasestorage.app",
  messagingSenderId: "306156652398",
  appId:             "1:306156652398:web:0031baa95c988c2bf2237f",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// Logging helper
function logSend(path, data) {
  console.log(`[FB SEND] ${path}`, data);
}

function logReceive(path, data) {
  console.log(`[FB RECEIVE] ${path}`, data);
}

// ─── Game meta ───────────────────────────────────────────────

export async function createGame(code, hostDeviceId, numTables, ghostSlots) {
  const gameData = {
    meta: {
      tables: numTables,
      ghostSlots,
      currentRound: 0,
      gameCalledBy: null,
      hostDeviceId,
      createdAt: serverTimestamp(),
    },
    players: {},
    rounds: {},
    standings: {},
  };
  logSend(`games/${code}`, gameData);
  await set(ref(db, `games/${code}`), gameData);
}

export async function getGame(code) {
  const snap = await get(ref(db, `games/${code}`));
  const result = snap.exists() ? snap.val() : null;
  logReceive(`games/${code}`, result);
  return result;
}

export function watchGame(code, callback) {
  const r = ref(db, `games/${code}`);
  onValue(r, snap => {
    const data = snap.val();
    logReceive(`games/${code}`, data);
    callback(data);
  });
  return () => off(r);
}

// ─── Players ─────────────────────────────────────────────────

export async function addPlayer(code, name, isGhost = false) {
  const playerRef = push(ref(db, `games/${code}/players`));
  const playerData = { name, isGhost };
  logSend(`games/${code}/players/${playerRef.key}`, playerData);
  await set(playerRef, playerData);
  return playerRef.key;
}

export async function claimGhostSeat(code, playerId, name) {
  const updateData = { name, isGhost: false };
  logSend(`games/${code}/players/${playerId}`, updateData);
  await update(ref(db, `games/${code}/players/${playerId}`), updateData);
}

// ─── Live scoring ─────────────────────────────────────────────

export async function incrementTableScore(code, roundNumber, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}/${field}`);
  logSend(`games/${code}/rounds/${roundNumber}/tables/${tableId}/${field}`, `increment`);
  await runTransaction(r, current => (current || 0) + 1);
}

export async function decrementTableScore(code, roundNumber, tableId, side) {
  const field = side === 'us' ? 'liveUs' : 'liveThem';
  const r = ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}/${field}`);
  logSend(`games/${code}/rounds/${roundNumber}/tables/${tableId}/${field}`, `decrement`);
  await runTransaction(r, current => Math.max(0, (current || 0) - 1));
}

export function watchTableScore(code, roundNumber, tableId, callback) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`);
  onValue(r, snap => {
    const data = snap.val() || {};
    logReceive(`games/${code}/rounds/${roundNumber}/tables/${tableId}`, data);
    callback(data);
  });
  return () => off(r);
}

export function watchAllTableScores(code, roundNumber, callback) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/tables`);
  onValue(r, snap => {
    const data = snap.val() || {};
    logReceive(`games/${code}/rounds/${roundNumber}/tables`, data);
    callback(data);
  });
  return () => off(r);
}

// ─── Seating assignments ─────────────────────────────────────

export async function saveRoundAssignments(code, roundNumber, assignments) {
  logSend(`games/${code}/rounds/${roundNumber}/assignments`, assignments);
  await set(ref(db, `games/${code}/rounds/${roundNumber}/assignments`), assignments);
}

export async function getRoundAssignments(code, roundNumber) {
  const snap = await get(ref(db, `games/${code}/rounds/${roundNumber}/assignments`));
  const result = snap.exists() ? snap.val() : {};
  logReceive(`games/${code}/rounds/${roundNumber}/assignments`, result);
  return result;
}

// ─── Scoring ─────────────────────────────────────────────────

export async function updateTableScore(code, roundNumber, tableId, usScore, themScore) {
  const updateData = { usScore, themScore, submitted: false };
  logSend(`games/${code}/rounds/${roundNumber}/tables/${tableId}`, updateData);
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), updateData);
}

export async function submitTableScore(code, roundNumber, tableId, usScore, themScore) {
  const updateData = { usScore, themScore, submitted: true };
  logSend(`games/${code}/rounds/${roundNumber}/tables/${tableId}`, updateData);
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), updateData);
}

export async function recordBunco(code, roundNumber, playerId, tableId) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/bunco`);
  logSend(`games/${code}/rounds/${roundNumber}/bunco`, { playerId, tableId });
  const result = await runTransaction(r, current =>
    buncoClaimUpdate(current, playerId, tableId, Date.now())
  );
  if (!result.committed) return false;
  // Legacy per-player shape (standings math, debug timeline) + the round call
  // ride together in one atomic multi-path update — a network drop after the
  // claim commits must not leave the claim locked with no credit and no call.
  const updateData = {
    [`rounds/${roundNumber}/buncos/${playerId}`]: 1,
    'meta/gameCalledBy': tableId,
  };
  logSend(`games/${code}`, updateData);
  try {
    await update(ref(db, `games/${code}`), updateData);
  } catch (err) {
    throw new Error('bunco-claim-sync-failed');
  }
  return true;
}

// ─── Game flow ───────────────────────────────────────────────

export async function callGame(code, tableId) {
  const updateData = { gameCalledBy: tableId };
  logSend(`games/${code}/meta`, updateData);
  await update(ref(db, `games/${code}/meta`), updateData);
}

export async function startRound(code, fromRound, toRound) {
  const r = ref(db, `games/${code}/meta/currentRound`);
  logSend(`games/${code}/meta/currentRound`, `transaction ${fromRound} → ${toRound}`);
  const result = await runTransaction(r, (current) => {
    if (current !== fromRound) return; // already advanced — abort
    return toRound;
  });
  if (result.committed) {
    await update(ref(db, `games/${code}/meta`), { gameCalledBy: null });
  }
  return result.committed;
}

export async function saveStandings(code, standings) {
  logSend(`games/${code}/standings`, standings);
  await set(ref(db, `games/${code}/standings`), standings);
}

export async function initializeRoundTables(code, roundNumber, numTables) {
  const tables = {};
  for (let i = 1; i <= numTables; i++) {
    tables[i] = { liveUs: 0, liveThem: 0, submitted: false };
  }
  logSend(`games/${code}/rounds/${roundNumber}/tables`, tables);
  await set(ref(db, `games/${code}/rounds/${roundNumber}/tables`), tables);
}

// ─── Event log ───────────────────────────────────────────────

export const EVENT = Object.freeze({
  GAME_CREATED:    'game_created',
  PLAYER_JOINED:   'player_joined',
  GHOST_CLAIMED:   'ghost_claimed',
  SEATS_ASSIGNED:  'seats_assigned',
  ROUND_STARTED:   'round_started',
  GAME_CALLED:     'game_called',
  SCORE_SUBMITTED: 'score_submitted',
  BUNCO_RECORDED:  'bunco_recorded',
  GAME_ENDED:      'game_ended',
  STANDINGS_SAVED: 'standings_saved',
});

export async function logEvent(code, type, payload = {}) {
  await push(ref(db, `games/${code}/events`), { type, ts: Date.now(), ...payload });
}

export function watchEvents(code, callback) {
  const r = ref(db, `games/${code}/events`);
  onValue(r, snap => callback(snap.val()));
  return () => off(r);
}

// ─── Admin ───────────────────────────────────────────────────

export async function getRecentGames(limit = 25) {
  const q = query(ref(db, 'games'), orderByChild('meta/createdAt'), limitToLast(limit));
  const snap = await get(q);
  const games = [];
  snap.forEach(child => {
    games.push({ code: child.key, ...child.val() });
  });
  logReceive(`games (recent, limit ${limit})`, `${games.length} games`);
  return games;
}
