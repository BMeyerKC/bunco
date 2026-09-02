import { startQuickScorerSession, heartbeatQuickScorerSession, getQuickScorerSessions } from '../src/js/firebase.js';
import { __seedSnapshot, __resetMock } from 'firebase/database';

afterEach(() => {
  __resetMock();
});

describe('startQuickScorerSession', () => {
  test('resolves to a push id', async () => {
    const id = await startQuickScorerSession({ ip: '1.2.3.4', city: 'X', region: 'Y', country: 'Z' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('resolves when no origin is supplied', async () => {
    await expect(startQuickScorerSession()).resolves.toEqual(expect.any(String));
  });
});

describe('heartbeatQuickScorerSession', () => {
  test('resolves without throwing', async () => {
    await expect(heartbeatQuickScorerSession('mock-key-1')).resolves.toBeUndefined();
  });
});

describe('getQuickScorerSessions', () => {
  test('returns an empty array when there is no data', async () => {
    await expect(getQuickScorerSessions()).resolves.toEqual([]);
  });

  test('returns seeded records newest first, with id populated from the child key', async () => {
    // Seeded in ascending order (oldest first), mirroring what a real
    // orderByChild('startedAt') query returns before getQuickScorerSessions reverses it.
    __seedSnapshot('quickScorerSessions', {
      'id-1': { startedAt: 100, lastSeenAt: 140, city: 'X', region: 'Y', country: 'Z' },
      'id-2': { startedAt: 200, lastSeenAt: 260, city: 'A', region: 'B', country: 'C' },
    });

    const result = await getQuickScorerSessions();

    expect(result.map(r => r.id)).toEqual(['id-2', 'id-1']);
    expect(result[0]).toEqual({
      id: 'id-2', startedAt: 200, lastSeenAt: 260, city: 'A', region: 'B', country: 'C',
    });
  });
});
