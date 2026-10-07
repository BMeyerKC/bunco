// js/game-controller.js
import { createGame, addPlayer, claimGhostSeat, watchGame, getGame, saveRoundAssignments, startRound,
         recordBunco, undoBunco, callGame, submitTableScore,
         saveStandings,
         incrementTableScore, decrementTableScore, watchTableScore, watchAllTableScores, initializeRoundTables,
         EVENT, logEvent, logGameOrigin } from './firebase.js';
import { captureOrigin } from './geo.js';
import { generateGameCode, assignRandomSeats,
         calculateNextRoundSeating, roundWinners, updateStandings, buildTableLayout } from './game-logic.js';
import { showView, showToast, getParam, getDeviceId, rememberActiveGame } from './ui.js';
import { renderTableCards } from './table-cards.js';
import { renderTally, TARGET } from './tally.js';
import { keepScreenAwake } from './wake-lock.js';
import { isNameTaken, getAvailableGhostSeats, allTablesSubmitted, pickGhostNames, getGhostOnlyTableIds } from './game-utils.js';

const deviceId = getDeviceId();
const urlCode  = getParam('code');
const isHost   = getParam('host') === 'true';

let gameCode    = null;
let gameData    = null;
let unsubscribe = null;
let myPlayerId  = null;

let betweenRoundsForRound    = 0; // which round we've shown the between-rounds view for
let betweenRoundsPrepForRound = 0; // which round the host has already prepped
// Firebase's optimistic local write can fire onGameUpdate → showBetweenRoundsView
// *during* the await in handleSubmitScores, before showView('view-submitted') runs.
// This flag lets handleSubmitScores detect that and skip the override.
let betweenRoundsJustTriggered = false;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
    rememberActiveGame(gameCode);
    myPlayerId = localStorage.getItem(`bunco_player_${gameCode}`) || null;
    showWaitingRoom(true);
    subscribeToGame();
  } else if (storedPlayerId) {
    // Returning player — skip join form, go straight to waiting room.
    // onGameUpdate will auto-navigate to scoring if round is already active.
    myPlayerId = storedPlayerId;
    rememberActiveGame(gameCode);
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
    logEvent(gameCode, EVENT.GAME_CREATED, { tables: numTables, ghostSlots }).catch(() => {});
    captureOrigin().then(origin => logGameOrigin(gameCode, origin)).catch(() => {});

    // Add ghost players with random names
    const ghostNames = pickGhostNames(ghostSlots);
    for (const name of ghostNames) {
      await addPlayer(gameCode, name, true);
    }

    // Remember this device is the host for this code
    localStorage.setItem('bunco_host_code', gameCode);
    rememberActiveGame(gameCode);

    // Update URL so the code is visible/shareable, then show waiting room without a full reload.
    // A full redirect causes bfcache to restore the old setup-form DOM on some browsers.
    history.pushState(null, '', `game.html?code=${gameCode}&host=true`);
    showWaitingRoom(true);
    subscribeToGame();
  } catch (err) {
    console.error('Failed to create game:', err);
    showToast("The game wasn't created. Check your connection and try again.", 'warning');
    btn.disabled = false;
    btn.textContent = 'Create game';
  }
}

// ─── Player joins ─────────────────────────────────────────────

async function handleJoin() {
  const btn  = document.getElementById('join-btn');
  const name = document.getElementById('join-name').value.trim();
  if (!name) { showToast('Enter your name to join.', 'warning'); return; }

  btn.disabled = true;
  btn.textContent = 'Joining…';

  const game = await getGame(gameCode);
  if (!game) {
    showToast('No game uses that code. Check it with your host.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Join game';
    return;
  }

  if (isNameTaken(game.players || {}, name)) {
    showToast('Someone already has that name. Add an initial.', 'warning');
    btn.disabled = false;
    btn.textContent = 'Join game';
    return;
  }

  const playerId = await addPlayer(gameCode, name, false);
  logEvent(gameCode, EVENT.PLAYER_JOINED, { playerId, name }).catch(() => {});
  localStorage.setItem(`bunco_player_${gameCode}`, playerId);
  rememberActiveGame(gameCode);
  myPlayerId = playerId;

  const amHost = game.meta.hostDeviceId === deviceId;
  showWaitingRoom(amHost);
}

// ─── Waiting room ─────────────────────────────────────────────

function renderQrCode(code) {
  const el = document.getElementById('waiting-qr');
  if (!el || !code) return;
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
    if (!myPlayerId) {
      const joinSection = document.getElementById('host-join-player');
      if (joinSection) {
        joinSection.style.display = '';
        document.getElementById('host-join-btn').addEventListener('click', handleHostJoinAsPlayer);
      }
    }
  }
}

