import { dailyCounts, periodCounts, median, topPlaces, startOfDay, DAY_MS, visibleRecords } from '../src/js/admin-stats.js';

// Mid-afternoon local time, so "today" has room on both sides.
const NOW = new Date(2026, 10, 19, 15, 30).getTime();
const TODAY = startOfDay(NOW);

describe('dailyCounts', () => {
  test('returns one bucket per day, oldest first, ending today', () => {
    const buckets = dailyCounts([], 14, NOW);
    expect(buckets).toHaveLength(14);
    expect(buckets[13].start).toBe(TODAY);
    expect(buckets[0].start).toBe(new Date(2026, 10, 6).getTime());
    expect(buckets.every(b => b.count === 0)).toBe(true);
  });

  test('puts timestamps on their local day and skips ones outside the window', () => {
    const buckets = dailyCounts([
      TODAY + 1000,                     // today
      TODAY - 1,                        // yesterday, 23:59:59.999
      new Date(2026, 10, 6, 0, 0).getTime(), // first day, midnight
      new Date(2026, 10, 5, 23).getTime(),   // day before the window
      TODAY + DAY_MS + 5,               // tomorrow
      null,
    ], 14, NOW);
    expect(buckets[13].count).toBe(1);
    expect(buckets[12].count).toBe(1);
    expect(buckets[0].count).toBe(1);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});

describe('periodCounts', () => {
  test('splits into the last N days and the N days before', () => {
    const counts = periodCounts([
      NOW - 1000,
      NOW - 6 * DAY_MS,
      NOW - 8 * DAY_MS,
      NOW - 20 * DAY_MS, // too old for either
      NOW + 1000,        // clock skew: ignored
      0,
    ], 7, NOW);
    expect(counts).toEqual({ current: 2, previous: 1 });
  });
});

describe('median', () => {
  test('handles odd, even, empty and non-numeric input', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(median([null, NaN, 7])).toBe(7);
  });
});

describe('topPlaces', () => {
  test('combines games and sessions per place, busiest first, skipping unknowns', () => {
    const places = topPlaces(
      [{ location: 'Overland Park, Kansas' }, { location: null }, { location: 'Lee’s Summit, Missouri' }],
      [{ location: 'Overland Park, Kansas' }, { location: 'Overland Park, Kansas' }, { location: null }],
      5,
    );
    expect(places).toEqual([
      { place: 'Overland Park, Kansas', games: 1, sessions: 2, total: 3 },
      { place: 'Lee’s Summit, Missouri', games: 1, sessions: 0, total: 1 },
    ]);
  });

  test('respects the limit', () => {
    const rows = ['A', 'B', 'C'].map(location => ({ location }));
    expect(topPlaces(rows, [], 2)).toHaveLength(2);
  });
});

describe('visibleRecords', () => {
  const game     = { code: 'AAAA', meta: { createdAt: 1 } };
  const testGame = { code: 'BBBB', meta: { createdAt: 2, isTest: true } };
  const session     = { id: 's1', startedAt: 1 };
  const testSession = { id: 's2', startedAt: 2, isTest: true };
  const feedback     = { id: 'f1', message: 'hi' };
  const testFeedback = { id: 'f2', message: '[e2e] check', isTest: true };

  test('drops records flagged by a test run, whether the flag sits on the record or its meta', () => {
    expect(visibleRecords([game, testGame], false)).toEqual([game]);
    expect(visibleRecords([testSession, session], false)).toEqual([session]);
    expect(visibleRecords([feedback, testFeedback], false)).toEqual([feedback]);
  });

  test('keeps everything when test data is included', () => {
    const all = [game, testGame, session, testSession];
    expect(visibleRecords(all, true)).toEqual(all);
  });

  test('keeps unflagged records, including ones with a falsy or non-boolean flag', () => {
    const odd = [{ isTest: false }, { meta: {} }, { isTest: 'true' }];
    expect(visibleRecords(odd, false)).toEqual(odd);
  });
});
