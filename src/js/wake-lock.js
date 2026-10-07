// js/wake-lock.js — keep the phone screen on while a table is scoring.
// Best effort: unsupported browsers and denied requests are silently ignored.

let lock = null;
let wanted = false;

async function acquire() {
  if (!('wakeLock' in navigator) || lock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch {
    lock = null;
  }
}

/** Call from a user gesture (first tap); the lock is re-taken when the tab returns. */
export function keepScreenAwake() {
  if (!wanted) {
    wanted = true;
    document.addEventListener('visibilitychange', () => {
      if (wanted && document.visibilityState === 'visible') acquire();
    });
  }
  acquire();
}
