// js/ui.js

/**
 * Shows one view div and hides all others.
 * @param {string} viewId - The id of the div to show
 */
export function showView(viewId) {
  document.querySelectorAll('[data-view]').forEach(el => {
    const active = el.id === viewId;
    el.classList.toggle('view-active', active);
    if (active) {
      el.style.removeProperty('display');
    } else {
      el.style.display = 'none';
    }
  });
}

/**
 * Shows a toast notification styled by .app-toast classes in base.css.
 * @param {string} message
 * @param {'info'|'success'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bunco-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'bunco-toast';
  toast.className = `app-toast app-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * Returns query param value from current URL.
 * @param {string} key
 * @returns {string|null}
 */
export function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Returns a random device ID, persisted in localStorage.
 * Used to identify the host device.
 * @returns {string}
 */
export function getDeviceId() {
  let id = localStorage.getItem('bunco_device_id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem('bunco_device_id', id);
  }
  return id;
}

const LAST_CODE_KEY = 'bunco_last_code';

/**
 * Remembers the most recently hosted/joined game code, so the home page can
 * offer a way back in if the player navigates away (e.g. the browser back
 * button) without finishing. Separate from the per-game identity keys
 * (bunco_host_code, bunco_player_<code>) — this is purely "what to resume",
 * not "who am I in that game".
 * @param {string} code
 */
export function rememberActiveGame(code) {
  localStorage.setItem(LAST_CODE_KEY, code);
}

/**
 * @returns {string|null} the most recently remembered game code, if any
 */
export function getActiveGame() {
  return localStorage.getItem(LAST_CODE_KEY);
}

/**
 * Stops the home page from offering to resume the remembered game — call
 * when the player dismisses the resume banner, or explicitly leaves a game.
 */
export function forgetActiveGame() {
  localStorage.removeItem(LAST_CODE_KEY);
}
