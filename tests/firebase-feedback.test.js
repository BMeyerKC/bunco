import { submitFeedback, getFeedback } from '../src/js/firebase.js';
import { __seedSnapshot, __resetMock } from 'firebase/database';

afterEach(() => {
  __resetMock();
});

const sample = {
  message: 'The round counter confused me.',
  page: '/game.html?code=AB2D', code: 'AB2D', version: '1.4.0',
  theme: 'light', ua: 'Mozilla/5.0', deviceId: 'k3j4h5g6',
};

describe('submitFeedback', () => {
  test('resolves to a push id', async () => {
    const id = await submitFeedback(sample, null);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('resolves when a contact is supplied', async () => {
    await expect(submitFeedback(sample, 'player@example.com')).resolves.toEqual(expect.any(String));
  });

  test('does not log the contact value to the console', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await submitFeedback(sample, 'player@example.com');
    const logged = spy.mock.calls.flat().map(a => JSON.stringify(a)).join(' ');
    expect(logged).not.toContain('player@example.com');
    spy.mockRestore();
  });
});

describe('getFeedback', () => {
  test('returns an empty array when there is no data', async () => {
    await expect(getFeedback()).resolves.toEqual([]);
  });

  test('returns seeded records newest first, with id populated from the child key', async () => {
    // Seeded in ascending order (oldest first), mirroring what a real
    // orderByChild('createdAt') query returns before getFeedback reverses it.
    __seedSnapshot('feedback', {
      'id-1': { message: 'first', page: '/a', code: 'A1', version: '1.0', theme: 'light', ua: 'ua1', deviceId: 'd1', createdAt: 100 },
      'id-2': { message: 'second', page: '/b', code: 'B2', version: '1.0', theme: 'dark', ua: 'ua2', deviceId: 'd2', createdAt: 200 },
      'id-3': { message: 'third', page: '/c', code: 'C3', version: '1.0', theme: 'light', ua: 'ua3', deviceId: 'd3', createdAt: 300 },
    });

    const result = await getFeedback();

    expect(result.map(r => r.id)).toEqual(['id-3', 'id-2', 'id-1']);
    expect(result[0]).toEqual({
      id: 'id-3', message: 'third', page: '/c', code: 'C3', version: '1.0',
      theme: 'light', ua: 'ua3', deviceId: 'd3', createdAt: 300,
    });
  });
});