async function handleHostJoinAsPlayer() {
  const btn  = document.getElementById('host-join-btn');
  const name = document.getElementById('host-join-name').value.trim();
  if (!name) { showToast('Enter your name to join.', 'warning'); return; }

  btn.disabled = true;
  btn.textContent = 'Joining…';

  const playerId = await addPlayer(gameCode, name, false);
  logEvent(gameCode, EVENT.PLAYER_JOINED, { playerId, name }).catch(() => {});
  localStorage.setItem(`bunco_player_${gameCode}`, playerId);
  rememberActiveGame(gameCode);
  myPlayerId = playerId;

  document.getElementById('host-join-player').style.display = 'none';
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
      const existing = new Set([...list.querySelectorAll('.player-chip')].map(el => el.dataset.name));
      list.innerHTML = '';
      // Real people first; ghosts after, marked so nobody goes looking for them.
      const ordered = [...Object.values(players)].sort((a, b) => Number(!!a.isGhost) - Number(!!b.isGhost));
      ordered.forEach(p => {
        const chip = document.createElement('span');
        chip.className = 'player-chip' + (p.isGhost ? ' is-ghost' : '') + (existing.has(p.name) ? '' : ' chip-new');
        chip.dataset.name = p.name;
        chip.textContent = p.name;
        if (p.isGhost) {
          const tag = document.createElement('span');
          tag.className = 'chip-tag';
          tag.textContent = 'ghost';
          chip.append(' ', tag);
        }
        list.appendChild(chip);
      });
    }

    const startBtn = document.getElementById('start-round-btn');
    if (startBtn) startBtn.disabled = humanPlayers.length < totalSeats;
  }

  updateWaitingRoomSeat(data);

  if (isHost && data.rounds?.[1]?.assignments) {
    renderHostSeatLayout(data);
  }

  // Bunco is claimed independently per table: once my table has claimed,
  // relabel my device's button to show who claimed it and let a tap undo
  // it instead of opening the picker again, and close any open picker.
  // Other tables' claims don't affect me. Banner gets bunco flavor when
  // the call that triggered it (gameCalledBy, game-wide) was a bunco claim.
  const roundBuncos = data.rounds?.[data.meta.currentRound]?.bunco || {};
  const myTableBuncoClaim = roundBuncos[myTableId] || null;
  const buncoBtn = document.getElementById('bunco-btn');
  if (buncoBtn) {
    if (myTableBuncoClaim) {
      const claimant = data.players?.[myTableBuncoClaim.playerId]?.name || 'Someone';
      buncoBtn.textContent = `🎲 ${claimant} — Undo`;
      buncoBtn.dataset.claimed = 'true';
    } else {
      buncoBtn.textContent = '🎲 BUNCO!';
      buncoBtn.dataset.claimed = 'false';
    }
    buncoBtn.disabled = false;
  }
  if (myTableBuncoClaim) closeBuncoPicker();

  const banner = document.getElementById('game-called-banner');
  if (banner) {
    const calledByBunco = !!roundBuncos[data.meta.gameCalledBy];
    banner.textContent = calledByBunco
      ? '🎲 BUNCO! — finish your rolls and submit'
      : 'GAME CALLED — finish your roll';
    banner.classList.toggle('visible', !!data.meta.gameCalledBy);
  }

  // Game complete
  if (data.meta.currentRound === 7) {
    window.location.href = `standings.html?code=${gameCode}&final=true`;
    return;
  }

  const currentView = [...document.querySelectorAll('[data-view]')]
    .find(el => el.style.display !== 'none')?.id;

  const round  = data.meta.currentRound;
  if (round >= 1) {
    const tables  = data.rounds?.[round]?.tables || {};
    const allDone = allTablesSubmitted(tables, data.meta.tables);

    if (currentView === 'view-submitted') {
      renderSubmittedDots(tables, data.meta.tables);
    }

    if (allDone && betweenRoundsForRound !== round) {
      // All tables in — auto-navigate everyone to the between-rounds screen.
      betweenRoundsForRound = round;
      betweenRoundsJustTriggered = true;
      showBetweenRoundsView(data);
    } else if (!allDone && (currentView === 'view-waiting' || currentView === 'view-between-rounds')) {
      // A new round started while we're in a holding view — go to scoring
      navigateToScoring(data);
    }
  }
}

