// js/ui.js

/**
 * Shows one view div and hides all others.
 * @param {string} viewId - The id of the div to show
 */
export function showView(viewId) {
  document.querySelectorAll('[data-view]').forEach(el => {
    const active = el.id === viewId;
    el.classList.toggle('view-active', active);
    // Remove any inline display so Bootstrap's d-flex or browser default takes over when shown.
    if (active) el.style.removeProperty('display');
  });
}

/**
 * Shows a Bootstrap toast-style notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'} type
 */
export function showToast(message, type = 'info') {
  const existing = document.getElementById('bunco-toast');
  if (existing) existing.remove();

  const colors = { info: '#0d6efd', success: '#198754', warning: '#ffc107' };
  const toast = document.createElement('div');
  toast.id = 'bunco-toast';
  toast.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: ${colors[type]}; color: #fff; padding: 12px 24px;
    border-radius: 6px; font-size: 1rem; z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  `;
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
