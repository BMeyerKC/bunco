// js/seat-diagram.js — the before → after seat diagram between rounds.
//
// seatDiagramSvg() draws a seatMoves() result (game-logic.js) as an SVG
// string: last round's tables (won / lost pairs) on the left, next round's
// tables on the right, one arrow per pair. Colors come from CSS classes in
// base.css so both themes work. Used on game, standings, debug and the
// landing page (at build time), so it must not touch the DOM.

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A narrow viewBox so a ~300–340px phone column scales it up: names are
// 13.5 units, which renders at 15px+ (the 17 rule's mid-game floor).
const W = 270, TOP = 24, ROW = 148, BOX_H = 134, LINE = 16;
const LEFT = { x: 3, w: 106 }, RIGHT = { x: 161, w: 106 };

/** Names longer than 10 characters are cut to 9 + '…' (full names are in the card). */
export function shortName(name) {
  const s = String(name);
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
}

/** Headline and reason for the "your move" card, from a yourMove() result. */
export function describeMove(move) {
  const to = move.toTable;
  const headline = move.direction === 'up' ? `↑ Move up to Table ${to}`
    : move.direction === 'down' ? `↓ Drop to Table ${to}`
    : `Stay at Table ${to}`;
  const who = move.lastPartner ? `You and ${move.lastPartner}` : 'You';
  return { headline, why: `${who} ${move.outcome} at Table ${move.fromTable}.`, headTable: to === 1 };
}

// One name per line: two names never share a line, so nothing is squeezed.
function names(x, y, people, highlightId) {
  if (!people.length) return `<text class="sd-name" x="${x}" y="${y}">—</text>`;
  return people.map((p, i) => {
    const cls = ['sd-name', p.isGhost && 'sd-ghost', p.id === highlightId && 'sd-me'].filter(Boolean).join(' ');
    return `<text class="${cls}" x="${x}" y="${y + i * LINE}">${esc(shortName(p.name))}</text>`;
  }).join('');
}

function summary(sm, round) {
  const who = ps => ps.map(p => `${p.name}${p.isGhost ? ' (ghost)' : ''}`).join(' and ');
  const parts = sm.moves.map(m =>
    m.direction === 'stay' ? `${who(m.people)} stay at Table ${m.toTable}`
    : `${who(m.people)} ${m.direction === 'up' ? 'move up' : 'drop'} from Table ${m.fromTable} to Table ${m.toTable}`);
  return `Seat moves from round ${round} to round ${round + 1}: ${parts.join('; ')}.`;
}

/**
 * @param {{ before, after, moves }} sm  seatMoves() result
 * @param {{ round?: number, highlightId?: string }} [opts]
 * @returns {string} SVG markup
 */
export function seatDiagramSvg(sm, { round = 1, highlightId } = {}) {
  const n = sm.before.length;
  const H = TOP + n * ROW;
  const top = t => TOP + (t - 1) * ROW;
  const mine = highlightId ? sm.moves.find(m => m.people.some(p => p.id === highlightId)) : null;
  const fade = keep => (highlightId && !keep ? ' is-faded' : '');
  const box = (x, y, w, t) =>
    `<rect class="sd-box${t === 1 ? ' is-head' : ''}" x="${x}" y="${y}" width="${w}" height="${BOX_H}" rx="8"/>`
    + `<text class="sd-title" x="${x + 9}" y="${y + 21}">Table ${t}${t === 1 ? ' ★' : ''}</text>`;

  const left = sm.before.map(({ tableId: t, won, lost }) => {
    const y = top(t), x = LEFT.x + 9;
    return `<g class="sd-table${fade(mine?.fromTable === t)}">`
      + box(LEFT.x, y, LEFT.w, t)
      + `<rect class="sd-won" x="${LEFT.x + 4}" y="${y + 28}" width="${LEFT.w - 8}" height="51" rx="4"/>`
      + `<text class="sd-label" x="${x}" y="${y + 41}">Won</text>`
      + names(x, y + 58, won, highlightId)
      + `<text class="sd-label" x="${x}" y="${y + 95}">Lost</text>`
      + names(x, y + 112, lost, highlightId)
      + '</g>';
  }).join('');

  const right = sm.after.map(({ tableId: t, us, them }) => {
    const y = top(t), x = RIGHT.x + 9;
    return `<g class="sd-table${fade(mine?.toTable === t)}">`
      + box(RIGHT.x, y, RIGHT.w, t)
      + names(x, y + 43, us, highlightId)
      + `<text class="sd-label" x="${x}" y="${y + 79}">vs</text>`
      + names(x, y + 99, them, highlightId)
      + '</g>';
  }).join('');

  const arrows = sm.moves.map(m => {
    const y1 = top(m.fromTable) + (m.outcome === 'won' ? 62 : 116);
    const y2 = top(m.toTable) + (m.direction === 'stay' ? 50 : 104);
    const x1 = LEFT.x + LEFT.w + 2, x2 = RIGHT.x - 4;
    const d = y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`;
    return `<path class="sd-arrow is-${m.direction}${fade(m === mine)}${m === mine ? ' is-mine' : ''}" d="${d}" marker-end="url(#sd-ah-${m.direction})"/>`;
  }).join('');

  const markers = ['up', 'down', 'stay'].map(dir =>
    `<marker id="sd-ah-${dir}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto">`
    + `<path class="sd-head is-${dir}" d="M0,0 L10,5 L0,10 z"/></marker>`).join('');

  return `<svg class="seat-diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary(sm, round))}">`
    + `<defs>${markers}</defs>`
    + `<text class="sd-col" x="${LEFT.x + LEFT.w / 2}" y="14" text-anchor="middle">Round ${round}</text>`
    + `<text class="sd-col" x="${RIGHT.x + RIGHT.w / 2}" y="14" text-anchor="middle">Round ${round + 1}</text>`
    + left + right + arrows
    + '</svg>';
}
