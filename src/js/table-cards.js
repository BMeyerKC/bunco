// js/table-cards.js

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function nameList(side) {
  return side.map(p =>
    p.isGhost
      ? `<span class="text-muted">${esc(p.name)}</span>`
      : `<span>${esc(p.name)}</span>`
  ).join(' &amp; ');
}

/**
 * Renders per-table seating cards with optional live scores into a container element.
 *
 * @param {HTMLElement} container
 * @param {{ tableId: number, us: {name,isGhost}[], them: {name,isGhost}[] }[]} tables
 * @param {{ [tableId: number]: { liveUs?: number, liveThem?: number, submitted?: boolean } }} tableScores
 */
export function renderTableCards(container, tables, tableScores = {}) {
  container.innerHTML = tables.map(({ tableId, us, them }) => {
    const scores    = tableScores[tableId] ?? {};
    const usScore   = scores.liveUs   ?? 0;
    const themScore = scores.liveThem ?? 0;
    const submitted = !!scores.submitted;
    const usWin     = usScore > themScore;
    const themWin   = themScore > usScore;

    return `
      <div data-table-card class="table-card${submitted ? ' is-submitted' : ''}">
        <div class="table-card-head">
          <span class="table-card-name">Table ${Number(tableId)}</span>
          ${submitted ? '<span class="table-card-badge">Submitted</span>' : ''}
        </div>
        <div class="table-card-row">
          <div class="table-card-side">${nameList(us)}</div>
          <span data-score class="table-card-score${usWin ? ' is-ahead' : ''}">${usScore}</span>
          <span class="table-card-vs" aria-hidden="true">–</span>
          <span data-score class="table-card-score${themWin ? ' is-ahead' : ''}">${themScore}</span>
          <div class="table-card-side">${nameList(them)}</div>
        </div>
      </div>`;
  }).join('');
}
