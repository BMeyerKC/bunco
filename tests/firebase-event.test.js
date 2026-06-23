import { EVENT } from '../src/js/firebase.js';

test('EVENT has all 9 required event type string values', () => {
  const expected = [
    'game_created', 'player_joined', 'ghost_claimed', 'seats_assigned',
    'round_started', 'game_called', 'score_submitted', 'bunco_recorded', 'game_ended',
  ];
  for (const val of expected) {
    expect(Object.values(EVENT)).toContain(val);
  }
});

test('EVENT is frozen', () => {
  expect(Object.isFrozen(EVENT)).toBe(true);
});

test('EVENT has exactly 9 entries', () => {
  expect(Object.keys(EVENT)).toHaveLength(9);
});
