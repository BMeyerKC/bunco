export default {
  testEnvironment: 'jsdom',
  transform: {},
  roots: ['<rootDir>/tests/'],
  injectGlobals: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '^firebase/app$': '<rootDir>/tests/__mocks__/firebase-app.js',
    '^firebase/database$': '<rootDir>/tests/__mocks__/firebase-database.js',
  },
};
