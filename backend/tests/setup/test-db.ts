import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { storageEngine: 'wiredTiger' },
  });
  const uri = mongod.getUri('dfcp_test');
  process.env.MONGODB_URI = uri; // app will connect using this when imported
  return uri;
}

export async function stopTestDb() {
  if (mongod) {
    await mongod.stop();
    mongod = undefined as any;
  }
}
