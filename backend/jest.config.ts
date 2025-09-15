import type { Config } from "jest";

const mapper = { "^@/(.*)$": "<rootDir>/src/$1" };
const transformTs = {
  "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
};

const testPathIgnorePatterns = ["/node_modules/", "/coverage/", "/dist/", "/build/", "/data/"];
const modulePathIgnorePatterns = ["<rootDir>/node_modules/", "<rootDir>/coverage/", "<rootDir>/dist/", "<rootDir>/build/", "<rootDir>/data/"];

// If you install it: npm i -D jest-summarizing-reporter
const reportersCommon: Config["reporters"] = [
  "default",
  // Comment this in if you install it:
  // ["jest-summarizing-reporter", {
  //   failuresOnly: false,
  //   expand: false,
  //   colors: true,
  //   showSuiteDuration: true,
  //   showTestDuration: true,
  // }],
];

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",

  projects: [
    // -------------------- UNIT + SERVICE + HTTP --------------------
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/tests/unit/**/*.test.ts",
        "<rootDir>/tests/services/**/*.test.ts",
        "<rootDir>/tests/http/**/*.test.ts",
      ],
      setupFiles: ["<rootDir>/tests/setup/env.ts", "<rootDir>/tests/setup/mock-db.ts"],
      setupFilesAfterEnv: ["<rootDir>/tests/setup/silence-logs.ts"],
      moduleNameMapper: mapper,
      transform: transformTs,
      verbose: true,                  // <-- show individual test names
      reporters: reportersCommon,     // <-- nicer summary output
      testTimeout: 15_000,
      clearMocks: true,
      testPathIgnorePatterns,
      modulePathIgnorePatterns,
      collectCoverageFrom: ["src/**/*.ts", "!src/**/index.ts", "!src/**/types/**"],
    },

    // -------------------- INTEGRATION --------------------
    {
      displayName: "int",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/int/**/*.test.ts"],
      setupFilesAfterEnv: [
        "<rootDir>/tests/setup/silence-logs.ts",
        "<rootDir>/tests/setup/int-db.ts",
      ],
      moduleNameMapper: mapper,
      transform: transformTs,
      verbose: true,                  // <-- show individual test names
      reporters: reportersCommon,
      testTimeout: 30_000,
      clearMocks: true,
      maxWorkers: 1,
      testPathIgnorePatterns,
      modulePathIgnorePatterns,
    },

    // -------------------- E2E --------------------
    {
      displayName: "e2e",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/e2e/**/*.test.ts"],
      setupFilesAfterEnv: [
        "<rootDir>/tests/setup/silence-logs.ts",
        "<rootDir>/tests/setup/int-db.ts",
      ],
      moduleNameMapper: mapper,
      transform: transformTs,
      verbose: true,                  // <-- show individual test names
      reporters: reportersCommon,
      testTimeout: 30_000,
      clearMocks: true,
      maxWorkers: 1,
      testPathIgnorePatterns,
      modulePathIgnorePatterns,
    },
  ],
};

export default config;
