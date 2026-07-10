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
      <div data-table-card class="mb-3 p-3 rounded" style="background:var(--surface);border:1px solid var(--border);">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="text-muted" style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;">Table ${Number(tableId)}</span>
          ${submitted ? '<span class="badge bg-success" style="font-size:0.75rem;">Submitted</span>' : ''}
        </div>
        <div class="d-flex align-items-center gap-2">
          <div class="flex-grow-1 text-start">${nameList(us)}</div>
          <span data-score class="fw-bold fs-5" style="color:${usWin ? 'var(--ink)' : 'var(--muted)'}">${usScore}</span>
          <span class="text-muted px-1">–</span>
          <span data-score class="fw-bold fs-5" style="color:${themWin ? 'var(--ink)' : 'var(--muted)'}">${themScore}</span>
          <div class="flex-grow-1 text-end">${nameList(them)}</div>
        </div>
      </div>`;
  }).join('');
}
