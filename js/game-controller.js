// js/game-controller.js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, callGame, submitTableScore,
         getRoundAssignments, saveStandings,
         incrementTableScore, decrementTableScore, watchTableScore, watchAllTableScores, initializeRoundTables } from './firebase.js';
import { generateGameCode, assignRandomSeats,
         calculateNextRoundSeating, determineWinner, updateStandings, buildTableLayout } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId } from './ui.js';
import { renderTableCards } from './table-cards.js';
import { isNameTaken, getAvailableGhostSeats, allTablesSubmitted, pickGhostNames } from './game-utils.js';

const deviceId = getDeviceId();
const urlCode  = getParam('code');
const isHost   = getParam('host') === 'true';

let gameCode    = null;
let gameData    = null;
let unsubscribe = null;
let myPlayerId  = null;

// ─── Entry point ──────────────────────────────────────────────

if (isHost && !urlCode) {
  showView('view-setup');
  document.getElementById('create-game-btn').addEventListener('click', handleCreateGame);
} else if (urlCode) {
  gameCode = urlCode.toUpperCase();
  const storedHostCode = localStorage.getItem('bunco_host_code');
  const storedPlayerId = localStorage.getItem(`bunco_player_${gameCode}`);

  if (storedHostCode === gameCode || isHost) {
    // Host returning or first load
    localStorage.setItem('bunco_host_code', gameCode);
    showWaitingRoom(true);
    subscribeToGame();
  } else if (storedPlayerId) {
    // Returning player — skip join form, go straight to waiting room.
    // onGameUpdate will auto-navigate to scoring if round is already active.
    myPlayerId = storedPlayerId;
    showWaitingRoom(false);
    subscribeToGame();
  } else {
    // Fresh player — show join form and subscribe immediately for live status.
    showView('view-join');
    document.getElementById('join-display-code').textContent = gameCode;
    const spectateLink = document.getElementById('join-spectate-link');
    if (spectateLink) spectateLink.href = `standings.html?code=${gameCode}`;
    document.getElementById('join-btn').addEventListener('click', handleJoin);
    subscribeToGame();
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

  try {
    gameCode = generateGameCode();

    await createGame(gameCode, deviceId, numTables, ghostSlots);

    // Add ghost players with random names
    const ghostNames = pickGhostNames(ghostSlots);
    for (const name of ghostNames) {
      await addPlayer(gameCode, name, true);
    }

    // Remember this device is the host for this code
    localStorage.setItem('bunco_host_code', gameCode);

    // Update URL so the code is visible/shareable, then show waiting room without a full reload.
    // A full redirect causes bfcache to restore the old setup-form DOM on some browsers.
    history.pushState(null, '', `game.html?code=${gameCode}&host=true`);
    showWaitingRoom(true);
    subscribeToGame();
  } catch (err) {
    console.error('Failed to create game:', err);
    showToast('Failed to create game — check console for details.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Create Game';
  }
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

  if (isNameTaken(game.players || {}, name)) {
    showToast('That name is taken — try adding an initial.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Join';
    return;
  }

  const playerId = await addPlayer(gameCode, name, false);
  localStorage.setItem(`bunco_player_${gameCode}`, playerId);
  myPlayerId = playerId;

  const amHost = game.meta.hostDeviceId === deviceId;
  showWaitingRoom(amHost);
}

// ─── Waiting room ─────────────────────────────────────────────

function renderQrCode(code) {
  const el = document.getElementById('waiting-qr');
  el.innerHTML = '';
  const url = `${window.location.origin}/game.html?code=${code}`;
  new QRCode(el, { text: url, width: 160, height: 160, colorDark: '#000000', colorLight: '#ffffff' });
}

function showWaitingRoom(isHostView) {
  showView('view-waiting');
  document.getElementById('waiting-code').textContent = gameCode;
  renderQrCode(gameCode);
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

function renderHostSeatLayout(data) {
  const layout    = document.getElementById('host-seat-layout');
  const badgeList = document.getElementById('waiting-player-list');
  if (!layout) return;

  layout.style.display = '';
  if (badgeList) badgeList.style.display = 'none';

  const assignments    = data.rounds?.[1]?.assignments || {};
  allTableScoresTables = buildTableLayout(data.players || {}, assignments, data.meta.tables);
  const round  = data.meta.currentRound;

  if (round >= 1 && round !== allTableScoresRound) {
    if (allTableScoresUnsubscribe) allTableScoresUnsubscribe();
    allTableScoresRound        = round;
    allTableScoresUnsubscribe  = watchAllTableScores(gameCode, round, scores => {
      renderTableCards(layout, allTableScoresTables, scores);
    });
  } else if (round === 0) {
    renderTableCards(layout, allTableScoresTables, {});
  }
}

export function onGameUpdate(data) {
  if (!data || !data.meta) return;
  gameData = data;

  const players      = data.players || {};
  const humanPlayers = Object.values(players).filter(p => !p.isGhost);
  const totalSeats   = data.meta.tables * 4 - data.meta.ghostSlots;

  // Update join view if visible
  const joinPregame = document.getElementById('join-pregame');
  if (joinPregame) updateJoinView(data);

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

  updateWaitingRoomSeat(data);

  if (isHost && data.rounds?.[1]?.assignments) {
    renderHostSeatLayout(data);
  }

  // Show game-called banner on scoring view
  const banner = document.getElementById('game-called-banner');
  if (banner) {
    banner.style.display = data.meta.gameCalledBy ? '' : 'none';
  }

  // Round just started — navigate to scoring
  const currentView = [...document.querySelectorAll('[data-view]')]
    .find(el => el.style.display !== 'none')?.id;

  if (data.meta.currentRound >= 1 && (currentView === 'view-waiting' || currentView === 'view-submitted')) {
    navigateToScoring(data);
  }

  // Game complete
  if (data.meta.currentRound === 7) {
    window.location.href = `standings.html?code=${gameCode}&final=true`;
  }

  // Show "Start Next Round" button when all tables have submitted
  const nextRoundBtn = document.getElementById('start-next-round-btn');
  const waitingMsg   = document.getElementById('submitted-waiting-msg');
  if (nextRoundBtn) {
    const round = data.meta.currentRound;
    if (round >= 1 && round <= 6) {
      const tables  = data.rounds?.[round]?.tables || {};
      const allDone = allTablesSubmitted(tables, data.meta.tables);
      nextRoundBtn.style.display = allDone ? '' : 'none';
      nextRoundBtn.textContent   = round === 6 ? 'Finish Game' : 'Start Next Round';
      if (waitingMsg) waitingMsg.style.display = allDone ? 'none' : '';
    } else {
      nextRoundBtn.style.display = 'none';
      if (waitingMsg) waitingMsg.style.display = '';
    }
  }
}

// ─── Seat assignment ──────────────────────────────────────────

async function handleRandomSeat() {
  const players      = gameData.players || {};
  const humanPlayers = Object.values(players).filter(p => !p.isGhost);
  const totalSeats   = gameData.meta.tables * 4 - gameData.meta.ghostSlots;

  if (humanPlayers.length < totalSeats) {
    showToast(`Waiting for players — ${humanPlayers.length}/${totalSeats} joined.`, 'warning');
    return;
  }

  const playerIds   = Object.keys(players);
  const numTables   = gameData.meta.tables;
  const assignments = assignRandomSeats(playerIds, numTables);
  await saveRoundAssignments(gameCode, 1, assignments);
  showToast('Seats assigned randomly!', 'success');
}

async function handleStartRound() {
  if (!gameData.rounds || !gameData.rounds[1] || !gameData.rounds[1].assignments) {
    showToast('Assign seats first.', 'warning');
    return;
  }
  await initializeRoundTables(gameCode, 1, gameData.meta.tables);
  await startRound(gameCode, 0, 1);
}

// ─── Scoring view ─────────────────────────────────────────────

let usScore   = 0;
let themScore = 0;
let myTableId = null;
let scoringAbortController = null;
let tableScoreUnsubscribe = null;
let allTableScoresUnsubscribe = null;
let allTableScoresRound       = 0;
let allTableScoresTables      = [];

function navigateToScoring(data) {
  myPlayerId = localStorage.getItem(`bunco_player_${gameCode}`);
  const storedHostCode = localStorage.getItem('bunco_host_code');

  // Host-only device (not also a player) — send to standings dashboard instead
  if (!myPlayerId && storedHostCode === gameCode) {
    window.location.href = `standings.html?code=${gameCode}`;
    return;
  }

  const assignments = data.rounds?.[data.meta.currentRound]?.assignments || {};
  const myAssignment = myPlayerId ? assignments[myPlayerId] : null;

  myTableId = myAssignment?.tableId || 1;
  usScore   = 0;
  themScore = 0;
  if (scoringAbortController) scoringAbortController.abort();
  scoringAbortController = new AbortController();
  if (tableScoreUnsubscribe) tableScoreUnsubscribe();
  tableScoreUnsubscribe = null;
  if (allTableScoresUnsubscribe) {
    allTableScoresUnsubscribe();
    allTableScoresUnsubscribe = null;
    allTableScoresRound = 0;
  }
  tableScoreUnsubscribe = watchTableScore(gameCode, data.meta.currentRound, myTableId, tableData => {
    usScore = tableData.liveUs || 0;
    themScore = tableData.liveThem || 0;
    renderScores();
  });

  showView('view-scoring');

  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }

  document.getElementById('round-label').textContent =
    `Round ${data.meta.currentRound} of 6`;

  // Display player names for each side
  const players = data.players || {};
  const usPlayers = Object.entries(assignments)
    .filter(([, a]) => a.tableId === myTableId && a.side === 'us')
    .map(([id]) => players[id]?.name)
    .filter(Boolean)
    .join(' & ');
  const themPlayers = Object.entries(assignments)
    .filter(([, a]) => a.tableId === myTableId && a.side === 'them')
    .map(([id]) => players[id]?.name)
    .filter(Boolean)
    .join(' & ');

  const usNameEl = document.getElementById('sc-us-names');
  const themNameEl = document.getElementById('sc-them-names');
  if (usNameEl) usNameEl.textContent = usPlayers;
  if (themNameEl) themNameEl.textContent = themPlayers;

  attachScoringListeners(data.meta.currentRound);
}

function renderScores() {
  document.getElementById('sc-us-score').textContent   = usScore;
  document.getElementById('sc-them-score').textContent = themScore;
  document.getElementById('sc-us').style.backgroundColor =
    usScore >= 21 ? 'rgba(30,100,220,0.7)' : 'rgba(30,60,120,0.35)';
  document.getElementById('sc-them').style.backgroundColor =
    themScore >= 21 ? 'rgba(220,110,0,0.7)' : 'rgba(140,70,0,0.35)';
}

function attachScoringListeners(roundNumber) {
  const signal = scoringAbortController.signal;

  document.getElementById('sc-us').addEventListener('click', e => {
    if (e.target.closest('#sc-us-dec')) return;
    incrementTableScore(gameCode, roundNumber, myTableId, 'us')
      .catch(() => showToast('Tap not saved — check connection.', 'warning'));
  }, { signal });
  document.getElementById('sc-them').addEventListener('click', e => {
    if (e.target.closest('#sc-them-dec')) return;
    incrementTableScore(gameCode, roundNumber, myTableId, 'them')
      .catch(() => showToast('Tap not saved — check connection.', 'warning'));
  }, { signal });
  document.getElementById('sc-us-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'us')
      .catch(() => showToast('Tap not saved — check connection.', 'warning'));
  }, { signal });
  document.getElementById('sc-them-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'them')
      .catch(() => showToast('Tap not saved — check connection.', 'warning'));
  }, { signal });
  document.getElementById('bunco-btn').addEventListener('click', () => handleBunco(roundNumber), { signal });
  document.getElementById('call-game-btn').addEventListener('click', () => handleCallGame(), { signal });
  document.getElementById('submit-scores-btn').addEventListener('click', () => handleSubmitScores(roundNumber), { signal });
}

async function handleBunco(roundNumber) {
  if (!myPlayerId) return;
  await recordBunco(gameCode, roundNumber, myPlayerId);
  showToast('Bunco recorded!', 'success');
}

async function handleCallGame() {
  await callGame(gameCode, myTableId);
  showToast('Game called! Other tables are finishing their rolls.', 'info');
}

async function handleSubmitScores(roundNumber) {
  await submitTableScore(gameCode, roundNumber, myTableId, usScore, themScore);
  document.getElementById('view-standings-link').href = `standings.html?code=${gameCode}`;
  showView('view-submitted');
}

// ─── Round end ────────────────────────────────────────────────

function updateWaitingRoomSeat(data) {
  const seatInfo = document.getElementById('waiting-seat-info');
  const playerList = document.getElementById('waiting-player-list');
  if (!seatInfo || !playerList) return;

  const assignments = data.rounds?.[1]?.assignments;
  if (!myPlayerId || !assignments || !assignments[myPlayerId]) {
    // No assignment yet — show player list, hide seat card
    seatInfo.style.display = 'none';
    playerList.style.display = '';
    return;
  }

  const players = data.players || {};
  const mine = assignments[myPlayerId];

  const teammate = Object.entries(assignments).find(([id, a]) =>
    id !== myPlayerId && a.tableId === mine.tableId && a.side === mine.side
  );
  const opponents = Object.entries(assignments).filter(([, a]) =>
    a.tableId === mine.tableId && a.side !== mine.side
  );

  const teammateName  = teammate  ? players[teammate[0]]?.name  : '—';
  const opponentNames = opponents.map(([id]) => players[id]?.name).filter(Boolean).join(' & ') || '—';

  document.getElementById('waiting-seat-table').textContent    = `📍 Table ${mine.tableId}`;
  document.getElementById('waiting-seat-teammate').textContent  = teammateName;
  document.getElementById('waiting-seat-opponents').textContent = opponentNames;

  // Swap: hide player list, show seat card
  playerList.style.display = 'none';
  seatInfo.style.display   = '';
}

function updateJoinView(data) {
  const inProgress = data.meta.currentRound >= 1;
  const pregameEl    = document.getElementById('join-pregame');
  const inprogressEl = document.getElementById('join-inprogress');
  if (!pregameEl || !inprogressEl) return;

  if (!inProgress) {
    // Show pre-game form with live player count
    pregameEl.style.display = '';
    inprogressEl.style.display = 'none';

    const humanCount = Object.values(data.players || {}).filter(p => !p.isGhost).length;
    const totalSeats = data.meta.tables * 4 - data.meta.ghostSlots;
    const countEl = document.getElementById('join-live-count');
    if (countEl) {
      countEl.textContent = `${humanCount} / ${totalSeats} players joined`;
      countEl.style.display = '';
    }
  } else {
    // Show in-progress options
    pregameEl.style.display = 'none';
    inprogressEl.style.display = '';

    // Wire spectate link
    const spectateBtn = document.getElementById('join-spectate-btn');
    if (spectateBtn) spectateBtn.href = `standings.html?code=${gameCode}`;

    // Populate ghost seat list
    const assignments = data.rounds?.[data.meta.currentRound]?.assignments || {};
    const ghosts = getAvailableGhostSeats(data.players || {}, assignments);
    const ghostSection = document.getElementById('join-ghost-section');
    const ghostList    = document.getElementById('join-ghost-list');
    if (ghostSection && ghostList) {
      if (ghosts.length === 0) {
        ghostSection.style.display = 'none';
      } else {
        ghostSection.style.display = '';
        const claimEl = document.getElementById('join-ghost-claim');
        const claimVisible = claimEl && claimEl.style.display !== 'none';
        if (!claimVisible) {
          ghostList.innerHTML = '';
          ghosts.forEach(({ ghostId, tableId, teammateName }) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-secondary w-100';
            btn.textContent = teammateName
              ? `Table ${tableId} — with ${teammateName}`
              : `Table ${tableId}`;
            btn.addEventListener('click', () => handleClaimGhost(ghostId));
            ghostList.appendChild(btn);
          });
        }
      }
    }
  }
}

