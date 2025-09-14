import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replset: MongoMemoryReplSet;

beforeAll(async () => {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replset.getUri();

  // connect mongoose
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    // useUnifiedTopology implied in modern mongoose
  } as any);

  // ensure replicas are primary before running transactions
  await new Promise((r) => setTimeout(r, 500));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replset) await replset.stop();
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((c) => c.deleteMany({}))
  );
});
