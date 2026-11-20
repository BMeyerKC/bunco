import { ensureAdminAccess } from './admin-gate.js';
import { getRecentGames, getOriginAudits, getFeedback, getQuickScorerSessions } from './firebase.js';
import { buildGameRows } from './game-logic.js';
import { buildQuickScorerRows } from './quick-scorer-logic.js';
import { DAY_MS, dailyCounts, periodCounts, median, topPlaces, startOfDay, visibleRecords } from './admin-stats.js';

// shortcut: dashboard stats come from the newest N records, not a date query;
// when a limit is hit the charts mark the days they can't vouch for. Switch to
// a startAt(since) query if a busy fortnight regularly exceeds these.
const GAME_LIMIT     = 100;
const SESSION_LIMIT  = 500;
const FEEDBACK_LIMIT = 50;
const CHART_DAYS     = 14;
const KPI_DAYS       = 7;
const ROWS_SHOWN     = 12;
const FEEDBACK_SHOWN = 5;
const SESSION_BAR_MIN = 60;

// Raw records as fetched. undefined = still loading, null = failed to load.
const state = { games: undefined, origins: {}, sessions: undefined, feedback: undefined, includeTest: false };

const shown = records => visibleRecords(records, state.includeTest);

init();

async function init() {
  await ensureAdminAccess();
  wireDebugJump();
  wireTestToggle();
  await Promise.allSettled([loadGames(), loadQuickScorerSessions(), loadFeedback()]);
}

function wireTestToggle() {
  document.getElementById('include-test').addEventListener('change', (e) => {
    state.includeTest = e.target.checked;
    renderAll();
  });
}

