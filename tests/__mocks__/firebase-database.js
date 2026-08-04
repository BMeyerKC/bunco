const mockDb = {};
const mockRefs = {};

// Snapshot data keyed by path, seeded via __seedSnapshot() for tests that
// need `get()` to return real children instead of the empty default.
let mockSnapshotData = {};

export const getDatabase = () => mockDb;

export const ref = (db, path) => {
  if (!mockRefs[path]) mockRefs[path] = { path };
  return mockRefs[path];
};

export const set = () => Promise.resolve();

// Defaults to the original empty snapshot (`val()` -> null, `forEach` never
// invokes its callback) unless a test has seeded data for this ref's path
// via __seedSnapshot(). This keeps every existing suite's behavior — e.g.
// getOriginAudits's `snap.val() || {}` — unchanged when nothing was seeded.
export const get = (r) => {
  const path = r && r.path;
  const data = path !== undefined ? mockSnapshotData[path] : undefined;
  if (!data) {
    return Promise.resolve({ val: () => null, forEach: () => {} });
  }
  const keys = Object.keys(data);
  return Promise.resolve({
    val: () => data,
    forEach: (cb) => {
      keys.forEach(key => cb({ key, val: () => data[key] }));
    },
  });
};

export const update = () => Promise.resolve();

let pushCounter = 0;
export const push = (ref) => ({
  path: ref && ref.path,
  key: `mock-key-${++pushCounter}`,
});

/**
 * Test helper: seeds the object `get(ref(db, path))` will resolve as a
 * snapshot's children. `data` should be an object keyed by child id,
 * mirroring real RTDB shape, e.g. { key1: { foo: 1 }, key2: { foo: 2 } }.
 */
export const __seedSnapshot = (path, data) => {
  mockSnapshotData[path] = data;
};

/**
 * Test helper: clears seeded snapshot data and the push-id counter.
 * Call between tests so seeding in one test can't leak into the next.
 */
export const __resetMock = () => {
  mockSnapshotData = {};
  pushCounter = 0;
};

export const onValue = (ref, callback) => {
  callback({ val: () => null });
};

export const off = () => {};

export const runTransaction = () => Promise.resolve();

export const serverTimestamp = () => Date.now();

export const query = (ref) => ref;

export const orderByChild = () => ({});

export const limitToLast = () => ({});
