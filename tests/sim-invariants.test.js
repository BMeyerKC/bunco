// tests/sim-invariants.test.js — the bot simulator's rule checks must
// pass a valid game and catch each kind of corruption.
import { checkGame, isTableFrame, needsWire } from '../sim/invariants.js';
import { assignRandomSeats, calculateNextRoundSeating, roundWinners } from '../src/js/game-logic.js';

function validGame() {
  const players = {};
  for (let i = 1; i <= 8; i++) players[`p${i}`] = { name: `P${i}`, isGhost: false };
  const rounds = [null];
  let assignments = assignRandomSeats(Object.keys(players), 2);
  for (let r = 1; r <= 6; r++) {
    const tables = [null,
      { liveUs: 21, liveThem: 10, usScore: 21, themScore: 10, submitted: true },
      { liveUs: 4, liveThem: 21, usScore: 4, themScore: 21, submitted: true }];
    rounds.push({ assignments, tables });
    assignments = calculateNextRoundSeating(assignments, roundWinners(tables, assignments, {}, 2), 2);
  }
  const events = [1, 2, 3, 4, 5, 6].map(round => ({ type: 'round_started', round }));
  events.push({ type: 'game_ended' });
  return { game: { meta: { tables: 2, currentRound: 7 }, players, rounds }, events };
}

test('a valid six-round game has no violations', () => {
  const { game, events } = validGame();
  expect(checkGame(game, events)).toEqual([]);
});

test('catches a submit that lost the last tapped point', () => {
  const { game, events } = validGame();
  game.rounds[3].tables[1].usScore = 20;
  expect(checkGame(game, events)).toContainEqual('round 3 table 1: submitted 20-10 but live score was 21-10');
});

test('catches seats that break the Head Table rotation', () => {
  const { game, events } = validGame();
  const seats = game.rounds[4].assignments;
  const a = Object.keys(seats).find(id => seats[id].tableId === 1);
  const b = Object.keys(seats).find(id => seats[id].tableId === 2);
  [seats[a], seats[b]] = [seats[b], seats[a]];
  expect(checkGame(game, events).some(m => m.startsWith('round 4:') && m.includes('rotation says'))).toBe(true);
});

test('catches a round started twice, a stuck game, and a ghost Bunco', () => {
  const { game, events } = validGame();
  events.push({ type: 'round_started', round: 2 });
  game.meta.currentRound = 5;
  game.players.p1.isGhost = true;
  game.rounds[2].buncos = { p1: 1 };
  const v = checkGame(game, events);
  expect(v).toContain('round 2 started 2 times');
  expect(v).toContain('game stuck in round 5');
  expect(v).toContain('round 2: ghost P1 credited a Bunco');
});

test('catches bot taps that never reached the database', () => {
  const { game, events } = validGame();
  expect(checkGame(game, events, { 2: { 2: { us: 5, them: 21 } } }))
    .toContain('round 2 table 2: bots tapped 5-21 but live score is 4-21');
});

test('records table traffic and server replies, not other frames', () => {
  expect(isTableFrame('{"t":"d","d":{"r":7,"a":"p","b":{"p":"/games/AB/rounds/4/tables/2","d":{},"h":"x"}}}')).toBe(true);
  expect(isTableFrame('{"t":"d","d":{"r":7,"b":{"s":"datastale","d":""}}}')).toBe(true);
  expect(isTableFrame('{"t":"d","d":{"a":"d","b":{"p":"games/AB/events/x","d":{}}}}')).toBe(false);
  expect(isTableFrame('0')).toBe(false);
});

test('saves a recording for real problems but not event-log counts alone', () => {
  expect(needsWire(['round 2 started 2 times', 'game_ended logged 3 times'])).toBe(false);
  expect(needsWire([])).toBe(false);
  expect(needsWire(['round 2 started 2 times', 'round 4 table 2: never submitted'])).toBe(true);
});
