# Host Origin Analytics Design

**Date:** 2026-07-14
**Status:** Approved

## Purpose

Start collecting basic usage-geography analytics: capture the IP address and resolved location (city/region/country) of the client that creates a game, so we can see where games are being played from. First step of a broader analytics effort.

## Out of Scope

- Capturing origin data for players joining a game (host-creation only, for now)
- Any UI to view this data (admin dashboard column, map, etc.) — a follow-up once there's data to look at
- Authentication/access control changes beyond the new rule below
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
  "$code": { ".read": false, ".write": true }
}
```

Write-only from clients (matches the existing no-auth trust model used for `games`), unreadable except via the Firebase console. This keeps IP data out of the debug page and out of any future admin-dashboard read unless a read path is deliberately added later.

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

---

## Testing

- Jest test for `captureOrigin()`: mock `fetch`, verify the returned shape on success, verify it throws/rejects cleanly on a non-OK response (caller is responsible for swallowing).
- Jest test for `logGameOrigin()`: mirrors the existing mock pattern in `tests/firebase-event.test.js`, verifying it writes to `originAudits/{code}` with the expected shape.
- No e2e coverage — this hits a real external network call in production only; not worth mocking in Playwright for this pass.

---

## Future Considerations

- Admin dashboard could eventually show city/country per game (would need a new authenticated read path, since `originAudits` is write-only from clients).
- Could extend capture to player-join events, not just host-creation, if per-player geography becomes useful.
- `ipapi.co` free tier could be swapped for a paid tier or alternate provider (e.g. `geojs.io`) if volume grows.
