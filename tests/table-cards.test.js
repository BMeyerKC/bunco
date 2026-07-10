// tests/table-cards.test.js
import { renderTableCards } from '../src/js/table-cards.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
});

test('renders one card per table', () => {
  const el = document.getElementById('root');
  const tables = [
    { tableId: 1, us: [{ name: 'Alice', isGhost: false }, { name: 'Bob', isGhost: false }], them: [{ name: 'Carol', isGhost: false }, { name: 'Dave', isGhost: false }] },
    { tableId: 2, us: [{ name: 'Eve',   isGhost: false }, { name: 'Frank', isGhost: false }], them: [{ name: 'Grace', isGhost: false }, { name: 'Hank', isGhost: false }] },
  ];
  renderTableCards(el, tables, {});
  expect(el.querySelectorAll('[data-table-card]').length).toBe(2);
  expect(el.textContent).toContain('Table 1');
  expect(el.textContent).toContain('Table 2');
});

test('renders all player names', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [{ name: 'Alice', isGhost: false }, { name: 'Bob', isGhost: false }], them: [{ name: 'Carol', isGhost: false }, { name: 'Dave', isGhost: false }] }];
  renderTableCards(el, tables, {});
  expect(el.textContent).toContain('Alice');
  expect(el.textContent).toContain('Bob');
  expect(el.textContent).toContain('Carol');
  expect(el.textContent).toContain('Dave');
});

test('renders ghost names with text-muted class', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [{ name: 'GhostOne', isGhost: true }, { name: 'Bob', isGhost: false }], them: [{ name: 'Carol', isGhost: false }, { name: 'Dave', isGhost: false }] }];
  renderTableCards(el, tables, {});
  const muted = [...el.querySelectorAll('.text-muted')].find(n => n.textContent.trim() === 'GhostOne');
  expect(muted).toBeTruthy();
});

test('shows submitted badge when submitted is true', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [], them: [] }];
  renderTableCards(el, tables, { 1: { liveUs: 5, liveThem: 3, submitted: true } });
  expect(el.textContent).toContain('Submitted');
});

test('does not show submitted badge when not submitted', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [], them: [] }];
  renderTableCards(el, tables, { 1: { liveUs: 5, liveThem: 3, submitted: false } });
  expect(el.textContent).not.toContain('Submitted');
});

test('highlights winning side score with ink token, losing with muted token', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [], them: [] }];
  renderTableCards(el, tables, { 1: { liveUs: 7, liveThem: 2, submitted: false } });
  const scores = el.querySelectorAll('[data-score]');
  expect(scores[0].getAttribute('style')).toContain('var(--ink)');    // us winning
  expect(scores[1].getAttribute('style')).toContain('var(--muted)');  // them losing
});

test('both scores use muted token when tied', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [], them: [] }];
  renderTableCards(el, tables, { 1: { liveUs: 4, liveThem: 4, submitted: false } });
  const scores = el.querySelectorAll('[data-score]');
  expect(scores[0].getAttribute('style')).toContain('var(--muted)');
  expect(scores[1].getAttribute('style')).toContain('var(--muted)');
});

test('shows 0–0 when no scores provided', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [], them: [] }];
  renderTableCards(el, tables, {});
  const scores = el.querySelectorAll('[data-score]');
  expect(scores[0].textContent).toBe('0');
  expect(scores[1].textContent).toBe('0');
});

test('escapes player names to prevent XSS', () => {
  const el = document.getElementById('root');
  const tables = [{ tableId: 1, us: [{ name: '<script>alert(1)</script>', isGhost: false }], them: [] }];
  renderTableCards(el, tables, {});
  expect(el.innerHTML).not.toContain('<script>');
  expect(el.textContent).toContain('<script>alert(1)</script>');
});

test('clears container when tables array is empty', () => {
  const el = document.getElementById('root');
  el.innerHTML = '<p>old content</p>';
  renderTableCards(el, [], {});
  expect(el.innerHTML).toBe('');
});
