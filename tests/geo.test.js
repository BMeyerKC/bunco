import { captureOrigin } from '../src/js/geo.js';

describe('captureOrigin', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('maps a successful response to the expected shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ip: '203.0.113.42',
        city: 'Kansas City',
        region: 'Missouri',
        country_name: 'United States',
      }),
    });

    const result = await captureOrigin();

    expect(result).toEqual({
      ip: '203.0.113.42',
      city: 'Kansas City',
      region: 'Missouri',
      country: 'United States',
    });
    expect(global.fetch).toHaveBeenCalledWith('https://ipapi.co/json/');
  });

  test('fills missing fields with null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await captureOrigin();

    expect(result).toEqual({ ip: null, city: null, region: null, country: null });
  });

  test('throws when the response is not OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(captureOrigin()).rejects.toThrow('geo lookup failed: 503');
  });
});