function renderSubmittedDots(tables, numTables) {
  const container = document.getElementById('submitted-table-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let t = 1; t <= numTables; t++) {
    const done = !!tables[t]?.submitted;
    const wrap = document.createElement('div');
    wrap.className = `table-progress ${done ? 'is-done' : ''}`;
    const dot = document.createElement('div');
    dot.className = `table-dot ${done ? 'submitted' : 'waiting'}`;
    const label = document.createElement('div');
    label.className = 'table-progress-label';
    label.textContent = `Table ${t}`;
    wrap.appendChild(dot);
    wrap.appendChild(label);
    container.appendChild(wrap);
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
  logEvent(gameCode, EVENT.SEATS_ASSIGNED, { round: 1 }).catch(() => {});
  showToast('Seats assigned randomly!', 'success');
}

async function handleStartRound() {
  if (!gameData.rounds || !gameData.rounds[1] || !gameData.rounds[1].assignments) {
    showToast('Assign seats first.', 'warning');
    return;
  }
  const numTables   = gameData.meta.tables;
  const assignments = gameData.rounds[1].assignments;
  const players     = gameData.players || {};
  await initializeRoundTables(gameCode, 1, numTables);
  for (const tableId of getGhostOnlyTableIds(assignments, players, numTables)) {
    await submitTableScore(gameCode, 1, tableId, 0, 0);
    logEvent(gameCode, EVENT.SCORE_SUBMITTED, { round: 1, tableId, usScore: 0, themScore: 0, ghost: true, auto: true }).catch(() => {});
  }
  await startRound(gameCode, 0, 1);
  logEvent(gameCode, EVENT.ROUND_STARTED, { round: 1 }).catch(() => {});
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
  betweenRoundsJustTriggered = false;
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
  // A picker left open from a round that just got submitted out from under
  // this device (e.g. a teammate submitted while we were still choosing)
  // must not survive into the new round's view with stale players/listeners.
  closeBuncoPicker();
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

  // Sides are the table's, shared by every phone at it; the labels are this
  // phone's, so each player sees their own team called "Your team".
  const mySide = assignments[myPlayerId]?.side;
  const sideLabel = side => !mySide ? (side === 'us' ? 'Us' : 'Them')
    : side === mySide ? 'Your team' : 'Opponents';
  for (const side of ['us', 'them']) {
    const half = document.getElementById(`sc-${side}`);
    half.querySelector('.half-team-label').textContent = sideLabel(side);
    half.querySelector('.side-add')?.setAttribute('aria-label', `Add a point for ${sideLabel(side).toLowerCase()}`);
    document.getElementById(`sc-${side}-dec`).setAttribute('aria-label', `Take a point from ${sideLabel(side).toLowerCase()}`);
  }

  const usNameEl = document.getElementById('sc-us-names');
  const themNameEl = document.getElementById('sc-them-names');
  if (usNameEl) usNameEl.textContent = usPlayers;
  if (themNameEl) themNameEl.textContent = themPlayers;

  attachScoringListeners(data.meta.currentRound);
}

function renderScores() {
  const usEl   = document.getElementById('sc-us-score');
  const themEl = document.getElementById('sc-them-score');

  if (usEl.textContent !== String(usScore)) {
    usEl.textContent = usScore;
    triggerScorePop(usEl);
  }
  if (themEl.textContent !== String(themScore)) {
    themEl.textContent = themScore;
    triggerScorePop(themEl);
  }

  renderTally(document.getElementById('sc-us-tally'), usScore);
  renderTally(document.getElementById('sc-them-tally'), themScore);
  document.getElementById('sc-us').classList.toggle('is-winning', usScore >= TARGET);
  document.getElementById('sc-them').classList.toggle('is-winning', themScore >= TARGET);
  document.getElementById('view-scoring').classList.toggle('has-started', usScore + themScore > 0);
}

function triggerScorePop(el) {
  el.classList.remove('score-pop');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('score-pop');
}

function attachScoringListeners(roundNumber) {
  const signal = scoringAbortController.signal;

  document.getElementById('sc-us').addEventListener('click', e => {
    if (e.target.closest('#sc-us-dec')) return;
    keepScreenAwake();
    incrementTableScore(gameCode, roundNumber, myTableId, 'us')
      .catch(() => showToast("That point didn't save. Check your connection.", 'warning'));
  }, { signal });
  document.getElementById('sc-them').addEventListener('click', e => {
    if (e.target.closest('#sc-them-dec')) return;
    keepScreenAwake();
    incrementTableScore(gameCode, roundNumber, myTableId, 'them')
      .catch(() => showToast("That point didn't save. Check your connection.", 'warning'));
  }, { signal });
  document.getElementById('sc-us-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'us')
      .catch(() => showToast("That point didn't save. Check your connection.", 'warning'));
  }, { signal });
  document.getElementById('sc-them-dec').addEventListener('click', e => {
    e.stopPropagation();
    decrementTableScore(gameCode, roundNumber, myTableId, 'them')
      .catch(() => showToast("That point didn't save. Check your connection.", 'warning'));
  }, { signal });
  document.getElementById('bunco-btn').addEventListener('click', e => {
    if (e.currentTarget.dataset.claimed === 'true') {
      handleUndoBunco(roundNumber);
    } else {
      openBuncoPicker(roundNumber);
    }
  }, { signal });
  document.getElementById('bunco-picker-cancel').addEventListener('click', closeBuncoPicker, { signal });
  document.getElementById('call-game-btn').addEventListener('click', () => handleCallGame(), { signal });
  document.getElementById('submit-scores-btn').addEventListener('click', () => handleSubmitScores(roundNumber), { signal });
}

