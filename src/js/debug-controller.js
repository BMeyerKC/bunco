import { watchEvents, watchGame } from './firebase.js';
import { roundWinners, calculateNextRoundSeating, seatMoves, seatMismatches } from './game-logic.js';
import { seatDiagramSvg } from './seat-diagram.js';

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EVENT_COLORS = {
  game_created:    '#7c3aed',
  player_joined:   '#16a34a',
  ghost_claimed:   '#0891b2',
  seats_assigned:  '#2563eb',
  round_started:   '#ea580c',
  game_called:     '#d97706',
  score_submitted: '#a855f7',
  bunco_recorded:  '#dc2626',
  bunco_undone:    '#991b1b',
  game_ended:      '#fbbf24',
  standings_saved: '#0d9488',
  five_added:      '#0284c7',
  five_undone:     '#075985',
};

const code     = new URLSearchParams(window.location.search).get('code')?.toUpperCase();
const timeline = document.getElementById('event-timeline');
const codeEl   = document.getElementById('debug-code');

if (!code) {
  timeline.innerHTML = '<p style="color:var(--very-muted); padding:16px 0;">No game code — add ?code=XXXX to the URL.</p>';
} else {
  if (codeEl) codeEl.textContent = code;
  watchEvents(code, events => {
    if (!events) {
      timeline.innerHTML = '<p style="color:var(--very-muted); padding:16px 0;">No events yet.</p>';
      return;
    }
    timeline.innerHTML = '';
    for (const [, event] of Object.entries(events)) {
      timeline.appendChild(renderEvent(event));
    }
    timeline.scrollTop = timeline.scrollHeight;
  });
  watchGame(code, data => {
    document.getElementById('seat-history').innerHTML = data ? seatHistoryHtml(data) : '';
  });
}

// One before → after diagram per round change, drawn from the STORED seats,
// plus a red line naming anyone the Head Table rule would have seated elsewhere.
function seatHistoryHtml(data) {
  const rounds = data.rounds || {};
  const players = data.players || {};
  const n = data.meta?.tables || 0;
  let html = '';
  for (let r = 1; r <= 5; r++) {
    const cur = rounds[r]?.assignments, next = rounds[r + 1]?.assignments;
    if (!cur || !next) continue;
    const results = roundWinners(rounds[r].tables, cur, rounds[r].buncos, n);
    const off = seatMismatches(next, calculateNextRoundSeating(cur, results, n));
    html += `<h2 class="section-title">Round ${r} → ${r + 1}</h2>`
      + seatDiagramSvg(seatMoves(players, cur, results, next, n), { round: r })
      + (off.length ? `<p class="field-error">Seated off-rule: ${esc(off.map(id => players[id]?.name ?? id).join(', '))}</p>` : '');
  }
  return html;
}

function renderEvent(event) {
  const { type, ts, ...payload } = event;
  const time  = new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  const color = EVENT_COLORS[type] || '#666';

  const entry = document.createElement('div');
  entry.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);';

  const timeEl = document.createElement('span');
  timeEl.style.cssText = 'color:var(--very-muted);font-size:0.8rem;min-width:72px;font-family:monospace;padding-top:3px;flex-shrink:0;';
  timeEl.textContent = time;

  const badge = document.createElement('span');
  badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;';

  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;`;

  const label = document.createElement('span');
  label.textContent = type;

  badge.appendChild(dot);
  badge.appendChild(label);

  const payloadEl = document.createElement('span');
  payloadEl.style.cssText = 'color:var(--muted);font-size:0.8rem;font-family:monospace;word-break:break-all;';
  const pairs = Object.entries(payload).map(([k, v]) => `${k}:${v}`).join('  ');
  payloadEl.textContent = pairs || '';

  entry.appendChild(timeEl);
  entry.appendChild(badge);
  entry.appendChild(payloadEl);
  return entry;
}
