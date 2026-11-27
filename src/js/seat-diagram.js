// js/seat-diagram.js — the before → after seat diagram between rounds.
//
// seatDiagramSvg() draws a seatMoves() result (game-logic.js) as an SVG
// string: last round's tables (won / lost pairs) on the left, next round's
// tables on the right, one arrow per pair. Colors come from CSS classes in
// base.css so both themes work. Used on game, standings, debug and the
// landing page (at build time), so it must not touch the DOM.

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const W = 320, TOP = 20, ROW = 100, BOX_H = 80;
const LEFT = { x: 6, w: 124 }, RIGHT = { x: 192, w: 122 };
const LONG = 18; // characters before a line is squeezed to fit its box

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

function nameSpan(p, highlightId) {
  const text = `${p.isGhost ? '👻 ' : ''}${shortName(p.name)}`;
  const cls = [p.isGhost && 'sd-ghost', p.id === highlightId && 'sd-me'].filter(Boolean).join(' ');
  return cls ? `<tspan class="${cls}">${esc(text)}</tspan>` : esc(text);
}

function textLine(x, y, people, joiner, highlightId, width, cls = '') {
  const plain = people.map(p => `${p.isGhost ? '👻 ' : ''}${shortName(p.name)}`).join(joiner);
  const fit = plain.length > LONG ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : '';
  const body = people.length ? people.map(p => nameSpan(p, highlightId)).join(esc(joiner)) : '—';
  return `<text x="${x}" y="${y}"${cls ? ` class="${cls}"` : ''}${fit}>${body}</text>`;
}

function summary(sm, round) {
  const names = ps => ps.map(p => p.name).join(' and ');
  const parts = sm.moves.map(m =>
    m.direction === 'stay' ? `${names(m.people)} stay at table ${m.toTable}`
    : `${names(m.people)} ${m.direction === 'up' ? 'move up' : 'drop'} from table ${m.fromTable} to table ${m.toTable}`);
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
  const star = t => (t === 1 ? ' ★' : '');

  const left = sm.before.map(({ tableId: t, won, lost }) => {
    const y = top(t), x = LEFT.x + 8;
    return `<g class="sd-table${fade(mine?.fromTable === t)}">`
      + `<rect class="sd-box${t === 1 ? ' is-head' : ''}" x="${LEFT.x}" y="${y}" width="${LEFT.w}" height="${BOX_H}" rx="8"/>`
      + `<text class="sd-title" x="${x}" y="${y + 15}">Table ${t}${star(t)}</text>`
      + `<text class="sd-label" x="${x}" y="${y + 29}">Won</text>`
      + textLine(x, y + 41, won, ', ', highlightId, LEFT.w - 16)
      + `<text class="sd-label" x="${x}" y="${y + 55}">Lost</text>`
      + textLine(x, y + 67, lost, ', ', highlightId, LEFT.w - 16)
      + '</g>';
  }).join('');

  const right = sm.after.map(({ tableId: t, us, them }) => {
    const y = top(t), x = RIGHT.x + 8;
    return `<g class="sd-table${fade(mine?.toTable === t)}">`
      + `<rect class="sd-box${t === 1 ? ' is-head' : ''}" x="${RIGHT.x}" y="${y}" width="${RIGHT.w}" height="${BOX_H}" rx="8"/>`
      + `<text class="sd-title" x="${x}" y="${y + 15}">Table ${t}${star(t)}</text>`
      + textLine(x, y + 37, us, ' + ', highlightId, RIGHT.w - 16)
      + `<text class="sd-label" x="${x}" y="${y + 52}">vs</text>`
      + textLine(x, y + 68, them, ' + ', highlightId, RIGHT.w - 16)
      + '</g>';
  }).join('');

  const arrows = sm.moves.map(m => {
    const y1 = top(m.fromTable) + (m.outcome === 'won' ? 37 : 63);
    const y2 = top(m.toTable) + (m.direction === 'stay' ? 30 : 54);
    const x1 = LEFT.x + LEFT.w + 2, x2 = RIGHT.x - 4;
    const d = y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`;
    return `<path class="sd-arrow is-${m.direction}${fade(m === mine)}${m === mine ? ' is-mine' : ''}" d="${d}" marker-end="url(#sd-ah-${m.direction})"/>`;
  }).join('');

  const markers = ['up', 'down', 'stay'].map(dir =>
    `<marker id="sd-ah-${dir}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto">`
    + `<path class="sd-head is-${dir}" d="M0,0 L10,5 L0,10 z"/></marker>`).join('');

  return `<svg class="seat-diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary(sm, round))}">`
    + `<defs>${markers}</defs>`
    + `<text class="sd-col" x="${LEFT.x + LEFT.w / 2}" y="12" text-anchor="middle">Round ${round}</text>`
    + `<text class="sd-col" x="${RIGHT.x + RIGHT.w / 2}" y="12" text-anchor="middle">Round ${round + 1}</text>`
    + left + right + arrows
    + '</svg>';
}
