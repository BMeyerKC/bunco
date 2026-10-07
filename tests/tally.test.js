// tests/tally.test.js
import { tallyHtml, renderTally } from '../src/js/tally.js';

const groups = html => (html.match(/class="tally-group"/g) || []).length;
const strokes = html => (html.match(/<path /g) || []).length;

test('zero draws nothing', () => {
  expect(tallyHtml(0)).toBe('');
});

test('three is one group of three strokes', () => {
  const html = tallyHtml(3);
  expect(groups(html)).toBe(1);
  expect(strokes(html)).toBe(3);
});

test('seven is a slashed five and a two', () => {
  const html = tallyHtml(7);
  expect(groups(html)).toBe(2);
  expect(strokes(html)).toBe(5 + 2);
});

test('21 is four full groups and one stroke', () => {
  const html = tallyHtml(21);
  expect(groups(html)).toBe(5);
  expect(strokes(html)).toBe(4 * 5 + 1);
});

test('past 21 shows the overflow as +N, not more marks', () => {
  const html = tallyHtml(42);
  expect(groups(html)).toBe(5);
  expect(html).toContain('+21');
});

test('renderTally flags a full row', () => {
  const el = document.createElement('div');
  renderTally(el, 20);
  expect(el.classList.contains('is-full')).toBe(false);
  renderTally(el, 21);
  expect(el.classList.contains('is-full')).toBe(true);
});
