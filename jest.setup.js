// Jest setup for Firebase mocking
import.meta.url = import.meta.url || `file://${__filename}`;

// Mock Firebase modules
const mockDb = {};
const mockRefs = {};

export const mockFirebase = {
  initializeApp: () => ({}),
  getDatabase: () => mockDb,
  ref: (db, path) => {
    if (!mockRefs[path]) mockRefs[path] = { path };
    return mockRefs[path];
  },
  set: () => Promise.resolve(),
  get: () => Promise.resolve({ val: () => null }),
  update: () => Promise.resolve(),
  push: () => Promise.resolve(),
  onValue: (ref, callback) => callback({ val: () => null }),
  off: () => {},
  runTransaction: () => Promise.resolve(),
  serverTimestamp: () => Date.now(),
};
