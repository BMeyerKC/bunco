// js/quick-scorer-tracking.js
//
// Fire-and-forget usage tracking for the Quick Scorer (scorer.astro), which
// otherwise makes no network calls at all. Mirrors the origin-capture used
// for full games (see game-controller.js) but writes to its own
// quickScorerSessions/ node instead of a game's originAudits entry, since
// a Quick Scorer visit isn't a game. See quick-scorer-logic.js for how the
// admin dashboard turns these records into rows.

import { startQuickScorerSession, heartbeatQuickScorerSession } from './firebase.js';
import { captureOrigin } from './geo.js';

const HEARTBEAT_MS = 20_000;

init();

async function init() {
  const origin = await captureOrigin().catch(() => ({}));
  const sessionId = await startQuickScorerSession(origin).catch(() => null);
  if (!sessionId) return;

  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    heartbeatQuickScorerSession(sessionId).catch(() => {});
  }, HEARTBEAT_MS);
}
