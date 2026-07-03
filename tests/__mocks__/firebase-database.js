const mockDb = {};
const mockRefs = {};

export const getDatabase = () => mockDb;

export const ref = (db, path) => {
  if (!mockRefs[path]) mockRefs[path] = { path };
  return mockRefs[path];
};

export const set = () => Promise.resolve();

export const get = () => Promise.resolve({ val: () => null });

export const update = () => Promise.resolve();

export const push = () => Promise.resolve();

export const onValue = (ref, callback) => {
  callback({ val: () => null });
};

export const off = () => {};

export const runTransaction = () => Promise.resolve();

export const serverTimestamp = () => Date.now();

export const query = (ref) => ref;

export const orderByChild = () => ({});

export const limitToLast = () => ({});
