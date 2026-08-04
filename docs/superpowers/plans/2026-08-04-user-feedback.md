# User Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every page a one-tap feedback pill that writes to Firebase, with messages visible in the admin dashboard and any volunteered contact information kept unreadable from the web.

**Architecture:** A `FeedbackWidget.astro` component renders a fixed bottom-right pill plus a Bootstrap modal, included by `Layout.astro` on every page except internal tooling. Pure validation and payload construction live in `feedback-logic.js` (Firebase-free, unit tested); `feedback-controller.js` wires DOM to Firebase. Messages go to a world-readable `feedback/` node, contact information to a write-only `feedbackContacts/` sibling sharing the same push id.

**Tech Stack:** Astro 6, Bootstrap 5.3 (already loaded via CDN in `Layout.astro`), Firebase Realtime Database, Jest (unit), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-08-04-user-feedback-design.md`

## Global Constraints

- Run unit tests with `npm test`. Plain `npx jest` FAILS on ESM imports — never use it.
- Jest only discovers tests under `tests/` (`jest.config.js` sets `roots: ['<rootDir>/tests/']`). A test file placed next to its source will silently never run.
- All colors must come from the semantic tokens in `src/styles/base.css` (`--surface`, `--ink`, `--sketch`, `--accent`, …). Never hardcode palette hex in components, CSS, or inline JS styles.
- The `feedback/` node is world-readable. Never write personal data into it — contact information goes to `feedbackContacts/` only.
- Never `console.log` the contact value. `logSend` calls for contacts must redact.
- Message cap: 1000 characters. Contact cap: 200 characters. These exact numbers are enforced in three places (HTML `maxlength`, `feedback-logic.js`, RTDB `.validate`) and must agree.
- `docs/` is gitignored; specs and plans are committed with `git add -f`.
- Commit after every task.

---

### Task 1: Pure feedback logic

**Files:**
- Create: `src/js/feedback-logic.js`
- Test: `tests/feedback-logic.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_MESSAGE_LENGTH: number` (1000)
  - `MAX_CONTACT_LENGTH: number` (200)
  - `validateFeedbackMessage(raw: string) → { valid: boolean, message: string }`
  - `buildFeedbackPayload(input: { message, contact, page, code, version, theme, ua, deviceId }) → { feedback: object, contact: string|null }`

Note: `buildFeedbackPayload` deliberately does NOT set `createdAt`. Timestamps are not pure — `firebase.js` adds `serverTimestamp()` in Task 2.

- [ ] **Step 1: Write the failing test**

Create `tests/feedback-logic.test.js`:

```js
import {
  validateFeedbackMessage,
  buildFeedbackPayload,
  MAX_MESSAGE_LENGTH,
  MAX_CONTACT_LENGTH,
} from '../src/js/feedback-logic.js';

const fullInput = {
  message:  '  The round counter confused me.  ',
  contact:  '  player@example.com  ',
  page:     '/game.html?code=AB2D',
  code:     'AB2D',
  version:  '1.4.0',
  theme:    'light',
  ua:       'Mozilla/5.0 (iPhone)',
  deviceId: 'k3j4h5g6',
};

