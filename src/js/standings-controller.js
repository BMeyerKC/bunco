import { watchGame, watchAllTableScores, submitTableScore, startRound, getRoundAssignments, saveStandings, saveRoundAssignments, EVENT, logEvent } from './firebase.js';
import { getParam, getDeviceId } from './ui.js';
import { buildTableLayout, calculateNextRoundSeating, determineWinner, updateStandings } from './game-logic.js';
import { renderTableCards } from './table-cards.js';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const code    = getParam('code');
const isFinal = getParam('final') === 'true';
const deviceId = getDeviceId();
let isHost = false;

if (!code) {
  document.getElementById('no-code-section').style.display  = '';
  document.getElementById('standings-section').style.display = 'none';
  document.getElementById('code-form').addEventListener('submit', e => {
    e.preventDefault();
    const val = document.getElementById('code-input').value.trim().toUpperCase();
    if (val.length === 4) window.location.href = `standings.html?code=${val}`;
  });
} else {
  if (isFinal) {
    document.getElementById('standings-title').textContent = 'Final Standings';
    document.getElementById('ad-slot').style.display = '';
  }

  let tableScoreUnsub = null;
  let watchedRound    = 0;
  let latestTables    = [];
  let isAdvancing     = false;
  let latestData      = null;

  const unwatchGame = watchGame(code, data => {
    if (!data) return;
    latestData = data;

    // Detect if this device is the host
    isHost = data.meta?.hostDeviceId === deviceId;
    const leaveBtn = document.getElementById('leave-game-btn');
    if (isHost && leaveBtn && !leaveBtn.dataset.listenerAdded) {
      leaveBtn.style.display = '';
      leaveBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
      leaveBtn.dataset.listenerAdded = 'true';
    }

    const round = data.meta?.currentRound || 0;

    document.getElementById('round-indicator').textContent =
      isFinal || round >= 7 ? 'Game complete!'
      : round === 0         ? 'Waiting for Round 1…'
      :                       `Round ${round} of 6 — Live`;

    // Live table cards
    const tableCardsEl = document.getElementById('table-cards');
    if (data.rounds?.[1]?.assignments && tableCardsEl) {
      latestTables = buildTableLayout(data.players || {}, data.rounds[1].assignments, data.meta.tables);

      if (round >= 1 && round !== watchedRound) {
        if (tableScoreUnsub) tableScoreUnsub();
        watchedRound    = round;
        tableScoreUnsub = watchAllTableScores(code, round, scores => {
          renderTableCards(tableCardsEl, latestTables, scores);
        });
      } else if (round === 0) {
        renderTableCards(tableCardsEl, latestTables, {});
      }
    }

    // Cumulative standings table
    const players   = data.players   || {};
    const standings = data.standings || {};
    const roundBuncos = round >= 1 && round <= 6 ? (data.rounds?.[round]?.buncos || {}) : {};

    const rows = Object.entries(players)
      .filter(([, p]) => !p.isGhost)
      .map(([id, p]) => ({
        name:   p.name,
        wins:   standings[id]?.wins        || 0,
        losses: standings[id]?.losses      || 0,
        buncos: (standings[id]?.buncos || 0) + (roundBuncos[id] || 0),
        points: standings[id]?.totalPoints || 0,
      }))
      .sort((a, b) => b.wins - a.wins || b.buncos - a.buncos || b.points - a.points);

    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = rows.map((r, i) => `
      <div class="standings-row ${i === 0 ? 'standings-row-first' : ''}">
        <span class="standings-rank ${i === 0 ? 'standings-rank-1' : ''}">${i + 1}</span>
        <span class="standings-name">${esc(r.name)}${i === 0 && isFinal ? ' 🏆' : ''}</span>
        <span class="standings-stat standings-stat-highlight">${r.wins}</span>
        <span class="standings-stat" style="margin:0 4px;">${r.losses}</span>
        <span class="standings-stat ${r.buncos > 0 ? 'standings-stat-highlight' : ''}" style="min-width:36px;">${r.buncos > 0 ? '🎲 ' + r.buncos : r.buncos}</span>
        <span class="standings-stat" style="min-width:40px;">${r.points}</span>
      </div>
    `).join('');

    // Show ghost table scoring for host during active rounds
    if (isHost && data.meta.currentRound >= 1 && data.meta.currentRound <= 6) {
      renderGhostTableScoring(data);
      checkAndShowAdvanceButton(data);
    } else {
      document.getElementById('ghost-scoring-section').style.display = 'none';
      document.getElementById('advance-round-section').style.display = 'none';
    }
  });

  function checkAndShowAdvanceButton(data) {
    const round = data.meta.currentRound;
    const tables = data.rounds?.[round]?.tables || {};
    const numTables = data.meta.tables;

    // Check if all tables submitted
    let allSubmitted = true;
    for (let t = 1; t <= numTables; t++) {
      if (!tables[t]?.submitted) {
        allSubmitted = false;
        break;
      }
    }

    const section = document.getElementById('advance-round-section');
    if (!allSubmitted) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    const btn = document.getElementById('advance-round-btn');
    if (!isAdvancing) {
      btn.textContent = advanceButtonLabel(round);
      btn.disabled = false;
    }
    if (!btn.dataset.listenerAdded) {
      btn.addEventListener('click', () => {
        // The listener outlives this render — always act on the latest
        // snapshot, never the data/round captured when it was attached.
        const current = latestData;
        if (!current) return;
        const currentRound = current.meta.currentRound;
        btn.disabled = true;
        btn.textContent = currentRound >= 6 ? 'Finishing…' : 'Starting…';
        checkAndAdvanceRound(code, current, currentRound).catch(err => {
          console.error('Error advancing round:', err);
          btn.disabled = false;
          btn.textContent = advanceButtonLabel(currentRound);
        });
      });
      btn.dataset.listenerAdded = 'true';
    }
  }

  function advanceButtonLabel(round) {
    return round >= 6 ? 'View Final Standings' : `Start Round ${round + 1}`;
  }

  async function checkAndAdvanceRound(code, data, roundNumber) {
    const tables = data.rounds?.[roundNumber]?.tables || {};
    const numTables = data.meta.tables;

    // Wait until all tables have submitted
    for (let t = 1; t <= numTables; t++) {
      if (!tables[t]?.submitted) return;
    }

    // Prevent concurrent advancement
    if (isAdvancing) return;
    isAdvancing = true;

    // All tables submitted — advance round
    try {
      const roundResults = {};
      for (let t = 1; t <= numTables; t++) {
        const { usScore, themScore } = tables[t];
        roundResults[t] = { winner: determineWinner(usScore, themScore) };
      }

      // Update standings
      const assignments = await getRoundAssignments(code, roundNumber);
      const buncos = data.rounds?.[roundNumber]?.buncos || {};
      const current = data.standings || {};
      const next = updateStandings(current, tables, roundResults, assignments, buncos);
      await saveStandings(code, next);
      logEvent(code, EVENT.STANDINGS_SAVED, { round: roundNumber, source: 'standings' }).catch(() => {});

      if (roundNumber >= 6) {
        const ended = await startRound(code, roundNumber, 7);
        if (ended) logEvent(code, EVENT.GAME_ENDED).catch(() => {});
        return;
      }

      // Calculate next round seating and advance
      const nextAssignments = calculateNextRoundSeating(assignments, roundResults, numTables);
      await saveRoundAssignments(code, roundNumber + 1, nextAssignments);
      logEvent(code, EVENT.SEATS_ASSIGNED, { round: roundNumber + 1 }).catch(() => {});
      const advanced = await startRound(code, roundNumber, roundNumber + 1);
      if (advanced) logEvent(code, EVENT.ROUND_STARTED, { round: roundNumber + 1 }).catch(() => {});
    } finally {
      isAdvancing = false;
    }
  }

  function renderGhostTableScoring(data) {
    const round = data.meta.currentRound;
    const assignments = data.rounds?.[round]?.assignments || {};
    const players = data.players || {};
    const numTables = data.meta.tables;

    const ghostTables = [];
    for (let t = 1; t <= numTables; t++) {
      const tableAssignments = Object.entries(assignments).filter(([, a]) => a.tableId === t);
      const allGhosts = tableAssignments.every(([id]) => players[id]?.isGhost);
      if (allGhosts && tableAssignments.length > 0) {
        ghostTables.push({
          tableId: t,
          players: tableAssignments.map(([, a]) => a).reduce((acc, a) => {
            if (!acc[a.side]) acc[a.side] = [];
            acc[a.side].push(a);
            return acc;
          }, {})
        });
      }
    }

    const section = document.getElementById('ghost-scoring-section');
    const list = document.getElementById('ghost-tables-list');

    if (ghostTables.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    list.innerHTML = ghostTables.map(table => `
      <div class="card mb-3">
        <div class="card-body p-3">
          <h5 class="card-title mb-3">Table ${table.tableId}</h5>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div style="text-align:center;">
              <div class="label-upper mb-2">Us</div>
              <input type="number" class="form-control text-center"
                     data-table="${table.tableId}" data-side="us" value="0" min="0" max="99" />
            </div>
            <div style="text-align:center;">
              <div class="label-upper mb-2">Them</div>
              <input type="number" class="form-control text-center"
                     data-table="${table.tableId}" data-side="them" value="0" min="0" max="99" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm w-100 mt-3" data-table="${table.tableId}">Submit</button>
        </div>
      </div>
    `).join('');

    // Attach submit handlers
    document.querySelectorAll('[data-table]').forEach(input => {
      if (input.tagName !== 'BUTTON') return;
      input.addEventListener('click', async () => {
        const tableId = parseInt(input.dataset.table);
        const usScore = parseInt(document.querySelector(`input[data-table="${tableId}"][data-side="us"]`).value) || 0;
        const themScore = parseInt(document.querySelector(`input[data-table="${tableId}"][data-side="them"]`).value) || 0;
        input.textContent = 'Submitting…';
        input.disabled = true;
        try {
          await submitTableScore(code, round, tableId, usScore, themScore);
          logEvent(code, EVENT.SCORE_SUBMITTED, { round, tableId, usScore, themScore, ghost: true }).catch(() => {});
        } catch (err) {
          console.error('Failed to submit ghost table score:', err);
          input.textContent = 'Submit';
          input.disabled = false;
        }
      });
    });
  }

  window.addEventListener('pagehide', () => {
    unwatchGame();
    if (tableScoreUnsub) tableScoreUnsub();
  });
}
