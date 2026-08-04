import { submitFeedback, getFeedback } from '../src/js/firebase.js';

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
});
