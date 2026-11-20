// js/admin-stats.js
//
// Pure helpers behind the admin dashboard's stats and charts. They take the
// rows built by buildGameRows() / buildQuickScorerRows() (or plain
// timestamps) and never touch the DOM or Firebase.

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight at or before `ts`. */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Counts timestamps per local calendar day for the last `days` days,
 * today included.
 * @param {number[]} timestamps  ms since epoch; falsy entries are skipped
 * @param {number} days
 * @param {number} [now]
 * @returns {Array<{ start: number, count: number }>} oldest day first
 */
export function dailyCounts(timestamps, days, now = Date.now()) {
  const buckets = [];
  const today = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    // Step via Date so DST days (23h / 25h) still land on midnight.
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ start: d.getTime(), count: 0 });
  }
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  for (const ts of timestamps) {
    if (!ts || ts < buckets[0].start || ts >= end.getTime()) continue;
    let i = buckets.length - 1;
    while (buckets[i].start > ts) i--;
    buckets[i].count++;
  }
  return buckets;
}

/**
 * How many timestamps fall in the last `days` days vs the `days` before that.
 * @returns {{ current: number, previous: number }}
 */
export function periodCounts(timestamps, days, now = Date.now()) {
  const span = days * DAY_MS;
  let current = 0, previous = 0;
  for (const ts of timestamps) {
    if (!ts) continue;
    const age = now - ts;
    if (age < 0) continue;
    if (age < span) current++;
    else if (age < 2 * span) previous++;
  }
  return { current, previous };
}

/** Median of a list of numbers, or null when empty. */
export function median(values) {
  const v = values.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Places ranked by how much Bunco happened there.
 * @param {Array<{ location: string|null }>} gameRows
 * @param {Array<{ location: string|null }>} sessionRows
 * @param {number} limit
 * @returns {Array<{ place: string, games: number, sessions: number, total: number }>}
 *   busiest first; rows with no location are left out
 */
export function topPlaces(gameRows, sessionRows, limit) {
  const byPlace = new Map();
  const bump = (place, key) => {
    if (!place) return;
    const entry = byPlace.get(place) ?? { place, games: 0, sessions: 0, total: 0 };
    entry[key]++;
    entry.total++;
    byPlace.set(place, entry);
  };
  for (const r of gameRows) bump(r.location, 'games');
  for (const r of sessionRows) bump(r.location, 'sessions');
  return [...byPlace.values()]
    .sort((a, b) => b.total - a.total || a.place.localeCompare(b.place))
    .slice(0, limit);
}
