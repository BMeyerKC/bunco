import { ensureAdminAccess } from './admin-gate.js';
import { getRecentGames, getOriginAudits, getFeedback } from './firebase.js';
import { buildGameRows } from './game-logic.js';

const DAY_MS = 24 * 60 * 60 * 1000;

init();

async function init() {
  await ensureAdminAccess();
  wireDebugJump();
  await Promise.allSettled([loadGames(), loadFeedback()]);
}

function wireDebugJump() {
  const form    = document.getElementById('debug-jump');
  const input   = document.getElementById('debug-code-input');
  const errorEl = document.getElementById('debug-code-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      errorEl.textContent = 'Enter a 4-character game code.';
      return;
    }
    errorEl.textContent = '';
    window.location.href = `debug.html?code=${code}`;
  });
}

async function loadGames() {
  const listEl = document.getElementById('games-list');
  try {
    const games = await getRecentGames(25);
    const origins = await getOriginAudits().catch(err => {
      console.error('[admin] failed to load origin audits', err);
      return {};
    });
    const rows = buildGameRows(games, origins);
    renderStats(rows);
    renderGames(rows, listEl);
  } catch (err) {
    console.error('[admin] failed to load games', err);
    listEl.innerHTML =
      '<p style="color:#dc2626;">Couldn’t load games. ' +
      '<button id="games-retry" class="btn btn-sm btn-outline-secondary ms-2">Retry</button></p>';
    document.getElementById('games-retry').addEventListener('click', loadGames);
  }
}

function renderStats(rows) {
  const now = Date.now();
  const active = rows.filter(r => r.status !== 'Ended' && now - r.createdAt < DAY_MS).length;
  document.getElementById('stat-active').textContent = String(active);
  document.getElementById('stat-recent').textContent = String(rows.length);
}

function renderGames(rows, listEl) {
  if (rows.length === 0) {
    listEl.innerHTML = '<p style="color:var(--very-muted);">No games yet.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table table-dark table-sm align-middle';
  table.innerHTML =
    '<thead><tr>' +
    '<th>Code</th><th>Created</th><th>Status</th><th>Players</th><th>Location</th><th></th>' +
    '</tr></thead>';

  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');

    const codeTd = document.createElement('td');
    codeTd.style.cssText = 'font-family:monospace;letter-spacing:0.1em;';
    codeTd.textContent = row.code;

    const createdTd = document.createElement('td');
    createdTd.style.cssText = 'font-size:var(--fs-small);color:var(--muted);';
    createdTd.textContent = row.createdAt ? new Date(row.createdAt).toLocaleString() : '—';

    const statusTd = document.createElement('td');
    statusTd.textContent = row.status;

    const playersTd = document.createElement('td');
    playersTd.textContent = String(row.playerCount);

    const locationTd = document.createElement('td');
    locationTd.style.cssText = 'font-size:var(--fs-small);color:var(--muted);';
    locationTd.textContent = row.location || '—';

    const linksTd = document.createElement('td');
    linksTd.className = 'text-end';
    const debugLink = document.createElement('a');
    debugLink.href = `debug.html?code=${encodeURIComponent(row.code)}`;
    debugLink.className = 'btn btn-sm btn-outline-secondary me-1';
    debugLink.textContent = 'Debug';
    const standingsLink = document.createElement('a');
    standingsLink.href = `standings.html?code=${encodeURIComponent(row.code)}`;
    standingsLink.className = 'btn btn-sm btn-outline-secondary';
    standingsLink.textContent = 'Standings';
    linksTd.append(debugLink, standingsLink);

    tr.append(codeTd, createdTd, statusTd, playersTd, locationTd, linksTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  listEl.innerHTML = '';
  listEl.appendChild(table);
}

async function loadFeedback() {
  const listEl = document.getElementById('feedback-list');
  try {
    const items = await getFeedback(50);
    renderFeedback(items, listEl);
  } catch (err) {
    console.error('[admin] failed to load feedback', err);
    listEl.innerHTML =
      '<p style="color:#dc2626;">Couldn’t load feedback. ' +
      '<button id="feedback-retry" class="btn btn-sm btn-outline-secondary ms-2">Retry</button></p>';
    document.getElementById('feedback-retry').addEventListener('click', loadFeedback);
  }
}

function renderFeedback(items, listEl) {
  listEl.innerHTML = '';

  if (items.length === 0) {
    listEl.innerHTML = '<p style="color:var(--very-muted);">No feedback yet.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.style.cssText =
      'background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
      'padding:12px 16px;margin-bottom:10px;';

    const meta = document.createElement('div');
    meta.style.cssText =
      'font-size:var(--fs-caption);color:var(--very-muted);margin-bottom:6px;' +
      'display:flex;flex-wrap:wrap;gap:10px;';

    const when = document.createElement('span');
    when.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '—';

    const where = document.createElement('span');
    where.textContent = item.code ? `${item.page || '—'} · ${item.code}` : (item.page || '—');

    const ver = document.createElement('span');
    ver.textContent = `v${item.version || '?'} · ${item.theme || '?'}`;

    meta.append(when, where, ver);

    // Contact lives in the write-only feedbackContacts/ node, which this
    // page cannot read by design — so it cannot know whether one exists.
    // Surface the id instead; it is the console lookup key.
    const idEl = document.createElement('span');
    idEl.style.cssText = 'font-family:monospace;';
    idEl.textContent = item.id;
    meta.appendChild(idEl);

    const body = document.createElement('p');
    body.style.cssText = 'margin:0;color:var(--text);white-space:pre-wrap;';
    body.textContent = item.message || '';

    card.append(meta, body);
    listEl.appendChild(card);
  }
}
