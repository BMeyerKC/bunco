// js/quick-scorer.js — the standalone two-sided scoreboard (scorer.astro).
// No game, no network beyond usage tracking: just two numbers and a reset.

import { renderTally, TARGET } from './tally.js';
import { showToast } from './ui.js';
import { keepScreenAwake } from './wake-lock.js';

const sides = {
  us:   { score: 0, half: 'us-half',   num: 'us-score',   tally: 'us-tally' },
  them: { score: 0, half: 'them-half', num: 'them-score', tally: 'them-tally' },
};

function pop(el) {
  el.classList.remove('score-pop');
  void el.offsetWidth; // restart the animation
  el.classList.add('score-pop');
}

function render() {
  for (const side of Object.values(sides)) {
    document.getElementById(side.num).textContent = side.score;
    renderTally(document.getElementById(side.tally), side.score);
    document.getElementById(side.half).classList.toggle('is-winning', side.score >= TARGET);
  }
  const started = sides.us.score + sides.them.score > 0;
  document.getElementById('app').classList.toggle('has-started', started);
  document.getElementById('new-set-btn').disabled = !started;
}

for (const [key, side] of Object.entries(sides)) {
  const half = document.getElementById(side.half);
  half.querySelector('.side-add').addEventListener('click', () => {
    side.score++;
    pop(document.getElementById(side.num));
    keepScreenAwake();
    render();
  });
  half.querySelector('.half-dec-btn').addEventListener('click', () => {
    if (side.score > 0) side.score--;
    render();
  });
}

document.getElementById('new-set-btn').addEventListener('click', () => {
  const before = { us: sides.us.score, them: sides.them.score };
  sides.us.score = 0;
  sides.them.score = 0;
  render();
  showToast(`Cleared ${before.us} to ${before.them}.`, 'info', {
    actionLabel: 'Undo',
    onAction: () => {
      sides.us.score = before.us;
      sides.them.score = before.them;
      render();
    },
  });
});

render();
