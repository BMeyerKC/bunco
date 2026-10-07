// js/setup-stepper.js — host setup: "How many people are playing?"
//
// The host gives a headcount; seatPlan() turns it into tables + ghost seats.
// The result is written to the hidden #setup-tables / #setup-ghosts inputs
// that game-controller.js reads when the game is created.

import { seatPlan, MAX_PLAYERS } from './game-utils.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function diagramHtml({ tables, ghosts }) {
  // Ghost seats are the last seats of the last tables.
  const realSeats = tables * 4 - ghosts;
  let seat = 0;
  return Array.from({ length: tables }, (_, t) => {
    const seats = Array.from({ length: 4 }, () => {
      const ghost = seat++ >= realSeats;
      return `<span class="seat${ghost ? ' is-ghost' : ''}"></span>`;
    }).join('');
    return `<span class="mini-table"><span class="mini-table-top">${t + 1}</span>${seats}</span>`;
  }).join('');
}

export function initSetupStepper() {
  const input = document.getElementById('setup-players');
  if (!input) return;
  const dec = document.getElementById('players-dec');
  const inc = document.getElementById('players-inc');

  const render = (raw) => {
    const plan = seatPlan(raw);
    input.value = plan.players;
    dec.disabled = plan.players <= 1;
    inc.disabled = plan.players >= MAX_PLAYERS;
    document.getElementById('setup-tables').value = plan.tables;
    document.getElementById('setup-ghosts').value = plan.ghosts;
    document.getElementById('setup-tables-diagram').innerHTML = diagramHtml(plan);
    document.getElementById('setup-plan-text').textContent = plan.ghosts
      ? `${plural(plan.tables, 'table', 'tables')}, with ${plural(plan.ghosts, 'ghost seat', 'ghost seats')} to fill.`
      : `${plural(plan.tables, 'table', 'tables')}, every seat filled.`;
    document.getElementById('setup-ghost-note').hidden = plan.ghosts === 0;
  };

  dec.addEventListener('click', () => render(Number(input.value) - 1));
  inc.addEventListener('click', () => render(Number(input.value) + 1));
  input.addEventListener('change', () => render(input.value));

  render(input.value);
}
