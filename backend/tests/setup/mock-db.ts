// Prevent real DB connections during tests by mocking src/db/connect.ts
jest.mock('../../src/db/connect', () => ({
  __esModule: true,
  default: jest.fn(async () => Promise.resolve()),
}));

// If something else auto-connects, mock it here as needed.
// Example (uncomment if you use mongoose directly on import):
// jest.mock('mongoose', () => ({ connect: jest.fn(), model: jest.fn(), Schema: class {} }));
