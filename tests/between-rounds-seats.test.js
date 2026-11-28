// tests/between-rounds-seats.test.js
import { renderBetweenRoundsSeats } from '../src/js/between-rounds-seats.js';
import { seatMoves, calculateNextRoundSeating } from '../src/js/game-logic.js';
import { SAMPLE_NIGHT } from '../src/js/sample-night.js';

const { players, assignments: a, results } = SAMPLE_NIGHT;
const sm = seatMoves(players, a, results, calculateNextRoundSeating(a, results, 3), 3);

beforeEach(() => {
  document.body.innerHTML = `
    <div id="br-next-seat" hidden>
      <p id="br-move-headline"></p><span id="br-move-head-pill" hidden></span>
      <p id="br-move-why"></p>
      <dd id="br-next-teammate"></dd><dd id="br-next-opponents"></dd>
    </div>
    <section id="br-seat-room" hidden><div id="br-seat-diagram"></div></section>`;
});

test('fills the card for a seated player and highlights them', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  expect(document.getElementById('br-move-headline').textContent).toBe('↑ Move up to Table 1');
  expect(document.getElementById('br-move-why').textContent).toBe('You and Fay won at Table 2.');
  expect(document.getElementById('br-move-head-pill').hidden).toBe(false);
  expect(document.getElementById('br-next-teammate').textContent).toBe('Ann');
  expect(document.getElementById('br-next-opponents').textContent).toBe('Beth & Fay');
  expect(document.getElementById('br-next-seat').hidden).toBe(false);
  expect(document.querySelectorAll('#br-seat-diagram .sd-me')).toHaveLength(2);
});

test('hides the card and draws unhighlighted for an unseated device', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: null });
  expect(document.getElementById('br-next-seat').hidden).toBe(true);
  expect(document.querySelectorAll('#br-seat-diagram svg')).toHaveLength(1);
  expect(document.querySelectorAll('#br-seat-diagram .is-faded')).toHaveLength(0);
});

test('re-rendering replaces the diagram rather than appending', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  expect(document.querySelectorAll('#br-seat-diagram svg')).toHaveLength(1);
});

test('a null result (round 6) hides the card and clears the diagram', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: 'p5' });
  renderBetweenRoundsSeats(document.body, null, { round: 6, playerId: 'p5' });
  expect(document.getElementById('br-next-seat').hidden).toBe(true);
  expect(document.getElementById('br-seat-diagram').innerHTML).toBe('');
  expect(document.getElementById('br-seat-room').hidden).toBe(true);
});

test('the room section shows whenever there is a next round', () => {
  renderBetweenRoundsSeats(document.body, sm, { round: 2, playerId: null });
  expect(document.getElementById('br-seat-room').hidden).toBe(false);
});