let pendingGhostId = null;

function handleClaimGhost(ghostId) {
  pendingGhostId = ghostId;
  const claimEl = document.getElementById('join-ghost-claim');
  const listEl  = document.getElementById('join-ghost-list');
  if (claimEl) claimEl.style.display = '';
  if (listEl)  listEl.style.display  = 'none';

  const confirmBtn = document.getElementById('join-ghost-confirm');
  const cancelBtn  = document.getElementById('join-ghost-cancel');
  const nameInput  = document.getElementById('join-ghost-name');

  if (!confirmBtn || !cancelBtn) {
    if (claimEl) claimEl.style.display = 'none';
    if (listEl)  listEl.style.display  = '';
    pendingGhostId = null;
    return;
  }

  confirmBtn.onclick = async () => {
    const name = nameInput.value.trim();
    if (!name) { showToast('Please enter your name.', 'warning'); return; }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Joining…';
    try {
      if (!gameData) throw new Error('Game data unavailable');
      await claimGhostSeat(gameCode, pendingGhostId, name);
      localStorage.setItem(`bunco_player_${gameCode}`, pendingGhostId);
      navigateToScoring(gameData);
    } catch (err) {
      console.error('Failed to claim ghost seat:', err);
      showToast('Failed to join — please try again.', 'warning');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Take this seat';
    }
  };

  cancelBtn.onclick = () => {
    pendingGhostId = null;
    if (claimEl) claimEl.style.display = 'none';
    if (listEl)  listEl.style.display  = '';
    if (nameInput) nameInput.value = '';
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Take this seat';
  };
}

