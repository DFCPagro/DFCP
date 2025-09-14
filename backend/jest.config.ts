import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only look in /tests
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Keep junk out
  testPathIgnorePatterns: ['/node_modules/', '/coverage/', '/dist/', '/build/', '/data/'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/coverage/', '<rootDir>/dist/', '<rootDir>/build/', '<rootDir>/data/'],

  // ✅ Prevent real DB connects + silence noisy logs
  setupFiles: ['<rootDir>/tests/setup/mock-db.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/silence-logs.ts'],

  testTimeout: 15000,

  // Optional coverage
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts', '!src/**/types/**'],
};

export default config;
