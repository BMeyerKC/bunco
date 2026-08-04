# User Feedback — Design

**Date:** 2026-08-04
**Status:** Approved, ready for planning

## Problem

The app has no way for a user to tell us anything. Players hit confusion or bugs mid-game and the only signal we get is that they stop using it. We need a path that a non-technical user on a phone at a game night will actually take.

## Goals

- A feedback path reachable from every page, in one tap.
- Zero new services or dependencies — reuse Firebase RTDB and the existing admin dashboard.
- Capture diagnostic context automatically so the user doesn't have to describe where they were.
- Keep any contact information a user volunteers genuinely private.

## Non-goals

Email notifications on new feedback. Replying from inside the app. Screenshot capture. Spam or rate limiting beyond length caps. The Firebase Auth lockdown (tracked separately).

## Background: what the database currently exposes

The Firebase config ships in the client bundle, which is normal for web clients — RTDB rules are the only access control. Verified against production on 2026-08-04:

- `GET /games.json` returns **HTTP 200** unauthenticated. The whole games tree is public.
- `GET /originAudits.json` returns **Permission denied**. Rules were never published for that node when host-origin analytics shipped, and `game-controller.js:83` swallows the rejection with `.catch(() => {})`. That feature is silently collecting nothing.
- The admin passphrase gate is client-side (the SHA-256 hash is in the shipped JS), so it is not a read protection. Until Firebase Auth lands, "the admin page can read it" and "the public can read it" are the same statement.

Two consequences shape this design: publishing rules must be an explicit, verified step, and anything the admin page renders must be safe to be public.

## Design

### Entry point

A fixed pill at **bottom-right**, rendered on every page by `Layout.astro` — the corner users look to for feedback and live chat. The version tag moves from bottom-right to **bottom-left** to make room (`Layout.astro:44`, `right:0` → `left:0`).

```
┌─────────────────────────────────┐
│                          [ ☾ ]  │  ← theme toggle (fixed, top-right)
│                                 │
│          page content           │
│                                 │
│                ╭──────────────╮ │
│  v1.4          │ ✍ Feedback   │ │
└────────────────╰──────────────╯─┘
```

The scoring screen's `.score-topbar` and `.score-footer` center their content, so both bottom corners stay clear of controls.

Labeled, not icon-only — an unlabeled glyph does not read as "tell us something" to this audience. Styled to match `.theme-toggle`: `--surface` background, `--sketch` border, `var(--wobble-sm)` radius, slight rotation, `--shadow`, `z-index: 900`. All colors via semantic tokens; no palette hex.

`Layout.astro` takes a `showFeedback` prop defaulting to `true`. `admin.astro`, `debug.astro` and `tests.astro` pass `false` — those are internal tooling. `GameLayout.astro` wraps `Layout.astro`, so `game.astro` and `scorer.astro` inherit the widget through the default with no change needed.

### The form

A Bootstrap 5.3 modal. The bundle is already loaded in `Layout.astro`, and it provides focus trapping, Escape-to-close and backdrop handling. It honours the `data-bs-theme` attribute the app already sets, with token overrides so it reads as paper/chalkboard rather than stock Bootstrap.

- Heading: "Tell us what you think"
- Textarea, autofocused, `maxlength=1000`
- One optional input: "Name or email — only if you'd like a reply", `maxlength=200`
- **Send** disabled until the message contains non-whitespace
- Success → modal closes, `showToast('Thanks — we got it!', 'success')`
- Failure → modal stays open with the text intact, `showToast("Couldn't send — try again?", 'warning')`

Context is captured silently: page path, game code if present, app version, active theme, user agent, and the existing `bunco_device_id`.

### Data model

Two nodes sharing one push id, so a message and its contact can be correlated:

```
feedback/$id          { message, page, code, version, theme, ua, deviceId, createdAt }
feedbackContacts/$id  { contact, createdAt }
```

The id comes from `push(ref(db, 'feedback')).key` and is reused for both writes. The `feedbackContacts` write is skipped entirely when the field is blank, so most records will not have one.

`feedback` is world-readable and must stay free of personal data. `feedbackContacts` is never readable from the web.

### RTDB rules

RTDB rules cascade and cannot be revoked at a deeper level, which is why contact information lives at a sibling path rather than a child of `feedback`.

```json
"feedback": {
  ".read": true,
  ".indexOn": ["createdAt"],
  "$id": {
    ".write": "!data.exists()",
    ".validate": "newData.hasChildren(['message','createdAt']) && newData.child('message').isString() && newData.child('message').val().length <= 1000"
  }
},
"feedbackContacts": {
  "$id": {
    ".write": "!data.exists()",
    ".validate": "newData.child('contact').isString() && newData.child('contact').val().length <= 200"
  }
}
```