function openBuncoPicker(roundNumber) {
  const players     = gameData?.players || {};
  const assignments = gameData?.rounds?.[roundNumber]?.assignments || {};
  const table = buildTableLayout(players, assignments, gameData.meta.tables)
    .find(t => t.tableId === myTableId);
  // Ghosts can't earn a Bunco: their three-of-a-kind just counts as points.
  const seated = table ? [...table.us, ...table.them].filter(p => !p.isGhost) : [];
  if (seated.length === 0) return;
  const hasGhost = table && [...table.us, ...table.them].some(p => p.isGhost);
  document.getElementById('bunco-picker-ghost-note').hidden = !hasGhost;

  const list = document.getElementById('bunco-picker-list');
  list.innerHTML = '';
  seated.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'bunco-picker-player';
    btn.textContent = p.name;
    btn.addEventListener('click', () => confirmBunco(roundNumber, p.id));
    list.appendChild(btn);
  });
  document.getElementById('bunco-picker').style.display = 'flex';
}

function closeBuncoPicker() {
  const picker = document.getElementById('bunco-picker');
  if (picker) picker.style.display = 'none';
  // Clear so stale buttons (with stale onclick listeners bound to a finished
  // round's roundNumber) can't survive into the next round's view. Harmless
  // here since openBuncoPicker rebuilds the list from scratch on every open.
  const list = document.getElementById('bunco-picker-list');
  if (list) list.innerHTML = '';
}

async function confirmBunco(roundNumber, playerId) {
  closeBuncoPicker();
  try {
    const won = await recordBunco(gameCode, roundNumber, playerId, myTableId);
    if (!won) {
      showToast('A bunco was already recorded this round.', 'warning');
      return;
    }
    // The round call rides in recordBunco's atomic post-claim update.
    window.playBuncoAnimation?.();
    logEvent(gameCode, EVENT.BUNCO_RECORDED, { round: roundNumber, playerId, tableId: myTableId }).catch(() => {});
    logEvent(gameCode, EVENT.GAME_CALLED, { tableId: myTableId, bunco: true }).catch(() => {});
  } catch (err) {
    if (err?.message === 'bunco-claim-sync-failed') {
      showToast('Bunco recorded, but calling the round failed — use Call Game if it doesn\'t appear.', 'warning');
    } else {
      showToast('Bunco not saved — check connection.', 'warning');
    }
  }
}

async function handleUndoBunco(roundNumber) {
  const btn = document.getElementById('bunco-btn');
  if (btn) btn.disabled = true;
  try {
    await undoBunco(gameCode, roundNumber, myTableId);
    logEvent(gameCode, EVENT.BUNCO_UNDONE, { round: roundNumber, tableId: myTableId }).catch(() => {});
    showToast('Bunco undone.', 'info');
  } catch (err) {
    showToast('Undo failed — check connection.', 'warning');
    if (btn) btn.disabled = false;
  }
}

