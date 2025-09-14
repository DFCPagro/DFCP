import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only run integration tests in /tests/int
  testMatch: ['<rootDir>/tests/int/**/*.test.ts'],

  // Make sure we do NOT mock DB here (disable your mock-db setup)
  setupFiles: [],

  // Use our real in-memory Mongo bootstrap
  setupFilesAfterEnv: ['<rootDir>/tests/setup/int-db.ts', '<rootDir>/tests/setup/silence-logs.ts'],

  testTimeout: 30000, // transactions & aggregation can take a bit longer

  // optional coverage
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts', '!src/**/types/**'],
};

export default config;
