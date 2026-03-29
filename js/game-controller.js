// js/game-controller.js
import { createGame, addPlayer, watchGame, getGame, saveRoundAssignments, startRound } from './firebase.js';
import { generateGameCode, assignRandomSeats } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId } from './ui.js';

const deviceId = getDeviceId();
const urlCode  = getParam('code');
const isHost   = getParam('host') === 'true';

let gameCode    = null;
let gameData    = null;
let unsubscribe = null;

// ─── Entry point ──────────────────────────────────────────────

if (isHost && !urlCode) {
  showView('view-setup');
  document.getElementById('create-game-btn').addEventListener('click', handleCreateGame);
} else if (urlCode) {
  gameCode = urlCode.toUpperCase();
  // Check if this device is the host returning to waiting room
  const storedHostCode = localStorage.getItem('bunco_host_code');
  if (storedHostCode === gameCode) {
    // Host returning — go straight to waiting room
    showWaitingRoom(true);
    subscribeToGame();
  } else {
    showView('view-join');
    document.getElementById('join-display-code').textContent = gameCode;
    document.getElementById('join-btn').addEventListener('click', handleJoin);
  }
} else {
  // No code, not host — redirect home
  window.location.href = 'index.html';
}

// ─── Host creates game ────────────────────────────────────────

async function handleCreateGame() {
  const btn = document.getElementById('create-game-btn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  const numTables  = parseInt(document.getElementById('setup-tables').value);
  const ghostSlots = parseInt(document.getElementById('setup-ghosts').value);

  gameCode = generateGameCode();

  await createGame(gameCode, deviceId, numTables, ghostSlots);

  // Add ghost players
  for (let i = 0; i < ghostSlots; i++) {
    await addPlayer(gameCode, `Ghost ${i + 1}`, true);
  }

  // Remember this device is the host for this code
  localStorage.setItem('bunco_host_code', gameCode);

  // Redirect host to waiting room with code in URL
  window.location.href = `game.html?code=${gameCode}&host=true`;
}

// ─── Player joins ─────────────────────────────────────────────

async function handleJoin() {
  const btn  = document.getElementById('join-btn');
  const name = document.getElementById('join-name').value.trim();
  if (!name) { showToast('Please enter your name.', 'warning'); return; }

  btn.disabled = true;
  btn.textContent = 'Joining…';

  const game = await getGame(gameCode);
  if (!game) {
    showToast('Game not found. Check your code.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Join';
    return;
  }

  // Check name uniqueness
  const taken = Object.values(game.players || {}).map(p => p.name.toLowerCase());
  if (taken.includes(name.toLowerCase())) {
    showToast('That name is taken — try adding an initial.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Join';
    return;
  }

  const playerId = await addPlayer(gameCode, name, false);
  localStorage.setItem(`bunco_player_${gameCode}`, playerId);

  const amHost = game.meta.hostDeviceId === deviceId;
  showWaitingRoom(amHost);
  subscribeToGame();
}

// ─── Waiting room ─────────────────────────────────────────────

function showWaitingRoom(isHostView) {
  showView('view-waiting');
  document.getElementById('waiting-code').textContent = gameCode;
  if (isHostView) {
    document.getElementById('host-controls').style.display = '';
    document.getElementById('random-seat-btn').addEventListener('click', handleRandomSeat);
    document.getElementById('start-round-btn').addEventListener('click', handleStartRound);
  }
}

function subscribeToGame() {
  unsubscribe = watchGame(gameCode, data => {
    gameData = data;
    onGameUpdate(data);
  });
}

export function onGameUpdate(data) {
  if (!data) return;
  gameData = data;

  const players      = data.players || {};
  const humanPlayers = Object.values(players).filter(p => !p.isGhost);
  const totalSeats   = data.meta.tables * 4 - data.meta.ghostSlots;

  // Update waiting room counts if visible
  const waitingCode = document.getElementById('waiting-code');
  if (waitingCode) {
    waitingCode.textContent = gameCode;
    const countEl = document.getElementById('waiting-count');
    const totalEl = document.getElementById('waiting-total');
    if (countEl) countEl.textContent = humanPlayers.length;
    if (totalEl) totalEl.textContent = totalSeats;

    const list = document.getElementById('waiting-player-list');
    if (list) {
      list.innerHTML = '';
      Object.values(players).forEach(p => {
        const badge = document.createElement('span');
        badge.className = `badge ${p.isGhost ? 'bg-secondary' : 'bg-primary'}`;
        badge.textContent = p.name;
        list.appendChild(badge);
      });
    }

    const startBtn = document.getElementById('start-round-btn');
    if (startBtn) startBtn.disabled = humanPlayers.length < totalSeats;
  }

  // Show game-called banner on scoring view
  const banner = document.getElementById('game-called-banner');
  if (banner) {
    banner.style.display = data.meta.gameCalledBy ? '' : 'none';
  }

  // Round just started — navigate to scoring
  const currentView = [...document.querySelectorAll('[data-view]')]
    .find(el => el.style.display !== 'none')?.id;

  if (data.meta.currentRound >= 1 && currentView === 'view-waiting') {
    navigateToScoring(data);
  }

  // Game complete
  if (data.meta.currentRound === 7) {
    window.location.href = `standings.html?code=${gameCode}&final=true`;
  }

  // Check if all tables submitted (host only — implemented in Task 9)
  if (data.meta.currentRound >= 1 && data.meta.currentRound <= 6) {
    if (typeof checkAndAdvanceRound === 'function') {
      checkAndAdvanceRound(data, data.meta.currentRound);
    }
  }
}

// ─── Seat assignment ──────────────────────────────────────────

async function handleRandomSeat() {
  const players   = gameData.players || {};
  const playerIds = Object.keys(players);
  const numTables = gameData.meta.tables;
  const assignments = assignRandomSeats(playerIds, numTables);
  await saveRoundAssignments(gameCode, 1, assignments);
  showToast('Seats assigned randomly!', 'success');
}

async function handleStartRound() {
  if (!gameData.rounds || !gameData.rounds[1] || !gameData.rounds[1].assignments) {
    showToast('Assign seats first.', 'warning');
    return;
  }
  await startRound(gameCode, 1);
}

// ─── Stubs for Tasks 8 and 9 ─────────────────────────────────

// navigateToScoring is implemented in Task 8
function navigateToScoring(data) {}

// checkAndAdvanceRound is implemented in Task 9
// (referenced via typeof check above)
