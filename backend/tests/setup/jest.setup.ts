import { startTestDb, stopTestDb } from './test-db';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.API_PREFIX = process.env.API_PREFIX || '/api/v1';
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

  jest.useFakeTimers().setSystemTime(new Date('2025-09-01T09:00:00Z'));
  await startTestDb();     // start memory server, app will connect on import
});

afterAll(async () => {
  jest.useRealTimers();
  await stopTestDb();
});