`".write": "!data.exists()"` makes records create-only — existing records cannot be edited or deleted. `feedbackContacts` has no `.read`, so it defaults to deny and is reachable only from the Firebase Console.

The same publish also adds the missing `originAudits` rules, fixing the silently broken host-origin analytics feature.

Rules currently live only in the Firebase Console, which is the direct cause of the `originAudits` bug — there was no reviewable artifact to notice was missing. This work brings them into the repo as `database.rules.json`, referenced by a new `firebase.json`, and publishes with `npx firebase-tools deploy --only database`. Rules become version-controlled and diffable from then on.

Because that deploy overwrites the live ruleset wholesale, the current live rules must be captured into the file first so nothing is silently dropped.

**Verification after publishing** — the check that was missing when origin analytics shipped:

1. `curl` a write to `feedback/` → expect success.
2. `curl` a read of `feedbackContacts/` → expect `Permission denied`.
3. `curl` a write to `originAudits/` → expect success.

### Modules

| File | Change |
|---|---|
| `firebase.json`, `.firebaserc`, `database.rules.json` | **new** — version-controlled RTDB rules |
| `src/components/FeedbackWidget.astro` | **new** — pill + modal markup |
| `src/js/feedback-logic.js` | **new** — pure: validation and payload construction |
| `src/js/feedback-controller.js` | **new** — wires DOM to Firebase |
| `src/js/firebase.js` | add `submitFeedback()`, `getFeedback()` |
| `src/styles/base.css` | `.feedback-fab` styles, modal token overrides |
| `src/layouts/Layout.astro` | render widget, `showFeedback` prop, move version tag |
| `src/pages/admin.astro` | Feedback section markup, and `showFeedback={false}` |
| `src/js/admin-controller.js` | `loadFeedback()` + render |
| `src/pages/debug.astro`, `src/pages/tests.astro` | pass `showFeedback={false}` |
| `tests/feedback-logic.test.js` | **new** |
| `e2e/feedback.spec.js` | **new** |

`feedback-logic.js` is pure and Firebase-free, mirroring the `game-logic.js` pattern:

- `validateFeedbackMessage(raw)` → `{ valid, message }`, rejecting empty and whitespace-only input.
- `buildFeedbackPayload(input)` → `{ feedback, contact }`, where `contact` is `null` when blank. Trims, applies the 1000/200 caps, and normalises absent optional fields to `null`.

`feedback-controller.js` owns DOM wiring and the Firebase call. It exports `initFeedback()` and does nothing if the widget markup is absent, so pages that opt out are unaffected.

### Admin view

A "Feedback" section above Recent Games: newest first, showing timestamp, message, page and game code, app version, and the record id.

The page cannot read `feedbackContacts`, so it cannot know whether a given record has a contact attached — a "contact provided" badge would be a guess. The record id is shown instead and is the lookup key for **Firebase Console → Realtime Database → `feedbackContacts`**.

Loaded by `loadFeedback()` with its own independent `try/catch`, following commit `aa345a4` — a feedback fetch failure must not take down the games list.

### Testing

**Jest** (`tests/feedback-logic.test.js`) — tests live in `tests/`, since `jest.config.js` sets `roots: ['<rootDir>/tests/']`. Run with `npm test`, never `npx jest`.

- rejects empty and whitespace-only messages
- trims surrounding whitespace
- enforces the 1000-character message and 200-character contact caps
- returns `contact: null` when the field is blank
- produces the documented payload shape with absent optionals as `null`

**Playwright** (`e2e/feedback.spec.js`)

- pill is visible on the home page
- clicking it opens the modal
- Send is disabled while the textarea is empty
- Escape closes the modal
- one real submit, message prefixed `[e2e]` so it is identifiable in the admin list

The existing specs already write real games to production, so a real submit is consistent with current practice. The trade-off is test records appearing in the feedback list.

## Risks

- **Unauthenticated writes.** Anyone can push to `feedback/`. Length caps and create-only writes limit the damage; volume abuse is accepted until Firebase Auth lands, consistent with the existing posture on `games`.
- **Public messages.** A user could type personal information into the message body, which is world-readable. Accepted — the contact field is the one we can control, and it is protected.
- **Bootstrap modal styling.** Stock Bootstrap may clash with the paper theme. Mitigated by token overrides, verified visually in both themes before merge.
