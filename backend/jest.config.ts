import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  testTimeout: 30000,
  // if you use path aliases in tsconfig, map them here via moduleNameMapper
};

export default config;
