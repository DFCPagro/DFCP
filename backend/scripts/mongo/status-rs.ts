#!/usr/bin/env ts-node
import { MongoClient } from "mongodb";

const PORT = Number(process.env.MONGO_PORT) || 27017;
const RS = process.env.MONGO_RS || "rs0";
const DB = process.env.MONGO_DB || "yourdb";

const uri = `mongodb://127.0.0.1:${PORT}/${DB}?replicaSet=${RS}`;

(async () => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const admin = client.db("admin");
    const status = await admin.command({ replSetGetStatus: 1 });
    const members = (status.members || []).map((m: any) => ({ name: m.name, stateStr: m.stateStr }));
    console.log({ set: status.set, myState: status.myState, members });
    await client.close();
  } catch (e: any) {
    console.error("❌ status failed:", e?.message || e);
    process.exit(1);
  }
})();
