// js/quick-scorer-logic.js
//
// Pure helpers for turning raw quickScorerSessions/ records into rows the
// admin dashboard can render. Kept separate from game-logic.js because the
// Quick Scorer has no game/code concept — see CONTEXT.md.

/**
 * @param {Array<{id, startedAt, lastSeenAt, city, region, country}>} sessions
 * @returns {Array<{id, startedAt, durationMs: number|null, location: string|null}>}
 *   sorted newest (highest startedAt) first
 */
export function buildQuickScorerRows(sessions) {
  return (sessions || [])
    .map(s => ({
      id: s.id,
      startedAt: s.startedAt,
      durationMs: s.lastSeenAt ? s.lastSeenAt - s.startedAt : null,
      location: [s.city, s.region].filter(Boolean).join(', ') || s.country || null,
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
