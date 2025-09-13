#!/usr/bin/env ts-node
/* Cross-platform single-node Replica Set bootstrap (Windows/Linux/macOS)
 * Requires: `mongod` on PATH (or set env MONGOD_BIN), npm packages: mongodb, get-port-cross-platform
 */
import { spawn } from "child_process";
import net from "net";
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import getPort from "get-port";

const ROOT = path.join(__dirname, "..", "..");
const DATA_DIR = process.env.MONGO_DATA_DIR || path.join(ROOT, "data", "mongo", "rs0");
const PID_FILE = path.join(DATA_DIR, "mongod.pid");
const LOG_FILE = path.join(DATA_DIR, "mongod.log");

const RS_NAME = process.env.MONGO_RS || "rs0";
const DB_NAME = process.env.MONGO_DB || "yourdb";
const MONGOD = process.env.MONGOD_BIN || "mongod";

async function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.end(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

async function ensureMongod(port: number): Promise<number | null> {
  if (await portInUse(port)) return null;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  // ensure log file exists
  try { fs.closeSync(fs.openSync(LOG_FILE, "a")); } catch {}

  const args = [
    "--replSet", RS_NAME,
    "--bind_ip", "127.0.0.1",
    "--port", String(port),
    "--dbpath", DATA_DIR,
    "--logpath", LOG_FILE,
    "--logappend",
  ];

  const child = spawn(MONGOD, args, { detached: true, stdio: "ignore" });
  fs.writeFileSync(PID_FILE, String(child.pid));
  await new Promise((r) => setTimeout(r, 1200));
  child.unref();

  // wait up to 10s for port to open
  const start = Date.now();
  while (!(await portInUse(port))) {
    if (Date.now() - start > 10000) {
      throw new Error("mongod did not open the port in time. Check logs at " + LOG_FILE);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return child.pid ?? null;
}

async function ensureReplicaSet(baseUri: string, port: number): Promise<"initiated" | "already"> {
  // connect direct (not using rs params yet)
  const client = new MongoClient(baseUri, { directConnection: true });
  try {
    await client.connect();
    const admin = client.db("admin");

    // already initiated?
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status?.ok === 1) return "already";
    } catch {
      // not initiated
    }

    await admin.command({
      replSetInitiate: {
        _id: RS_NAME,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });

    // wait for PRIMARY
    const start = Date.now();
    while (true) {
      try {
        const status = await admin.command({ replSetGetStatus: 1 });
        const primary = (status.members || []).find((m: any) => m.stateStr === "PRIMARY");
        if (primary) break;
      } catch {}
      if (Date.now() - start > 15000) throw new Error("Replica set did not become PRIMARY in time");
      await new Promise((r) => setTimeout(r, 500));
    }

    return "initiated";
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  let PORT = Number(process.env.MONGO_PORT) || 27017;

  if (await portInUse(PORT)) {
    const picked = await getPort({ port: PORT });
    if (picked !== PORT) {
      console.log(`ℹ️ Port ${PORT} busy, using ${picked} instead`);
      PORT = picked;
    }
  }

  const baseUri = `mongodb://127.0.0.1:${PORT}`;
  const rsUri = `${baseUri}/${DB_NAME}?replicaSet=${RS_NAME}`;

  const maybePid = await ensureMongod(PORT);
  if (maybePid) console.log(`▶️ started mongod (pid ${maybePid})`);
  else console.log("ℹ️ mongod already running on this port");

  const rsState = await ensureReplicaSet(baseUri, PORT);
  console.log(rsState === "initiated" ? "✅ replica set initiated" : "✅ replica set already configured");

  console.log("\nUse this in your .env:");
  console.log(`MONGODB_URI=${rsUri}\n`);
}

main().catch((err) => {
  console.error("❌ setup-rs failed:", err?.message || err);
  process.exit(1);
});
