// tests/seat-diagram.test.js
import { seatDiagramSvg, describeMove, shortName } from '../src/js/seat-diagram.js';
import { seatMoves, calculateNextRoundSeating } from '../src/js/game-logic.js';
import { SAMPLE_NIGHT } from '../src/js/sample-night.js';

const { players, assignments: a, results } = SAMPLE_NIGHT;
const next = calculateNextRoundSeating(a, results, 3);
const sm = seatMoves(players, a, results, next, 3);
const ghostPlayers = { ...players };
for (const id of ['p9', 'p10', 'p11', 'p12']) ghostPlayers[id] = { ...players[id], isGhost: true };
const ghostSm = seatMoves(ghostPlayers, a, results, next, 3);

test('one arrow per move, classed by direction', () => {
  document.body.innerHTML = seatDiagramSvg(sm, { round: 2 });
  expect(document.querySelectorAll('.sd-arrow')).toHaveLength(6);
  expect(document.querySelectorAll('.sd-arrow.is-up')).toHaveLength(2);
  expect(document.querySelectorAll('.sd-arrow.is-down')).toHaveLength(1);
  expect(document.querySelector('svg').getAttribute('role')).toBe('img');
  expect(document.body.textContent).toContain('Round 3');
});

test('escapes names in text and aria-label', () => {
  const svg = seatDiagramSvg(seatMoves({ ...players, p1: { name: '<b>Jo</b>', isGhost: false } }, a, results, next, 3), { round: 2 });
  expect(svg).not.toContain('<b>');
  document.body.innerHTML = svg;
  expect(document.body.textContent).toContain('<b>Jo</b>'); // 9 chars, so not shortened
  expect(document.querySelector('svg').getAttribute('aria-label')).toContain('<b>Jo</b>');
});

test('shortName trims long names', () => {
  expect(shortName('Bernadette-Anne')).toBe('Bernadett…');
  expect(shortName('Ann')).toBe('Ann');
});

test('highlight fades everything but the player path and bolds the name', () => {
  document.body.innerHTML = seatDiagramSvg(sm, { round: 2, highlightId: 'p5' });
  expect(document.querySelectorAll('.sd-me')).toHaveLength(2);
  expect(document.querySelectorAll('.sd-arrow:not(.is-faded)')).toHaveLength(1);
});

test('ghost names are marked by class, not an emoji', () => {
  const svg = seatDiagramSvg(ghostSm, { round: 2 });
  expect(svg).not.toContain('👻');
  document.body.innerHTML = svg;
  expect(document.querySelectorAll('.sd-ghost').length).toBe(8); // p9-p12, before and after
});

test('one name per line, never squeezed to fit', () => {
  const svg = seatDiagramSvg(seatMoves({ ...players, p6: { name: 'Bernadette-Anne', isGhost: false } }, a, results, next, 3), { round: 2 });
  expect(svg).not.toContain('textLength');
  document.body.innerHTML = svg;
  const lines = [...document.querySelectorAll('.sd-name')].map(t => t.textContent);
  expect(lines).toContain('Bernadett…');
  expect(lines.filter(l => l.includes(','))).toHaveLength(0);
});

test('winning pairs sit on the highlighter, one per table', () => {
  document.body.innerHTML = seatDiagramSvg(sm, { round: 2 });
  expect(document.querySelectorAll('.sd-won')).toHaveLength(3);
});

test('spoken summary capitalizes table names like the screen', () => {
  expect(seatDiagramSvg(sm, { round: 2 })).toContain('move up from Table 2 to Table 1');
});

test('describeMove copy', () => {
  expect(describeMove({ direction: 'up', fromTable: 2, toTable: 1, outcome: 'won', lastPartner: 'Fay' }))
    .toEqual({ headline: '↑ Move up to Table 1', why: 'You and Fay won at Table 2.', headTable: true });
  expect(describeMove({ direction: 'stay', fromTable: 2, toTable: 2, outcome: 'lost', lastPartner: null }).why)
    .toBe('You lost at Table 2.');
  expect(describeMove({ direction: 'down', fromTable: 1, toTable: 3, outcome: 'lost', lastPartner: 'Dot' }).headline)
    .toBe('↓ Drop to Table 3');
});
