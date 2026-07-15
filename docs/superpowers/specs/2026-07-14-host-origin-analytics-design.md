# Host Origin Analytics Design

**Date:** 2026-07-14
**Status:** Approved

## Purpose

Start collecting basic usage-geography analytics: capture the IP address and resolved location (city/region/country) of the client that creates a game, so we can see where games are being played from. First step of a broader analytics effort.

## Out of Scope

- Capturing origin data for players joining a game (host-creation only, for now)
- A map or any visualization beyond a plain text column in the existing admin table
- Real authentication (Firebase Auth) — deferred to the already-planned Auth phase; the admin page's passphrase gate remains a client-side UI deterrent only, not real access control
- Non-geo analytics (referrer, user agent, device type, etc.)

---

## Data Schema

Origin data is written to `originAudits/{code}` — a **new top-level path**, separate from `games/{code}/events`.

Rationale: `games/{code}/events` is world-readable (anyone with a game code can view it via `debug.html?code=XXXX`). IP/location is more sensitive than gameplay events and shouldn't be exposed there.

```json
{
  "ip": "203.0.113.42",
  "city": "Kansas City",
  "region": "Missouri",
  "country": "US",
  "capturedAt": 1752500000000
}
```

Fields:
- `ip` — string, from the geolocation API response
- `city`, `region`, `country` — string, from the same response (may be `null` if the API can't resolve them)
- `capturedAt` — Firebase `serverTimestamp()`

One record per game code (`set`, not `push` — a game has exactly one host/creation event).

### Firebase Rules

Add to the production RTDB rules (see `bunco-firebase-rules` memory for the CLI edit method — requires explicit confirmation before pushing, since it changes production rules):

```json
"originAudits": {
  ".read": true,
  "$code": { ".write": true }
}
```

`.read: true` is required so the admin dashboard (a plain unauthenticated Firebase client, gated only by a client-side passphrase check — see Admin Dashboard section below) can read this data. This matches the trust model already accepted for the `games` tree: no real access control until the planned Firebase Auth phase, at which point both trees get locked down together. IP/location data is technically world-readable via direct Firebase REST calls, same as game state already is; it stays out of the *public-facing* debug page only because nothing links to it or queries it from there.

---

## Implementation

### New file: `src/js/geo.js`

```js
export async function captureOrigin() {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`geo lookup failed: ${res.status}`);
  const data = await res.json();
  return {
    ip: data.ip ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    country: data.country_name ?? null,
  };
}
```

Uses `ipapi.co` — free, no API key, HTTPS/CORS-friendly, ~30k requests/month on the free tier (comfortably enough for this app's traffic). Ad blockers and privacy extensions commonly block IP-detection domains; this is expected and handled by the fire-and-forget call pattern below, not treated as an error condition.

### `firebase.js` changes

```js
export async function logGameOrigin(code, origin) {
  await set(ref(db, `originAudits/${code}`), { ...origin, capturedAt: serverTimestamp() });
}
```

### `game-controller.js` changes

In `handleCreateGame()`, right after the existing `logEvent(gameCode, EVENT.GAME_CREATED, ...)` line, add a fire-and-forget call using the same pattern already established for event logging:

```js
captureOrigin().then(origin => logGameOrigin(gameCode, origin)).catch(() => {});
```

This must never block game creation or surface an error to the host — geo lookup failure (blocked, offline, rate-limited) is silently swallowed, identical to how `logEvent(...).catch(() => {})` already behaves on the preceding line.

### Admin Dashboard changes

`getRecentGames` in `firebase.js` already loads the last 25 games for `admin.html`. Add a sibling function to load origin data in the same pass:

```js
export async function getOriginAudits() {
  const snap = await get(ref(db, 'originAudits'));
  const result = snap.exists() ? snap.val() : {};
  logReceive('originAudits', `${Object.keys(result).length} records`);
  return result;
}
```

`buildGameRows` in `game-logic.js` gains an optional second parameter so it can join origin data by game code:

```js
export function buildGameRows(games, origins = {}) {
  return (games || [])
    .map(g => {
      const o = origins[g.code];
      const location = o ? [o.city, o.region].filter(Boolean).join(', ') || o.country || null : null;
      return {
        code: g.code,
        createdAt: g.meta?.createdAt ?? 0,
        status: gameStatus(g.meta),
        playerCount: Object.values(g.players || {}).filter(p => !p.isGhost).length,
        location,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

`admin-controller.js`'s `loadGames()` fetches both in parallel (`Promise.all([getRecentGames(25), getOriginAudits()])`) and passes origins into `buildGameRows`. `renderGames()` gets a new `<th>Location</th>` column, rendering `row.location || '—'`.

---

## Testing

- Jest test for `captureOrigin()`: mock `fetch`, verify the returned shape on success, verify it throws/rejects cleanly on a non-OK response (caller is responsible for swallowing).
- Jest test for `logGameOrigin()`: mirrors the existing mock pattern in `tests/firebase-event.test.js`, verifying it writes to `originAudits/{code}` with the expected shape.
- Jest test for `getOriginAudits()`: mocks `get()`, verifies it returns `{}` on an empty snapshot and the raw map otherwise.
- Jest test for `buildGameRows(games, origins)`: verifies the `location` join (city+region, city-only, country fallback, and no-match → `null`) without touching Firebase.
- No e2e coverage for the geo capture itself — real external network call, not worth mocking in Playwright for this pass. Confirmed `e2e/admin.spec.js` has no column-specific assertions on the Recent Games table, so the new Location column needs no e2e changes.

---

## Future Considerations

- Could extend capture to player-join events, not just host-creation, if per-player geography becomes useful.
- `ipapi.co` free tier could be swapped for a paid tier or alternate provider (e.g. `geojs.io`) if volume grows.
- When the Firebase Auth phase lands, `originAudits` and `games` should be locked down together (see `bunco-firebase-rules` memory).
