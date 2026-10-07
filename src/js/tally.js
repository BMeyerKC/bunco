// js/tally.js — hand-drawn tally marks under a score, toward the 21 target.
//
// Groups of five (four strokes and a slash), the way scores get kept on a
// paper sheet. Past the target, the extra shows as "+N" instead of more
// marks, so a Bunco (+21) doesn't explode the row.

export const TARGET = 21;

// Slight per-stroke wobble so groups don't look machine-stamped.
const STROKES = [
  'M4 3 L3.4 25',
  'M10 2.5 L10.4 25.5',
  'M16 3.2 L15.5 24.8',
  'M22 2.8 L22.6 25.2',
];
const SLASH = 'M0.5 21 L25.5 6';

function groupSvg(count) {
  const paths = STROKES.slice(0, Math.min(count, 4)).map(d => `<path d="${d}"/>`);
  if (count >= 5) paths.push(`<path d="${SLASH}"/>`);
  return `<svg class="tally-group" viewBox="0 0 26 28" aria-hidden="true" focusable="false">${paths.join('')}</svg>`;
}

/**
 * @param {number} score
 * @param {number} [target]
 * @returns {string} HTML for the tally row (decorative; the number is the accessible value)
 */
export function tallyHtml(score, target = TARGET) {
  const n = Math.max(0, Math.floor(Number(score) || 0));
  const shown = Math.min(n, target);
  const groups = [];
  for (let left = shown; left > 0; left -= 5) groups.push(groupSvg(Math.min(left, 5)));
  const extra = n > target ? `<span class="tally-extra">+${n - target}</span>` : '';
  return groups.join('') + extra;
}

/** Renders the tally into `el` and flags it once the target is reached. */
export function renderTally(el, score, target = TARGET) {
  if (!el) return;
  el.innerHTML = tallyHtml(score, target);
  el.classList.toggle('is-full', score >= target);
}
