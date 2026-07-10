// tests/theme.test.js
import {
  resolveTheme,
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  currentTheme,
  toggleTheme,
} from '../src/js/theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-bs-theme');
});

describe('resolveTheme', () => {
  test('stored light wins over system dark', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });
  test('stored dark wins over system light', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  test('no stored value falls back to system dark', () => {
    expect(resolveTheme(null, true)).toBe('dark');
  });
  test('no stored value falls back to system light', () => {
    expect(resolveTheme(null, false)).toBe('light');
  });
  test('invalid stored value falls back to system', () => {
    expect(resolveTheme('purple', true)).toBe('dark');
  });
});

describe('applyTheme', () => {
  test('sets both data-theme and data-bs-theme on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });
});

describe('stored theme', () => {
  test('setStoredTheme persists and getStoredTheme reads it back', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(localStorage.getItem('bunco_theme')).toBe('dark');
  });
  test('getStoredTheme returns null when localStorage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getStoredTheme()).toBeNull();
    spy.mockRestore();
  });
});

describe('toggleTheme', () => {
  test('flips light to dark, applies it, and persists', () => {
    applyTheme('light');
    expect(toggleTheme()).toBe('dark');
    expect(currentTheme()).toBe('dark');
    expect(localStorage.getItem('bunco_theme')).toBe('dark');
  });
  test('flips dark to light', () => {
    applyTheme('dark');
    expect(toggleTheme()).toBe('light');
    expect(currentTheme()).toBe('light');
  });
});
