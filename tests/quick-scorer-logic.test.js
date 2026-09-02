import { buildQuickScorerRows } from '../src/js/quick-scorer-logic.js';

describe('buildQuickScorerRows', () => {
  test('computes duration in ms from startedAt and lastSeenAt', () => {
    const rows = buildQuickScorerRows([
      { id: 'a', startedAt: 1000, lastSeenAt: 1000 + 45_000, city: 'Kansas City', region: 'MO' },
    ]);

    expect(rows[0]).toMatchObject({ id: 'a', startedAt: 1000, durationMs: 45_000 });
  });

  test('durationMs is null when there is no lastSeenAt yet (no heartbeat landed)', () => {
    const rows = buildQuickScorerRows([{ id: 'a', startedAt: 1000 }]);
    expect(rows[0].durationMs).toBeNull();
  });

  test('builds a location string from city and region, falling back to country', () => {
    const rows = buildQuickScorerRows([
      { id: 'a', startedAt: 3, city: 'Kansas City', region: 'Missouri', country: 'United States' },
      { id: 'b', startedAt: 2, country: 'United States' },
      { id: 'c', startedAt: 1 },
    ]);

    expect(rows[0].location).toBe('Kansas City, Missouri');
    expect(rows[1].location).toBe('United States');
    expect(rows[2].location).toBeNull();
  });

  test('sorts newest (highest startedAt) first', () => {
    const rows = buildQuickScorerRows([
      { id: 'old', startedAt: 100 },
      { id: 'new', startedAt: 300 },
      { id: 'mid', startedAt: 200 },
    ]);

    expect(rows.map(r => r.id)).toEqual(['new', 'mid', 'old']);
  });

  test('returns an empty array for no sessions', () => {
    expect(buildQuickScorerRows([])).toEqual([]);
    expect(buildQuickScorerRows(undefined)).toEqual([]);
  });
});
