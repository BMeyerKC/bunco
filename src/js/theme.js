// js/theme.js — light/dark theme resolution, persistence, and toggle.
// Initial pre-paint application happens in an inline script in Layout.astro
// (it can't import modules); resolveTheme is the single source of truth for
// the resolution rule, and the inline script mirrors it.

const STORAGE_KEY = 'bunco_theme';

/**
 * @param {string|null} stored - value from localStorage, if any
 * @param {boolean} systemPrefersDark
 * @returns {'light'|'dark'}
 */
export function resolveTheme(stored, systemPrefersDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Sets the theme on <html> for both our tokens and Bootstrap. */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
}

/** @returns {string|null} stored override, or null (also when storage is unavailable) */
export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage denied — theme still applies for this page view.
  }
}

/** @returns {'light'|'dark'} theme currently applied to <html> */
export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Flips the theme, applies it, persists it. @returns the new theme */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setStoredTheme(next);
  return next;
}

/**
 * Wires up the toggle button and follows live system changes
 * (only while the user has no manual override).
 */
export function initTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(resolveTheme(null, e.matches));
  });
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}