async function handleCallGame() {
  await callGame(gameCode, myTableId);
  logEvent(gameCode, EVENT.GAME_CALLED, { tableId: myTableId }).catch(() => {});
  showToast('Game called! Other tables are finishing their rolls.', 'info');
}

async function handleSubmitScores(roundNumber) {
  await submitTableScore(gameCode, roundNumber, myTableId, usScore, themScore);
  logEvent(gameCode, EVENT.SCORE_SUBMITTED, { round: roundNumber, tableId: myTableId, usScore, themScore }).catch(() => {});
  document.getElementById('view-standings-link').href = `standings.html?code=${gameCode}`;
  // If Firebase's optimistic local write fired onGameUpdate → showBetweenRoundsView
  // before this line, skip showing view-submitted so we don't override the transition.
  if (betweenRoundsJustTriggered) {
    betweenRoundsJustTriggered = false;
    return;
  }
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
    const pillEl  = document.getElementById('join-live-count-pill');
    if (countEl) countEl.textContent = `${humanCount} of ${totalSeats} players joined`;
    if (pillEl)  pillEl.style.display = '';
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
            btn.className = 'btn-ink btn-block';
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
    if (!name) { showToast('Enter your name to join.', 'warning'); return; }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Joining…';
    try {
      if (!gameData) throw new Error('Game data unavailable');
      await claimGhostSeat(gameCode, pendingGhostId, name);
      logEvent(gameCode, EVENT.GHOST_CLAIMED, { playerId: pendingGhostId, name }).catch(() => {});
      localStorage.setItem(`bunco_player_${gameCode}`, pendingGhostId);
      rememberActiveGame(gameCode);
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

function showBetweenRoundsView(data) {
  const storedHostCode = localStorage.getItem('bunco_host_code');
  const amHost = storedHostCode === gameCode;

  // Host-only (spectator) devices are already redirected to standings by navigateToScoring
  if (!myPlayerId && amHost) {
    window.location.href = `standings.html?code=${gameCode}`;
    return;
  }

  const round      = data.meta.currentRound;
  const tables     = data.rounds?.[round]?.tables      || {};
  const assignments = data.rounds?.[round]?.assignments || {};
  const players    = data.players || {};
  const buncos     = data.rounds?.[round]?.buncos       || {};
  const numTables  = data.meta.tables;

  const roundResults = roundWinners(tables, assignments, buncos, numTables);

  const newStandings = updateStandings(data.standings || {}, tables, roundResults, assignments, buncos);

  // Header
  document.getElementById('br-round-title').textContent =
    round === 6 ? 'That was round 6!' : `Round ${round} is done`;

  // Standings list
  const standingsList = document.getElementById('br-standings-list');
  if (standingsList) {
    const rows = Object.entries(players)
      .filter(([, p]) => !p.isGhost)
      .map(([id, p]) => {
        const s = newStandings[id] || { wins: 0, losses: 0, buncos: 0, totalPoints: 0 };
        return { name: p.name, wins: s.wins, losses: s.losses, buncos: s.buncos, points: s.totalPoints };
      })
      .sort((a, b) => b.wins - a.wins || b.buncos - a.buncos || b.points - a.points);

    standingsList.innerHTML = rows.map((r, i) => `
      <div class="mini-standing${i === 0 ? ' is-leader' : ''}">
        <span class="mini-rank">${i + 1}</span>
        <span class="mini-name">${esc(r.name)}</span>
        <span class="mini-wins">${r.wins}W</span>
        <span class="mini-losses">${r.losses}L</span>
        <span class="mini-buncos">${r.buncos > 0 ? `🎲${r.buncos}` : ''}</span>
      </div>
    `).join('');
  }

  // Next seat (rounds 1–5 only)
  const nextSeatEl = document.getElementById('br-next-seat');
  if (nextSeatEl) {
    if (round < 6 && myPlayerId) {
      const nextAssignments = data.rounds?.[round + 1]?.assignments ||
        calculateNextRoundSeating(assignments, roundResults, numTables);
      const myNext = nextAssignments[myPlayerId];
      if (myNext) {
        document.getElementById('br-next-table').textContent = `Table ${myNext.tableId}`;
        const teammate = Object.entries(nextAssignments).find(([id, a]) =>
          id !== myPlayerId && a.tableId === myNext.tableId && a.side === myNext.side
        );
        const opponents = Object.entries(nextAssignments).filter(([, a]) =>
          a.tableId === myNext.tableId && a.side !== myNext.side
        );
        document.getElementById('br-next-teammate').textContent =
          teammate ? (players[teammate[0]]?.name || '—') : '—';
        document.getElementById('br-next-opponents').textContent =
          opponents.map(([id]) => players[id]?.name).filter(Boolean).join(' & ') || '—';
        nextSeatEl.style.display = '';
      } else {
        nextSeatEl.style.display = 'none';
      }
    } else {
      nextSeatEl.style.display = 'none';
    }
  }

  // Host button / non-host waiting message
  const startBtn = document.getElementById('br-start-next-btn');
  const waitMsg  = document.getElementById('br-waiting-msg');
  if (startBtn) {
    startBtn.style.display = amHost ? '' : 'none';
    startBtn.textContent   = round === 6 ? 'See final standings' : `Start round ${round + 1}`;
    startBtn.disabled      = false;
  }
  if (waitMsg) {
    waitMsg.style.display = amHost ? 'none' : '';
    waitMsg.textContent = round === 6
      ? 'The host will open the final standings.'
      : 'The host will start the next round.';
  }

  const brLink = document.getElementById('br-standings-link');
  if (brLink) {
    brLink.href = `standings.html?code=${gameCode}`;
    brLink.style.display = amHost && round === 6 ? 'none' : '';
  }

  showView('view-between-rounds');

  // Host preps next round — disable button until prep completes so the host
  // can't start the next round before assignments and tables are written.
  if (amHost && betweenRoundsPrepForRound !== round) {
    betweenRoundsPrepForRound = round;
    if (startBtn && round < 6) {
      startBtn.disabled    = true;
      startBtn.textContent = 'Preparing…';
    }
    prepareNextRound(round, tables, assignments, buncos, players, numTables, newStandings)
      .then(() => {
        if (startBtn && round < 6) {
          startBtn.textContent = `Start round ${round + 1}`;
          startBtn.disabled    = false;
        }
      })
      .catch(err => {
        console.error('Failed to prep next round:', err);
        betweenRoundsPrepForRound = 0;
        if (startBtn && round < 6) {
          startBtn.textContent = `Start round ${round + 1}`;
          startBtn.disabled    = false;
        }
        showToast('Failed to prepare next round — please try again.', 'warning');
      });
  }
}

async function prepareNextRound(round, tables, assignments, buncos, players, numTables, newStandings) {
  await saveStandings(gameCode, newStandings);
  logEvent(gameCode, EVENT.STANDINGS_SAVED, { round, source: 'game' }).catch(() => {});
  if (round >= 6) return;

  const roundResults = roundWinners(tables, assignments, buncos, numTables);

  const nextAssignments = calculateNextRoundSeating(assignments, roundResults, numTables);
  await saveRoundAssignments(gameCode, round + 1, nextAssignments);
  logEvent(gameCode, EVENT.SEATS_ASSIGNED, { round: round + 1 }).catch(() => {});
  await initializeRoundTables(gameCode, round + 1, numTables);
  for (const tableId of getGhostOnlyTableIds(nextAssignments, players, numTables)) {
    await submitTableScore(gameCode, round + 1, tableId, 0, 0);
    logEvent(gameCode, EVENT.SCORE_SUBMITTED, { round: round + 1, tableId, usScore: 0, themScore: 0, ghost: true, auto: true }).catch(() => {});
  }
}

document.getElementById('br-start-next-btn')?.addEventListener('click', async (e) => {
  const btn   = e.currentTarget;
  const round = gameData?.meta?.currentRound;
  if (!round) return;

  btn.disabled = true;

  if (round >= 6) {
    try {
      await startRound(gameCode, round, 7);
      logEvent(gameCode, EVENT.GAME_ENDED).catch(() => {});
    } catch {
      showToast('Error finishing game — please try again.', 'warning');
      btn.disabled = false;
    }
    return;
  }

  btn.textContent = 'Starting…';
  try {
    await startRound(gameCode, round, round + 1);
    logEvent(gameCode, EVENT.ROUND_STARTED, { round: round + 1 }).catch(() => {});
  } catch {
    showToast('Error starting round — please try again.', 'warning');
    btn.disabled = false;
    btn.textContent = `Start round ${round + 1}`;
  }
});
