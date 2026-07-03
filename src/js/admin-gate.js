// js/admin-gate.js
//
// V1 gate: client-side passphrase deterrent, NOT security (this is a static
// site — the check is readable in the bundle). The only contract with the
// rest of the app is ensureAdminAccess(); swapping these internals for
// Firebase Auth later must not change that signature.

const PASS_HASH   = 'a57f283f67bd59fcf75862f28d197c83ea7047b098bb3469ae08396919ad7ab4';
const STORAGE_KEY = 'bunco_admin_unlock';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves once the visitor is unlocked. Shows a passphrase overlay if the
 * device has no valid unlock marker; remembers the unlock per device.
 * @returns {Promise<void>}
 */
export function ensureAdminAccess() {
  if (localStorage.getItem(STORAGE_KEY) === PASS_HASH) return Promise.resolve();

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'admin-gate';
    overlay.style.cssText =
      'position:fixed;inset:0;background:var(--bg,#13111c);z-index:10000;' +
      'display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <form style="text-align:center;max-width:320px;width:100%;padding:24px;">
        <h4 style="margin-bottom:16px;color:var(--fg);">Admin</h4>
        <input id="admin-gate-pass" type="password" class="form-control mb-1"
               placeholder="Passphrase" autocomplete="current-password" autofocus />
        <p id="admin-gate-error" style="color:#dc2626;font-size:0.85rem;min-height:1.2em;margin:4px 0 8px;"></p>
        <button type="submit" class="btn btn-primary w-100">Unlock</button>
      </form>`;
    document.body.appendChild(overlay);

    overlay.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const entered = overlay.querySelector('#admin-gate-pass').value;
      const hash = await sha256Hex(entered);
      if (hash === PASS_HASH) {
        localStorage.setItem(STORAGE_KEY, hash);
        overlay.remove();
        resolve();
      } else {
        overlay.querySelector('#admin-gate-error').textContent = 'Wrong passphrase.';
      }
    });
  });
}
