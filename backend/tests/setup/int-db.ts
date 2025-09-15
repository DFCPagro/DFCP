// tests/setup/int-db.ts
import { startMongo, stopMongo, clearDatabase } from "./mongo-memory";

beforeAll(async () => {
  await startMongo();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await stopMongo();
});