async function handleAdvanceRound() {
  const roundNumber = gameData?.meta?.currentRound;
  if (!roundNumber || roundNumber < 1 || roundNumber > 6) return;

  const tables    = gameData.rounds?.[roundNumber]?.tables || {};
  const numTables = gameData.meta.tables;
  if (!allTablesSubmitted(tables, numTables)) return;

  const roundResults = {};
  for (let t = 1; t <= numTables; t++) {
    const { usScore, themScore } = tables[t];
    roundResults[t] = { winner: determineWinner(usScore, themScore) };
  }

  const assignments = await getRoundAssignments(gameCode, roundNumber);
  const buncos      = gameData.rounds?.[roundNumber]?.buncos || {};
  const current     = gameData.standings || {};
  const next        = updateStandings(current, tables, roundResults, assignments, buncos);
  await saveStandings(gameCode, next);

  if (roundNumber >= 6) {
    await startRound(gameCode, roundNumber, 7);
    return;
  }

  const nextAssignments = calculateNextRoundSeating(assignments, roundResults, numTables);
  await saveRoundAssignments(gameCode, roundNumber + 1, nextAssignments);
  await startRound(gameCode, roundNumber, roundNumber + 1);
}

document.getElementById('start-next-round-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  await handleAdvanceRound().catch(() => showToast('Error advancing round — please refresh.', 'warning'));
  btn.disabled = false;
});
