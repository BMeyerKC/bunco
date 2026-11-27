// js/between-rounds-seats.js — the "your move" card and the room diagram on
// the between-rounds view. Pass sm = null after round 6 to clear both.

import { yourMove } from './game-logic.js';
import { seatDiagramSvg, describeMove } from './seat-diagram.js';

export function renderBetweenRoundsSeats(root, sm, { round, playerId }) {
  const $ = id => root.querySelector(`#${id}`);
  const card = $('br-next-seat');
  const diagram = $('br-seat-diagram');
  const move = sm && playerId ? yourMove(sm, playerId) : null;

  if (card) card.hidden = !move;
  if (move) {
    const { headline, why, headTable } = describeMove(move);
    $('br-move-headline').textContent = headline;
    $('br-move-head-pill').hidden = !headTable;
    $('br-move-why').textContent = why;
    $('br-next-teammate').textContent = move.nextPartner || '—';
    $('br-next-opponents').textContent = move.nextOpponents.join(' & ') || '—';
  }
  if (diagram) diagram.innerHTML = sm ? seatDiagramSvg(sm, { round, highlightId: move ? playerId : undefined }) : '';
}
