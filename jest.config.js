module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  clearMocks: true,
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts', '!src/server.ts'],
  coverageDirectory: '<rootDir>/coverage',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // Integration suites talk to Postgres and Redis, so they need more headroom
  // than the default 5s.
  testTimeout: 30000,
  // NOTE: run serially (`npm test` passes --runInBand). Every integration suite
  // truncates the same veribot_test database between tests, so parallel workers
  // would wipe each other's fixtures mid-test. Use --maxWorkers=1 if invoking
  // Jest directly. BullMQ queue names are namespaced per NODE_ENV (see
  // src/config/queue.ts) so a test run never collides with a running dev server.
};
