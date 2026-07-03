import { ensureAdminAccess } from './admin-gate.js';

init();

async function init() {
  await ensureAdminAccess();
}