function renderAll() {
  if (state.games) renderGames(buildGameRows(shown(state.games), state.origins), document.getElementById('games-list'));
  if (state.sessions) renderQuickScorerSessions(buildQuickScorerRows(shown(state.sessions)), document.getElementById('quick-scorer-list'));
  if (state.feedback) renderFeedback(shown(state.feedback), document.getElementById('feedback-list'));
  renderOverview();
  const hidden = [state.games, state.sessions, state.feedback]
    .reduce((n, list) => n + (list ? list.length - visibleRecords(list, false).length : 0), 0);
  document.getElementById('test-count').textContent = hidden ? String(hidden) : '';
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

// ─── Loading ──────────────────────────────────────────────────

async function loadGames() {
  const listEl = document.getElementById('games-list');
  try {
    const games = await getRecentGames(GAME_LIMIT);
    state.origins = await getOriginAudits().catch(err => {
      console.error('[admin] failed to load origin audits', err);
      return {};
    });
    state.games = games;
  } catch (err) {
    console.error('[admin] failed to load games', err);
    state.games = null;
    showLoadError(listEl, 'games', loadGames);
  }
  renderAll();
}

async function loadQuickScorerSessions() {
  const listEl = document.getElementById('quick-scorer-list');
  try {
    state.sessions = await getQuickScorerSessions(SESSION_LIMIT);
  } catch (err) {
    console.error('[admin] failed to load quick scorer sessions', err);
    state.sessions = null;
    showLoadError(listEl, 'quick scorer sessions', loadQuickScorerSessions);
  }
  renderAll();
}

async function loadFeedback() {
  const listEl = document.getElementById('feedback-list');
  try {
    state.feedback = await getFeedback(FEEDBACK_LIMIT);
  } catch (err) {
    console.error('[admin] failed to load feedback', err);
    state.feedback = null;
    showLoadError(listEl, 'feedback', loadFeedback);
  }
  renderAll();
}

function showLoadError(el, what, retry) {
  el.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'tool-error';
  p.textContent = `Couldn’t load ${what}. `;
  const btn = document.createElement('button');
  btn.className = 'btn-quiet btn-sm';
  btn.textContent = 'Retry';
  btn.addEventListener('click', () => {
    el.innerHTML = '<p class="dash-empty">Loading…</p>';
    retry();
  });
  p.appendChild(btn);
  el.appendChild(p);
}

// ─── Overview: stats, charts, places ─────────────────────────

/**
 * Oldest moment the loaded records fully cover. If a fetch came back at its
 * limit, anything older than its oldest record may be missing. Takes every
 * fetched record's timestamp, test data included, since that's what the limit counted.
 */
function coveredSince(stamps, limit) {
  const known = stamps.filter(Boolean);
  return stamps.length < limit || known.length === 0 ? 0 : Math.min(...known);
}

function renderOverview() {
  const now = Date.now();
  const games    = state.games && buildGameRows(shown(state.games), state.origins);
  const sessions = state.sessions && buildQuickScorerRows(shown(state.sessions));

  if (games) {
    const since = coveredSince(state.games.map(g => g.meta?.createdAt), GAME_LIMIT);
    const stamps = games.map(r => r.createdAt);
    renderKpi('games', periodCounts(stamps, KPI_DAYS, now), since, now);

    const playerStamps = games.flatMap(r => Array(r.playerCount).fill(r.createdAt));
    renderKpi('players', periodCounts(playerStamps, KPI_DAYS, now), since, now);

    const active = games.filter(r => r.status !== 'Ended' && now - r.createdAt < DAY_MS).length;
    document.getElementById('stat-active').textContent = String(active);

    renderDayChart(document.getElementById('chart-games'),
      dailyCounts(stamps, CHART_DAYS, now), since, ['full game', 'full games']);
    document.getElementById('nav-games').textContent = String(games.length);
  } else if (games === null) {
    chartError('chart-games');
  }

  if (sessions) {
    const since = coveredSince(state.sessions.map(s => s.startedAt), SESSION_LIMIT);
    const stamps = sessions.map(r => r.startedAt);
    renderKpi('sessions', periodCounts(stamps, KPI_DAYS, now), since, now);

    const recent = sessions.filter(r => now - r.startedAt < KPI_DAYS * DAY_MS);
    const typical = median(recent.map(r => r.durationMs));
    document.getElementById('stat-duration').textContent =
      typical == null ? '—' : formatMinutes(typical);

    renderDayChart(document.getElementById('chart-sessions'),
      dailyCounts(stamps, CHART_DAYS, now), since, ['quick session', 'quick sessions']);
    document.getElementById('nav-sessions').textContent = String(sessions.length);
  } else if (sessions === null) {
    chartError('chart-sessions');
  }

  if (games !== undefined && sessions !== undefined) {
    renderPlaces(topPlaces(games || [], sessions || [], 8), document.getElementById('places-list'));
  }
}

function renderKpi(name, { current, previous }, coveredFrom, now) {
  document.getElementById(`stat-${name}`).textContent = current.toLocaleString();
  const deltaEl = document.getElementById(`stat-${name}-delta`);
  if (coveredFrom > now - 2 * KPI_DAYS * DAY_MS) {
    deltaEl.textContent = 'Week before not fully loaded';
    return;
  }
  deltaEl.textContent = `vs ${previous.toLocaleString()} the week before`;
}

function chartError(id) {
  document.getElementById(id).innerHTML = '<p class="tool-error">Couldn’t load this chart.</p>';
}

/** Smallest "round" axis top ≥ n whose half is a whole number (1, 2, 4, 6, 8, 10, 12, 16, 20, 30…). */
function niceCeil(n) {
  for (const small of [1, 2, 4, 6, 8]) if (small >= n) return small;
  for (let mag = 10; ; mag *= 10) {
    for (const step of [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8]) {
      const top = Math.round(step * mag);
      if (top >= n) return top;
    }
  }
}

const dayFmt  = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const shortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/**
 * Column chart of per-day counts, built as HTML so its text stays at the
 * page's size. Each day is a focusable list item with a hover/focus tooltip.
 */
function renderDayChart(el, buckets, coveredFrom, [one, many]) {
  const max = Math.max(...buckets.map(b => b.count));
  const top = niceCeil(max);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const today = startOfDay(Date.now());
  const partialBefore = coveredFrom ? startOfDay(coveredFrom) : 0;
  const peakIndex = max > 0 ? buckets.findIndex(b => b.count === max) : -1;

  const wrap = document.createElement('div');
  wrap.className = 'dc';

  const summary = document.createElement('p');
  summary.className = 'dc-summary';
  summary.textContent =
    `${total.toLocaleString()} ${total === 1 ? one : many} · ` +
    `${shortFmt.format(buckets[0].start)} – ${shortFmt.format(buckets[buckets.length - 1].start)}`;

  const plot = document.createElement('div');
  plot.className = 'dc-plot';

  const axis = document.createElement('div');
  axis.className = 'dc-axis';
  axis.setAttribute('aria-hidden', 'true');
  axis.innerHTML = `<span>${top}</span><span>${top / 2 === Math.round(top / 2) ? top / 2 : ''}</span><span>0</span>`;

  const cols = document.createElement('ol');
  cols.className = 'dc-cols';
  cols.setAttribute('aria-label', `${many} per day`);

  buckets.forEach((b, i) => {
    const partial = b.start < partialBefore;
    const label = `${dayFmt.format(b.start)}: ${b.count} ${b.count === 1 ? one : many}` +
      (partial ? ' (incomplete, older records not loaded)' : '');

    const li = document.createElement('li');
    li.className = 'dc-col';
    if (b.start === today) li.classList.add('is-today');
    if (partial) li.classList.add('is-partial');
    li.tabIndex = 0;
    li.setAttribute('aria-label', label);
    li.style.setProperty('--h', `${(b.count / top) * 100}%`);

    const bar = document.createElement('span');
    bar.className = 'dc-bar';
    if (i === peakIndex) {
      const v = document.createElement('span');
      v.className = 'dc-value';
      v.textContent = String(b.count);
      bar.appendChild(v);
    }

    const tip = document.createElement('span');
    tip.className = 'dc-tip';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = label.replace(': ', ' · ');

    const day = document.createElement('span');
    day.className = 'dc-day';
    day.setAttribute('aria-hidden', 'true');
    day.textContent = new Date(b.start).getDate();

    li.append(bar, tip, day);
    cols.appendChild(li);
  });

  plot.append(axis, cols);
  wrap.append(summary, plot);
  if (partialBefore > buckets[0].start) {
    const note = document.createElement('p');
    note.className = 'dc-note';
    note.textContent = `Only the newest records are loaded, so days before ${shortFmt.format(partialBefore)} may be undercounted.`;
    wrap.appendChild(note);
  }

  el.innerHTML = '';
  el.appendChild(wrap);
}

function renderPlaces(places, el) {
  el.innerHTML = '';
  if (places.length === 0) {
    el.innerHTML = '<p class="dash-empty">No locations recorded yet.</p>';
    return;
  }
  const max = places[0].total;
  const list = document.createElement('ol');
  list.className = 'places';
  for (const p of places) {
    const li = document.createElement('li');
    li.className = 'place';

    const name = document.createElement('span');
    name.className = 'place-name';
    name.textContent = p.place;

    const counts = document.createElement('span');
    counts.className = 'place-counts';
    counts.textContent = [
      p.games && `${p.games} ${p.games === 1 ? 'game' : 'games'}`,
      p.sessions && `${p.sessions} quick`,
    ].filter(Boolean).join(' · ');

    const meter = document.createElement('span');
    meter.className = 'meter';
    meter.setAttribute('aria-hidden', 'true');
    meter.style.setProperty('--w', `${(p.total / max) * 100}%`);

    li.append(name, counts, meter);
    list.appendChild(li);
  }
  el.appendChild(list);
}

// ─── Lists ────────────────────────────────────────────────────

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** "5 min ago", "3 hours ago", "Yesterday, 7:42 PM", "Mon, Nov 17, 7:42 PM". */
function when(ts) {
  if (!ts) return '—';
  const age = Date.now() - ts;
  if (age < 60_000) return 'Just now';
  if (age < 60 * 60_000) return rtf.format(-Math.round(age / 60_000), 'minute');
  if (age < 6 * 60 * 60_000) return rtf.format(-Math.round(age / 3_600_000), 'hour');
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS);
  const dayPart = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : dayFmt.format(ts);
  return `${dayPart}, ${timeFmt.format(ts)}`;
}

