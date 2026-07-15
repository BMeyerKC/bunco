import { logGameOrigin, getOriginAudits } from '../src/js/firebase.js';

describe('logGameOrigin', () => {
  test('resolves without throwing', async () => {
    await expect(
      logGameOrigin('ABCD', { ip: '1.2.3.4', city: 'X', region: 'Y', country: 'Z' })
    ).resolves.toBeUndefined();
  });
});

describe('getOriginAudits', () => {
  test('returns an empty object when there is no data', async () => {
    const result = await getOriginAudits();
    expect(result).toEqual({});
  });
});
