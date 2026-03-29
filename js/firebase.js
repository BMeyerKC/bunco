// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  onValue,
  off,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

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

// ─── Game meta ───────────────────────────────────────────────

export async function createGame(code, hostDeviceId, numTables, ghostSlots) {
  await set(ref(db, `games/${code}`), {
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
  });
}

export async function getGame(code) {
  const snap = await get(ref(db, `games/${code}`));
  return snap.exists() ? snap.val() : null;
}

export function watchGame(code, callback) {
  const r = ref(db, `games/${code}`);
  onValue(r, snap => callback(snap.val()));
  return () => off(r);
}

// ─── Players ─────────────────────────────────────────────────

export async function addPlayer(code, name, isGhost = false) {
  const playerRef = push(ref(db, `games/${code}/players`));
  await set(playerRef, { name, isGhost });
  return playerRef.key;
}

// ─── Seating assignments ─────────────────────────────────────

export async function saveRoundAssignments(code, roundNumber, assignments) {
  await set(ref(db, `games/${code}/rounds/${roundNumber}/assignments`), assignments);
}

export async function getRoundAssignments(code, roundNumber) {
  const snap = await get(ref(db, `games/${code}/rounds/${roundNumber}/assignments`));
  return snap.exists() ? snap.val() : {};
}

// ─── Scoring ─────────────────────────────────────────────────

export async function updateTableScore(code, roundNumber, tableId, usScore, themScore) {
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), {
    usScore,
    themScore,
    submitted: false,
  });
}

export async function submitTableScore(code, roundNumber, tableId, usScore, themScore) {
  await update(ref(db, `games/${code}/rounds/${roundNumber}/tables/${tableId}`), {
    usScore,
    themScore,
    submitted: true,
  });
}

export async function recordBunco(code, roundNumber, playerId) {
  const r = ref(db, `games/${code}/rounds/${roundNumber}/buncos/${playerId}`);
  const snap = await get(r);
  await set(r, (snap.val() || 0) + 1);
}

// ─── Game flow ───────────────────────────────────────────────

export async function callGame(code, tableId) {
  await update(ref(db, `games/${code}/meta`), { gameCalledBy: tableId });
}

export async function startRound(code, roundNumber) {
  await update(ref(db, `games/${code}/meta`), {
    currentRound: roundNumber,
    gameCalledBy: null,
  });
}

export async function saveStandings(code, standings) {
  await set(ref(db, `games/${code}/standings`), standings);
}