describe('validateFeedbackMessage', () => {
  test('rejects an empty string', () => {
    expect(validateFeedbackMessage('')).toEqual({ valid: false, message: '' });
  });

  test('rejects whitespace-only input', () => {
    expect(validateFeedbackMessage('   \n\t  ')).toEqual({ valid: false, message: '' });
  });

  test('rejects a non-string', () => {
    expect(validateFeedbackMessage(undefined)).toEqual({ valid: false, message: '' });
  });

  test('trims surrounding whitespace', () => {
    expect(validateFeedbackMessage('  hello  ')).toEqual({ valid: true, message: 'hello' });
  });

  test('caps the message at MAX_MESSAGE_LENGTH', () => {
    const result = validateFeedbackMessage('x'.repeat(MAX_MESSAGE_LENGTH + 50));
    expect(result.valid).toBe(true);
    expect(result.message).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});

describe('buildFeedbackPayload', () => {
  test('builds the documented feedback shape', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(feedback).toEqual({
      message:  'The round counter confused me.',
      page:     '/game.html?code=AB2D',
      code:     'AB2D',
      version:  '1.4.0',
      theme:    'light',
      ua:       'Mozilla/5.0 (iPhone)',
      deviceId: 'k3j4h5g6',
    });
  });

  test('never puts contact information in the feedback payload', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(JSON.stringify(feedback)).not.toContain('player@example.com');
  });

  test('returns the trimmed contact separately', () => {
    expect(buildFeedbackPayload(fullInput).contact).toBe('player@example.com');
  });

  test('returns null contact when the field is blank', () => {
    expect(buildFeedbackPayload({ ...fullInput, contact: '   ' }).contact).toBeNull();
  });

  test('returns null contact when the field is absent', () => {
    expect(buildFeedbackPayload({ message: 'hi' }).contact).toBeNull();
  });

  test('caps the contact at MAX_CONTACT_LENGTH', () => {
    const contact = 'a'.repeat(MAX_CONTACT_LENGTH + 50);
    expect(buildFeedbackPayload({ message: 'hi', contact }).contact)
      .toHaveLength(MAX_CONTACT_LENGTH);
  });

  test('normalises absent optional fields to null', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi' });
    expect(feedback).toEqual({
      message: 'hi', page: null, code: null,
      version: null, theme: null, ua: null, deviceId: null,
    });
  });

  test('truncates a very long user agent', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', ua: 'u'.repeat(500) });
    expect(feedback.ua).toHaveLength(300);
  });

  test('throws when the message is empty', () => {
    expect(() => buildFeedbackPayload({ message: '   ' })).toThrow('feedback-message-empty');
  });

  test('does not set createdAt — that is firebase.js’s job', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(feedback.createdAt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- feedback-logic`
Expected: FAIL — `Cannot find module '../src/js/feedback-logic.js'`

- [ ] **Step 3: Write the implementation**

Create `src/js/feedback-logic.js`:

```js
// js/feedback-logic.js — pure feedback validation and payload construction.
// No Firebase, no DOM, no clock. Mirrors the game-logic.js pattern.

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_CONTACT_LENGTH = 200;
const MAX_UA_LENGTH = 300;

/**
 * Validates and normalises a raw feedback message.
 * @param {string} raw
 * @returns {{ valid: boolean, message: string }}
 */
export function validateFeedbackMessage(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { valid: false, message: '' };
  return { valid: true, message: trimmed.slice(0, MAX_MESSAGE_LENGTH) };
}

/**
 * Splits raw form input into the two payloads that get written to
 * separate database nodes. The feedback payload is world-readable, so
 * contact information must never appear in it.
 * @param {object} input
 * @returns {{ feedback: object, contact: string|null }}
 * @throws {Error} 'feedback-message-empty' when the message is blank
 */
export function buildFeedbackPayload(input = {}) {
  const { valid, message } = validateFeedbackMessage(input.message);
  if (!valid) throw new Error('feedback-message-empty');

  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';

  return {
    feedback: {
      message,
      page:     input.page     || null,
      code:     input.code     || null,
      version:  input.version  || null,
      theme:    input.theme    || null,
      ua:       input.ua ? String(input.ua).slice(0, MAX_UA_LENGTH) : null,
      deviceId: input.deviceId || null,
    },
    contact: contact ? contact.slice(0, MAX_CONTACT_LENGTH) : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- feedback-logic`
Expected: PASS, 15 tests

- [ ] **Step 5: Run the full suite to check nothing regressed**

Run: `npm test`
Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
git add src/js/feedback-logic.js tests/feedback-logic.test.js
git commit -m "feat: add pure feedback validation and payload logic"
```

---

### Task 2: Firebase layer

**Files:**
- Modify: `src/js/firebase.js` (append a new section after the Origin analytics section, before Admin)
- Modify: `tests/__mocks__/firebase-database.js:13` (`get`), `:17` (`push`)
- Test: `tests/firebase-feedback.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (the controller in Task 5 composes them).
- Produces:
  - `submitFeedback(feedback: object, contact: string|null) → Promise<string>` — returns the push id
  - `getFeedback(limit?: number) → Promise<Array<{id, message, page, code, version, theme, ua, deviceId, createdAt}>>` — newest first

**Why the mock changes:** `submitFeedback` needs `push(...).key` to correlate the two nodes, and `getFeedback` needs `snapshot.forEach`. The current mock's `push` returns a bare `Promise` and its `get` returns `{ val }` only. `addPlayer` and `getRecentGames` already depend on these and would fail the same way — they simply have no tests today.

- [ ] **Step 1: Write the failing test**

Create `tests/firebase-feedback.test.js`:

```js
import { submitFeedback, getFeedback } from '../src/js/firebase.js';

const sample = {
  message: 'The round counter confused me.',
  page: '/game.html?code=AB2D', code: 'AB2D', version: '1.4.0',
  theme: 'light', ua: 'Mozilla/5.0', deviceId: 'k3j4h5g6',
};

describe('submitFeedback', () => {
  test('resolves to a push id', async () => {
    const id = await submitFeedback(sample, null);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('resolves when a contact is supplied', async () => {
    await expect(submitFeedback(sample, 'player@example.com')).resolves.toEqual(expect.any(String));
  });

  test('does not log the contact value to the console', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await submitFeedback(sample, 'player@example.com');
    const logged = spy.mock.calls.flat().map(a => JSON.stringify(a)).join(' ');
    expect(logged).not.toContain('player@example.com');
    spy.mockRestore();
  });
});

describe('getFeedback', () => {
  test('returns an empty array when there is no data', async () => {
    await expect(getFeedback()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- firebase-feedback`
Expected: FAIL — `submitFeedback is not a function`

- [ ] **Step 3: Extend the Jest Firebase mock**

In `tests/__mocks__/firebase-database.js`, replace the `get` export (line 13):

```js
export const get = () => Promise.resolve({ val: () => null, forEach: () => {} });
```

and replace the `push` export (line 17):

```js
let pushCounter = 0;
export const push = (ref) => ({
  path: ref && ref.path,
  key: `mock-key-${++pushCounter}`,
});
```

- [ ] **Step 4: Add the Firebase functions**

In `src/js/firebase.js`, insert after the Origin analytics section and before `// ─── Admin ───`:

```js
// ─── Feedback ────────────────────────────────────────────────

/**
 * Writes a feedback message and, optionally, the sender's contact info.
 * The two land in separate nodes sharing one push id: `feedback/` is
 * world-readable, `feedbackContacts/` is write-only and readable solely
 * from the Firebase Console.
 * @param {object} feedback - from buildFeedbackPayload().feedback
 * @param {string|null} contact - from buildFeedbackPayload().contact
 * @returns {Promise<string>} the shared push id
 */
export async function submitFeedback(feedback, contact = null) {
  const feedbackRef = push(ref(db, 'feedback'));
  const id = feedbackRef.key;

  logSend(`feedback/${id}`, feedback);
  await set(feedbackRef, { ...feedback, createdAt: serverTimestamp() });

  if (contact) {
    // Never log the value — this node exists precisely to keep it private.
    logSend(`feedbackContacts/${id}`, '[redacted]');
    await set(ref(db, `feedbackContacts/${id}`), {
      contact,
      createdAt: serverTimestamp(),
    });
  }

  return id;
}

/**
 * Reads recent feedback, newest first.
 * @param {number} limit
 * @returns {Promise<Array<object>>}
 */
export async function getFeedback(limit = 50) {
  const q = query(ref(db, 'feedback'), orderByChild('createdAt'), limitToLast(limit));
  const snap = await get(q);
  const items = [];
  snap.forEach(child => {
    items.push({ id: child.key, ...child.val() });
  });
  logReceive(`feedback (limit ${limit})`, `${items.length} items`);
  return items.reverse();
}
```

No new imports are needed — `push`, `set`, `ref`, `get`, `query`, `orderByChild`, `limitToLast` and `serverTimestamp` are all already imported at the top of the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- firebase-feedback`
Expected: PASS, 4 tests

- [ ] **Step 6: Run the full suite — the mock change touches every Firebase test**

Run: `npm test`
Expected: all suites pass. If `firebase-origin` or `firebase-event` fail, the mock change is at fault — `getOriginAudits` does `snap.val() || {}` and must still receive `null` from `val()`.

- [ ] **Step 7: Commit**

```bash
git add src/js/firebase.js tests/__mocks__/firebase-database.js tests/firebase-feedback.test.js
git commit -m "feat: add submitFeedback and getFeedback database helpers"
```

---

### Task 3: Database rules in the repo, deployed and verified

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `database.rules.json`

**Interfaces:**
- Consumes: nothing.
- Produces: a live `feedback/` node that accepts writes, and a `feedbackContacts/` node that rejects reads.

**Why this task exists and why it comes before the UI:** host-origin analytics shipped broken because rules lived only in the Firebase console and were never published — `originAudits` returns `Permission denied` in production today, and `game-controller.js:83` swallows the rejection. Putting rules under version control removes that whole class of bug. Doing it before the UI means the submit path works the first time it is tried in a browser.

> ⚠️ **`firebase deploy --only database` overwrites the live rules with the contents of `database.rules.json`.** Step 1 exists to make sure that file is a faithful superset of what is live now. Do not skip it, and do not run the deploy in Step 5 without the user's explicit go-ahead.

- [ ] **Step 1: Capture the current live rules**

Try the CLI first:

```bash
npx firebase-tools database:settings:get rules --project bunco-60f5d
```

If that subcommand does not exist in the installed CLI version, ask the user to copy the current ruleset from **Firebase Console → Realtime Database → Rules** and paste it into the conversation.

Either way, confirm the captured JSON contains the `games` block before continuing.

- [ ] **Step 2: Create the Firebase project config**

Create `firebase.json`:

```json
{
  "database": {
    "rules": "database.rules.json"
  }
}
```

Create `.firebaserc`:

```json
{
  "projects": {
    "default": "bunco-60f5d"
  }
}
```

- [ ] **Step 3: Write the rules file**

Create `database.rules.json`. The `games` block must match what Step 1 captured — if the captured rules differ from what is written below, keep the captured version of `games` and only add the three new blocks.

```json
{
  "rules": {
    "games": {
      ".read": true,
      ".indexOn": ["meta/createdAt"],
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['meta'])"
      }
    },
    "originAudits": {
      ".read": true,
      "$code": {
        ".write": true
      }
    },
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
  }
}
```

Two things to understand before reviewing this:

- `".write": "!data.exists()"` makes records **create-only** — once written, nobody can edit or delete them.
- `feedbackContacts` has **no `.read`**, so it defaults to deny. RTDB rules cascade downward and cannot be revoked at a deeper level, which is exactly why contact information sits in a sibling node rather than a child of `feedback`.

- [ ] **Step 4: Confirm with the user before deploying**

Show the diff between the captured live rules and `database.rules.json`, and get an explicit go-ahead. This writes to production.

- [ ] **Step 5: Deploy**

```bash
npx firebase-tools deploy --only database --project bunco-60f5d
```

Expected: `✔ Deploy complete!`

- [ ] **Step 6: Verify the deployed rules behave as intended**

This is the check that was missing when origin analytics shipped. Run all four:

```bash
# 1. feedback accepts a write
curl -s -X POST -d '{"message":"[rules-check] hello","createdAt":1}' \
  "https://bunco-60f5d-default-rtdb.firebaseio.com/feedback.json"

# 2. feedback is readable
curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/feedback.json?shallow=true"

# 3. feedbackContacts accepts a write
curl -s -X POST -d '{"contact":"[rules-check]","createdAt":1}' \
  "https://bunco-60f5d-default-rtdb.firebaseio.com/feedbackContacts.json"

# 4. feedbackContacts REJECTS a read  ← the important one
curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/feedbackContacts.json?shallow=true"
```

Expected: 1 returns `{"name":"-N..."}`, 2 returns the record, 3 returns `{"name":"-N..."}`, **4 returns `{"error":"Permission denied"}`**.

If check 4 returns data, STOP — the privacy guarantee the user chose has failed. Do not continue.

Also confirm a message over 1000 characters is rejected:

```bash
curl -s -X POST -d "{\"message\":\"$(printf 'x%.0s' {1..1100})\",\"createdAt\":1}" \
  "https://bunco-60f5d-default-rtdb.firebaseio.com/feedback.json"
```

Expected: an error response — RTDB reports validation failures as an `{"error": ...}` body, so the exact wording may be a validation message rather than `Permission denied`. What matters is that it is **not** a `{"name":"-N..."}` success.

- [ ] **Step 7: Verify origin analytics is now working**

```bash
curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/originAudits.json?shallow=true"
```

Expected: `null` or a record — **not** `Permission denied`. It was denied before this task.

- [ ] **Step 8: Commit**

```bash
git add firebase.json .firebaserc database.rules.json
git commit -m "feat: version-control database rules; add feedback nodes

Adds feedback/ (world-readable) and feedbackContacts/ (write-only) rules,
and restores the originAudits rules that were never published when host
origin analytics shipped — that node has been rejecting every write."
```

---

### Task 4: Feedback widget markup, styles, and layout wiring

**Files:**
- Create: `src/components/FeedbackWidget.astro` (new `src/components/` directory)
- Modify: `src/styles/base.css` — add `--wobble-md` to the `:root` token block (after `--wobble-sm`, ~line 71), and append a feedback section after the `.theme-toggle` rules (~line 267)
- Modify: `src/layouts/Layout.astro:5-7` (props), `:38` (render), `:44` (version position)
- Modify: `src/pages/admin.astro:5`, `src/pages/debug.astro`, `src/pages/tests.astro` (opt out)

**Interfaces:**
- Consumes: nothing.
- Produces: DOM ids the Task 5 controller binds to — `#feedback-fab`, `#feedback-modal`, `#feedback-form` (carrying `data-version`), `#feedback-message`, `#feedback-contact`, `#feedback-send`.

At the end of this task the pill opens and closes the modal using Bootstrap's declarative `data-bs-*` attributes alone. No JavaScript of ours is involved yet, and Send stays permanently disabled — Task 5 enables it.

- [ ] **Step 1: Create the widget component**

Create `src/components/FeedbackWidget.astro`:

```astro
---
// src/components/FeedbackWidget.astro
// Fixed feedback pill + modal. Rendered by Layout.astro on every page
// that does not opt out via showFeedback={false}.
const version = import.meta.env.PUBLIC_VERSION || 'dev';
---
<button
  id="feedback-fab"
  class="feedback-fab"
  type="button"
  data-bs-toggle="modal"
  data-bs-target="#feedback-modal"
>
  <span aria-hidden="true">✍</span> Feedback
</button>

<div class="modal fade" id="feedback-modal" tabindex="-1"
     aria-labelledby="feedback-modal-title" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content feedback-modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="feedback-modal-title">Tell us what you think</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <form id="feedback-form" data-version={version}>
        <div class="modal-body">
          <label for="feedback-message" class="form-label">What's on your mind?</label>
          <textarea id="feedback-message" class="form-control" rows="5" maxlength="1000"
                    placeholder="Something confusing? Something broken? An idea?"></textarea>

          <label for="feedback-contact" class="form-label mt-3">
            Name or email
            <span style="color:var(--muted);font-weight:400;">— only if you'd like a reply</span>
          </label>
          <input id="feedback-contact" type="text" class="form-control"
                 maxlength="200" autocomplete="off" />
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" id="feedback-send" class="btn btn-primary" disabled>Send</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

The button needs no `aria-label` — its text content already names it.

- [ ] **Step 2: Add the `--wobble-md` token**

In `src/styles/base.css`, in the shared `:root` block, directly after the `--wobble-sm` line:

```css
  /* Larger surfaces need a gentler wobble — --wobble-sm's 125px radii
     read as a lozenge at modal size. */
  --wobble-md: 24px 8px 22px 10px / 10px 22px 8px 24px;
```

- [ ] **Step 3: Add the widget styles**

Append to `src/styles/base.css`, after the `.theme-toggle` rules:

```css
/* ── Feedback pill + modal (components/FeedbackWidget.astro) ── */
.feedback-fab {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-sm);
  box-shadow: var(--shadow);
  font-family: var(--font-body);
  font-size: var(--fs-small);
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transform: rotate(-2deg);
  transition: transform 0.15s ease;
}
.feedback-fab:hover { transform: rotate(2deg) scale(1.06); }

.feedback-modal-content {
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--sketch);
  border-radius: var(--wobble-md);
  box-shadow: var(--shadow);
}
.feedback-modal-content .modal-header,
.feedback-modal-content .modal-footer {
  border-color: var(--border);
}
.feedback-modal-content .modal-title {
  font-family: var(--font-hand);
}
.feedback-modal-content .form-label {
  font-weight: 700;
  font-size: var(--fs-small);
}
.feedback-modal-content .form-control {
  background: var(--bg);
  color: var(--ink);
  border: 2px solid var(--border);
}
.feedback-modal-content .form-control:focus {
  background: var(--bg);
  color: var(--ink);
  border-color: var(--sketch);
  box-shadow: none;
}
```

- [ ] **Step 4: Wire the widget into the layout**

In `src/layouts/Layout.astro`, change the frontmatter (lines 3-7):

```astro
---
// src/layouts/Layout.astro
import '../styles/base.css';
import FeedbackWidget from '../components/FeedbackWidget.astro';

type Props = { title: string; showFeedback?: boolean };
const { title, showFeedback = true } = Astro.props;
const version = import.meta.env.PUBLIC_VERSION || 'dev';
---
```

Add the widget immediately after `<slot />` (line 38):

```astro
  <slot />
  {showFeedback && <FeedbackWidget />}
```

Move the version tag to the bottom-left so the pill can own the bottom-right — change `right:0` to `left:0` in the footer style (line 44):

```astro
  <footer style="position:fixed;bottom:0;left:0;padding:4px 10px;font-size:var(--fs-caption);color:var(--very-muted);z-index:9999;pointer-events:none;">
```

`GameLayout.astro` wraps `Layout.astro` and passes only `title`, so `game.astro` and `scorer.astro` pick up the widget through the `showFeedback = true` default. No change needed there.

- [ ] **Step 5: Opt the internal pages out**

`src/pages/admin.astro` line 5:

```astro
<Layout title="Bunco Admin" showFeedback={false}>
```

`src/pages/debug.astro` line 4:

```astro
<Layout title="Bunco Debug" showFeedback={false}>
```

`src/pages/tests.astro` line 5:

```astro
<Layout title="Bunco — Test Results" showFeedback={false}>
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`

Check each of these:
- Home page: pill is at bottom-right, version tag is at bottom-left, neither overlaps the other.
- Clicking the pill opens the modal; Cancel, the × button, and Escape all close it.
- Toggle to dark mode — the pill and modal use chalkboard tokens, with no leftover white Bootstrap surfaces.
- Visit `/scorer.html` and confirm the pill does not cover the `.score-footer` controls (that footer centers its content, so the right edge should be free).
- Visit `/admin.html` — no pill.
- Narrow the window to a phone width and confirm the pill does not overlap page content.

- [ ] **Step 7: Commit**

```bash
git add src/components/FeedbackWidget.astro src/styles/base.css src/layouts/Layout.astro src/pages/admin.astro src/pages/debug.astro src/pages/tests.astro
git commit -m "feat: add feedback pill and modal to the shared layout

Moves the version tag to bottom-left so the pill can take the
bottom-right corner, where users look for feedback and chat."
```

---

### Task 5: Feedback controller

**Files:**
- Create: `src/js/feedback-controller.js`
- Modify: `src/layouts/Layout.astro:40-43` (the module script block)

**Interfaces:**
- Consumes: `validateFeedbackMessage`, `buildFeedbackPayload` (Task 1); `submitFeedback` (Task 2); `#feedback-form`, `#feedback-message`, `#feedback-contact`, `#feedback-send`, `#feedback-modal` (Task 4); `showToast`, `getParam`, `getDeviceId` from `src/js/ui.js`.
- Produces: `initFeedback() → void` — safe to call on pages without the widget.

- [ ] **Step 1: Write the controller**

Create `src/js/feedback-controller.js`:

```js
// js/feedback-controller.js — wires the FeedbackWidget DOM to Firebase.

import { submitFeedback } from './firebase.js';
import { validateFeedbackMessage, buildFeedbackPayload } from './feedback-logic.js';
import { showToast, getParam, getDeviceId } from './ui.js';

/**
 * Binds the feedback modal. No-ops on pages that opt out of the widget
 * (admin, debug, tests), where the markup is absent.
 */
export function initFeedback() {
  const form = document.getElementById('feedback-form');
  if (!form) return;

  const messageEl = document.getElementById('feedback-message');
  const contactEl = document.getElementById('feedback-contact');
  const sendBtn   = document.getElementById('feedback-send');
  const modalEl   = document.getElementById('feedback-modal');

  const syncSendButton = () => {
    sendBtn.disabled = !validateFeedbackMessage(messageEl.value).valid;
  };

  messageEl.addEventListener('input', syncSendButton);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateFeedbackMessage(messageEl.value).valid) return;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    try {
      const { feedback, contact } = buildFeedbackPayload({
        message:  messageEl.value,
        contact:  contactEl.value,
        page:     window.location.pathname + window.location.search,
        code:     getParam('code'),
        version:  form.dataset.version,
        theme:    document.documentElement.getAttribute('data-theme'),
        ua:       navigator.userAgent,
        deviceId: getDeviceId(),
      });

      await submitFeedback(feedback, contact);

      messageEl.value = '';
      contactEl.value = '';
      window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      showToast('Thanks — we got it!', 'success');
    } catch (err) {
      // Leave the text in place so a retry costs the user nothing.
      console.error('[feedback] submit failed', err);
      showToast("Couldn't send — try again?", 'warning');
    } finally {
      sendBtn.textContent = 'Send';
      syncSendButton();
    }
  });
}
```

`window.bootstrap` is the global exposed by the Bootstrap bundle already loaded in `Layout.astro:39`.

- [ ] **Step 2: Initialise it from the layout**

In `src/layouts/Layout.astro`, extend the existing module script (lines 40-43):

```astro
  <script>
    import { initTheme } from '../js/theme.js';
    import { initFeedback } from '../js/feedback-controller.js';
    initTheme();
    initFeedback();
  </script>
```

- [ ] **Step 3: Verify the happy path in the browser**

Run: `npm run dev`

- Open the modal. Send is disabled.
- Type only spaces — Send stays disabled.
- Type a real message — Send enables.
- Submit **without** a contact. The modal closes and a "Thanks — we got it!" toast appears.
- Submit **with** a contact from a page that has a game code, e.g. `/standings.html?code=TEST`.

- [ ] **Step 4: Verify what actually landed in the database**

```bash
curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/feedback.json" | tail -c 800
```

Confirm the record has `message`, `page`, `code`, `version`, `theme`, `ua`, `deviceId`, `createdAt` — and **no contact field**.

```bash
curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/feedbackContacts.json?shallow=true"
```

Expected: `{"error":"Permission denied"}`. Then open Firebase Console → Realtime Database → `feedbackContacts` and confirm the contact you typed is there, under the same push id as the feedback record.

- [ ] **Step 5: Verify the failure path**

In DevTools, set the Network tab to **Offline**, then submit. Expected: the modal stays open with the typed text intact, and a "Couldn't send — try again?" toast appears. Go back online and submit again — it should succeed.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: all suites pass

- [ ] **Step 7: Commit**

```bash
git add src/js/feedback-controller.js src/layouts/Layout.astro
git commit -m "feat: wire the feedback modal to Firebase"
```

---

### Task 6: Admin feedback section

**Files:**
- Modify: `src/pages/admin.astro` — new section between `#admin-stats` and `#admin-games`
- Modify: `src/js/admin-controller.js:1-2` (imports), `:9-13` (`init`), and append render functions

**Interfaces:**
- Consumes: `getFeedback` (Task 2).
- Produces: nothing consumed by later tasks.

**Critical constraint:** `loadFeedback()` must have its own independent `try/catch` and must not be awaited inside `loadGames()`'s try block. Commit `aa345a4` fixed exactly this failure mode when the origin-audit fetch took down the whole games list.

- [ ] **Step 1: Add the markup**

In `src/pages/admin.astro`, insert between the `#admin-stats` and `#admin-games` sections:

```html
    <section id="admin-feedback" class="mb-4">
      <h5 style="color:var(--muted);">Feedback</h5>
      <div id="feedback-list">
        <p style="color:var(--very-muted);">Loading…</p>
      </div>
    </section>
```

- [ ] **Step 2: Load it independently**

In `src/js/admin-controller.js`, change the import on line 2:

```js
import { getRecentGames, getOriginAudits, getFeedback } from './firebase.js';
```

and change `init` (lines 9-13) so a feedback failure cannot affect the games list:

```js
async function init() {
  await ensureAdminAccess();
  wireDebugJump();
  await Promise.allSettled([loadGames(), loadFeedback()]);
}
```

- [ ] **Step 3: Add the loader and renderer**

Append to `src/js/admin-controller.js`:

```js
async function loadFeedback() {
  const listEl = document.getElementById('feedback-list');
  try {
    const items = await getFeedback(50);
    renderFeedback(items, listEl);
  } catch (err) {
    console.error('[admin] failed to load feedback', err);
    listEl.innerHTML =
      '<p style="color:#dc2626;">Couldn’t load feedback. ' +
      '<button id="feedback-retry" class="btn btn-sm btn-outline-secondary ms-2">Retry</button></p>';
    document.getElementById('feedback-retry').addEventListener('click', loadFeedback);
  }
}

function renderFeedback(items, listEl) {
  listEl.innerHTML = '';

  if (items.length === 0) {
    listEl.innerHTML = '<p style="color:var(--very-muted);">No feedback yet.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.style.cssText =
      'background:var(--surface);border:1px solid var(--border);border-radius:8px;' +
      'padding:12px 16px;margin-bottom:10px;';

    const meta = document.createElement('div');
    meta.style.cssText =
      'font-size:var(--fs-caption);color:var(--very-muted);margin-bottom:6px;' +
      'display:flex;flex-wrap:wrap;gap:10px;';

    const when = document.createElement('span');
    when.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '—';

    const where = document.createElement('span');
    where.textContent = item.code ? `${item.page || '—'} · ${item.code}` : (item.page || '—');

    const ver = document.createElement('span');
    ver.textContent = `v${item.version || '?'} · ${item.theme || '?'}`;

    meta.append(when, where, ver);

    // Contact lives in the write-only feedbackContacts/ node, which this
    // page cannot read by design — so it cannot know whether one exists.
    // Surface the id instead; it is the console lookup key.
    const idEl = document.createElement('span');
    idEl.style.cssText = 'font-family:monospace;';
    idEl.textContent = item.id;
    meta.appendChild(idEl);

    const body = document.createElement('p');
    body.style.cssText = 'margin:0;color:var(--text);white-space:pre-wrap;';
    body.textContent = item.message || '';

    card.append(meta, body);
    listEl.appendChild(card);
  }
}
```

Note on contacts: because `feedbackContacts` is unreadable from the browser, this page genuinely cannot tell which records have a contact attached. Rendering a "✉ contact provided" badge would be a guess, so the plan shows the record id instead — paste it into **Firebase Console → Realtime Database → `feedbackContacts`** to see whether a contact exists and what it is. Do not try to read `feedbackContacts` from this page; it will fail by design, and making it succeed would undo the privacy decision.

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, open `/admin.html`, unlock with `bunco-boss`.

- The Feedback section renders the records submitted in Task 5, newest first.
- Recent Games still renders below it.
- In DevTools, block requests to `firebaseio.com`, reload, and confirm **both** sections show their own error with a working Retry — neither takes down the other.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin.astro src/js/admin-controller.js
git commit -m "feat: show recent feedback in the admin dashboard"
```

---

### Task 7: End-to-end coverage

**Files:**
- Create: `e2e/feedback.spec.js`

**Interfaces:**
- Consumes: the DOM ids from Task 4 and the behavior from Task 5.
- Produces: nothing.

The submit test writes a real record to production, prefixed `[e2e]` so it is identifiable in the admin list. This matches existing practice — `setup-game.spec.js` and friends already create real games.

- [ ] **Step 1: Write the spec**

Create `e2e/feedback.spec.js`:

```js
import { test, expect } from '@playwright/test';

const ADMIN_HASH = 'a57f283f67bd59fcf75862f28d197c83ea7047b098bb3469ae08396919ad7ab4';

test.describe('feedback widget', () => {
  test('the pill is visible on the home page and opens the modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#feedback-fab')).toBeVisible();
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-modal')).toBeVisible();
  });

  test('send stays disabled until the message has real content', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-send')).toBeDisabled();

    await page.fill('#feedback-message', '   ');
    await expect(page.locator('#feedback-send')).toBeDisabled();

    await page.fill('#feedback-message', 'The round counter confused me.');
    await expect(page.locator('#feedback-send')).toBeEnabled();
  });

  test('escape closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await expect(page.locator('#feedback-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#feedback-modal')).not.toBeVisible();
  });

  test('submitting sends the feedback and confirms', async ({ page }) => {
    await page.goto('/');
    await page.click('#feedback-fab');
    await page.fill('#feedback-message', `[e2e] automated check ${Date.now()}`);
    await page.click('#feedback-send');

    await expect(page.locator('#bunco-toast')).toHaveText('Thanks — we got it!');
    await expect(page.locator('#feedback-modal')).not.toBeVisible();
  });

  test('the pill is present on the scorer page', async ({ page }) => {
    await page.goto('/scorer.html');
    await expect(page.locator('#feedback-fab')).toBeVisible();
  });

  test('the pill is absent on the admin page', async ({ page }) => {
    await page.addInitScript(hash => localStorage.setItem('bunco_admin_unlock', hash), ADMIN_HASH);
    await page.goto('/admin.html');
    await expect(page.locator('#admin-links')).toBeVisible();
    await expect(page.locator('#feedback-fab')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test e2e/feedback.spec.js`
Expected: 6 passed

- [ ] **Step 3: Run the whole e2e suite**

Run: `npm run e2e`
Expected: all specs pass, and the report is copied into `public/playwright-report/`.

The version tag moved from bottom-right to bottom-left in Task 4 — if any existing spec asserted on its position, fix that spec now.

- [ ] **Step 4: Commit**

```bash
git add e2e/feedback.spec.js
git commit -m "test: add e2e coverage for the feedback widget"
```

---

## Final verification

- [ ] `npm test` — all unit suites pass
- [ ] `npm run e2e` — all e2e specs pass
- [ ] `npm run build` — builds clean
- [ ] `curl -s "https://bunco-60f5d-default-rtdb.firebaseio.com/feedbackContacts.json?shallow=true"` returns `Permission denied`
- [ ] Admin dashboard shows the submitted feedback, including the `[e2e]` records
- [ ] Pill renders correctly in both light and dark themes, on desktop and at phone width
- [ ] Delete the `[rules-check]` records from Task 3 via the Firebase Console

## Follow-ups (not in this plan)

- The `[e2e]` records accumulate in the feedback list on every e2e run. If that becomes noisy, either filter them out of the admin render or drop the submit test.
- `game-controller.js:83` swallows origin-logging failures with `.catch(() => {})`. Task 3 fixes the underlying rules, but the silent catch remains and would hide the next such failure.
- Firebase Auth phase: restrict the `games` root read, add code-format validation on writes, and replace the client-side admin passphrase gate.