function whenCell(ts) {
  const td = document.createElement('td');
  td.className = 'cell-when';
  if (ts) {
    const t = document.createElement('time');
    t.dateTime = new Date(ts).toISOString();
    t.title = new Date(ts).toLocaleString();
    t.textContent = when(ts);
    td.appendChild(t);
  } else {
    td.textContent = '—';
  }
  return td;
}

function textCell(text, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

/** Table with a header row; rows past ROWS_SHOWN hide behind a "Show all" button. */
function collapsibleTable(headers, rows, listEl, noun) {
  const table = document.createElement('table');
  table.className = 'data-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.scope = 'col';
    if (typeof h === 'string') th.textContent = h;
    else if (h.srOnly) th.setAttribute('aria-label', h.text);
    else { th.className = h.className; th.textContent = h.text; }
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  const tbody = document.createElement('tbody');
  rows.forEach((tr, i) => {
    if (i >= ROWS_SHOWN) tr.hidden = true;
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);

  listEl.innerHTML = '';
  listEl.appendChild(table);

  if (rows.length > ROWS_SHOWN) {
    const more = document.createElement('button');
    more.className = 'btn-quiet btn-sm dash-more';
    more.textContent = `Show all ${rows.length} ${noun}`;
    more.addEventListener('click', () => {
      rows.forEach(tr => { tr.hidden = false; });
      more.remove();
    });
    listEl.appendChild(more);
  }
}

function progressCell(row, idle) {
  const td = document.createElement('td');
  td.className = 'cell-progress';
  const ended = row.status === 'Ended';
  const inRound = row.round >= 1 && row.round <= 6 && !ended;

  const pips = document.createElement('span');
  pips.className = 'pips';
  pips.setAttribute('aria-hidden', 'true');
  for (let n = 1; n <= 6; n++) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    if (ended ? n <= Math.min(row.round, 6) : n < row.round) pip.classList.add('is-done');
    else if (inRound && n === row.round) pip.classList.add('is-now');
    pips.appendChild(pip);
  }

  const label = document.createElement('span');
  label.className = 'progress-label';
  label.textContent = row.status;

  td.append(pips, label);
  if (idle) {
    const tag = document.createElement('span');
    tag.className = 'tag-idle';
    tag.textContent = 'idle';
    tag.title = 'Not ended, and started more than a day ago';
    td.appendChild(tag);
  }
  return td;
}

function renderGames(rows, listEl) {
  const now = Date.now();
  const sub = document.getElementById('games-sub');
  if (rows.length === 0) {
    sub.textContent = '';
    listEl.innerHTML = '<p class="dash-empty">No games yet.</p>';
    return;
  }
  sub.textContent = `Newest ${rows.length} loaded`;

  const trs = rows.map(row => {
    const tr = document.createElement('tr');
    const idle = row.status !== 'Ended' && row.createdAt && now - row.createdAt > DAY_MS;
    if (idle) tr.classList.add('is-idle');

    const codeTd = textCell(row.code, 'cell-code');

    const linksTd = document.createElement('td');
    linksTd.className = 'cell-actions';
    for (const [href, text] of [['debug.html', 'Debug'], ['standings.html', 'Standings']]) {
      const a = document.createElement('a');
      a.href = `${href}?code=${encodeURIComponent(row.code)}`;
      a.className = 'btn-quiet btn-sm';
      a.textContent = text;
      a.setAttribute('aria-label', `${text}, game ${row.code}`);
      linksTd.appendChild(a);
    }

    tr.append(
      codeTd,
      whenCell(row.createdAt),
      progressCell(row, idle),
      textCell(String(row.playerCount), 'cell-num'),
      textCell(row.location || '—', 'cell-place'),
      linksTd,
    );
    return tr;
  });

  collapsibleTable(
    ['Code', 'Started', 'Progress', { text: 'Players', className: 'cell-num' }, 'Place',
     { text: 'Open', srOnly: true }],
    trs, listEl, 'games',
  );
}

function formatMinutes(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderQuickScorerSessions(rows, listEl) {
  const sub = document.getElementById('sessions-sub');
  if (rows.length === 0) {
    sub.textContent = '';
    listEl.innerHTML = '<p class="dash-empty">No quick scorer sessions yet.</p>';
    return;
  }
  sub.textContent = `Newest ${rows.length} loaded · bars run to ${SESSION_BAR_MIN} min`;
  const longest = SESSION_BAR_MIN * 60_000; // fixed scale: one marathon tab shouldn't flatten the rest

  const trs = rows.map(row => {
    const tr = document.createElement('tr');

    const lengthTd = document.createElement('td');
    if (row.durationMs == null) {
      lengthTd.textContent = '—';
      lengthTd.title = 'No heartbeat arrived, so the length is unknown';
    } else {
      const value = document.createElement('span');
      value.className = 'length-value';
      value.textContent = formatMinutes(row.durationMs);
      const meter = document.createElement('span');
      meter.className = 'meter';
      meter.setAttribute('aria-hidden', 'true');
      meter.style.setProperty('--w', `${Math.min(100, Math.max(2, (row.durationMs / longest) * 100))}%`);
      const wrap = document.createElement('div');
      wrap.className = 'length';
      wrap.append(value, meter);
      lengthTd.appendChild(wrap);
    }

    tr.append(whenCell(row.startedAt), lengthTd, textCell(row.location || '—', 'cell-place'));
    return tr;
  });

  collapsibleTable(['Started', 'Length', 'Place'], trs, listEl, 'sessions');
}

function renderFeedback(items, listEl) {
  listEl.innerHTML = '';
  const sub = document.getElementById('feedback-sub');
  const nav = document.getElementById('nav-feedback');

  if (items.length === 0) {
    sub.textContent = '';
    nav.textContent = '0';
    listEl.innerHTML = '<p class="dash-empty">No feedback yet.</p>';
    return;
  }
  const weekAgo = Date.now() - KPI_DAYS * DAY_MS;
  const fresh = items.filter(i => i.createdAt > weekAgo).length;
  nav.textContent = String(items.length);
  sub.textContent = fresh ? `${fresh} in the last 7 days` : `Newest ${items.length} loaded`;

  const list = document.createElement('ol');
  list.className = 'feedback';

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'feedback-item';
    if (i >= FEEDBACK_SHOWN) li.hidden = true;

    const body = document.createElement('p');
    body.className = 'feedback-body';
    body.textContent = item.message || '';

    const meta = document.createElement('p');
    meta.className = 'feedback-meta';

    const t = document.createElement('time');
    if (item.createdAt) {
      t.dateTime = new Date(item.createdAt).toISOString();
      t.title = new Date(item.createdAt).toLocaleString();
    }
    t.textContent = when(item.createdAt);

    const where = document.createElement('span');
    where.textContent = item.code ? `${item.page || '—'} · ${item.code}` : (item.page || '—');

    const ver = document.createElement('span');
    ver.textContent = `v${item.version || '?'} · ${item.theme || '?'}`;

    // Contact lives in the write-only feedbackContacts/ node, which this
    // page cannot read by design — so it cannot know whether one exists.
    // Surface the id instead; it is the console lookup key.
    const idEl = document.createElement('span');
    idEl.className = 'feedback-id';
    idEl.textContent = item.id;

    meta.append(t, where, ver, idEl);
    li.append(body, meta);
    list.appendChild(li);
  });
  listEl.appendChild(list);

  if (items.length > FEEDBACK_SHOWN) {
    const more = document.createElement('button');
    more.className = 'btn-quiet btn-sm dash-more';
    more.textContent = `Show ${items.length - FEEDBACK_SHOWN} older`;
    more.addEventListener('click', () => {
      list.querySelectorAll('li[hidden]').forEach(li => { li.hidden = false; });
      more.remove();
    });
    listEl.appendChild(more);
  }
}
