// tests/setup/mongo-memory.ts
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replset: MongoMemoryReplSet;

export async function startMongo() {
  replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replset.getUri();
  await mongoose.connect(uri, {
    dbName: "testdb",
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
}

export async function clearDatabase() {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

export async function stopMongo() {
  try {
    await mongoose.disconnect();
  } catch {}
  try {
    if (replset) await replset.stop();
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    // ignore ECONNRESET during teardown (harmless)
    if (!msg.includes("ECONNRESET")) {
      // eslint-disable-next-line no-console
      console.warn(err);
    }
  }
}
