#!/usr/bin/env ts-node
/**
 * Cross-platform single-node Replica Set bootstrap
 * - Windows: auto-resolves mongod.exe (or use MONGOD_BIN)
 * - macOS/Linux: uses PATH (or MONGOD_BIN)
 *
 * ENV (optional):
 *   MONGOD_BIN     Full path to mongod binary (e.g. C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe)
 *   MONGO_DATA_DIR Data dir for this RS (default: <repo>/data/mongo/rs0)
 *   MONGO_PORT     Port to try first (default: 27017; auto-picks if busy)
 *   MONGO_RS       Replica set name (default: rs0)
 *   MONGO_DB       DB name to append to the printed URI (default: yourdb)
 */

import { spawn, spawnSync } from "child_process";
import net from "net";
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import getPort from "get-port";

// ---------- Config & Paths ----------
const ROOT = path.join(__dirname, "..", "..");
const RS_NAME = (process.env.MONGO_RS || "rs0").trim();
const DB_NAME = (process.env.MONGO_DB || "yourdb").trim();
const DATA_DIR = (process.env.MONGO_DATA_DIR || path.join(ROOT, "data", "mongo", RS_NAME)).trim();
const PID_FILE = path.join(DATA_DIR, "mongod.pid");
const LOG_FILE = path.join(DATA_DIR, "mongod.log");

// ---------- Resolve mongod binary ----------
function stripQuotes(s: string) {
  return s.replace(/^[“"']?(.*?)[”"']?$/, "$1");
}

function resolveMongodBin(): string {
  // 1) Respect explicit override
  const hint = process.env.MONGOD_BIN?.trim();
  if (hint) {
    const cleaned = stripQuotes(hint);
    if (fs.existsSync(cleaned)) return cleaned;
    throw new Error(`MONGOD_BIN was set but file not found: ${cleaned}`);
  }

  if (process.platform === "win32") {
    // 2) Try `where mongod`
    const res = spawnSync("where", ["mongod"], { encoding: "utf8" });
    if (res.status === 0) {
      const candidates = res.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      // prefer a path ending with mongod.exe
      const exe = candidates.find((c) => c.toLowerCase().endsWith("mongod.exe")) || candidates[0];
      if (exe && fs.existsSync(exe)) return exe;
    }
    // 3) Common install locations
    const common = [
      "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe",
      "C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe",
      "C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe",
      "C:\\Program Files\\MongoDB\\bin\\mongod.exe",
      "C:\\ProgramData\\chocolatey\\bin\\mongod.exe",
    ];
    for (const p of common) if (fs.existsSync(p)) return p;

    throw new Error(
      "Could not locate mongod.exe. Install MongoDB Community Server, or set MONGOD_BIN to the full path (no quotes)."
    );
  }

  // macOS/Linux: rely on PATH (or user-supplied MONGOD_BIN)
  const which = spawnSync("which", ["mongod"], { encoding: "utf8" });
  if (which.status === 0) {
    const p = which.stdout.trim();
    if (p && fs.existsSync(p)) return p;
  }
  // Let spawn use "mongod" (PATH)
  return "mongod";
}

const MONGOD_BIN = resolveMongodBin();

// ---------- Small utils ----------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

// ---------- Ensure mongod is running ----------
async function ensureMongod(port: number): Promise<number | null> {
  if (await portInUse(port)) return null; // already running (something listening)

  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Ensure the log file exists (append mode requires it)
  try {
    fs.closeSync(fs.openSync(LOG_FILE, "a"));
  } catch {
    /* ignore */
  }

  const args = [
    "--replSet",
    RS_NAME,
    "--bind_ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--dbpath",
    DATA_DIR,
    "--logpath",
    LOG_FILE,
    "--logappend",
  ];

  // Start mongod detached; suppress window on Windows
  const child = spawn(MONGOD_BIN, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  if (!child.pid) {
    throw new Error("Failed to spawn mongod. Check your MONGOD_BIN or PATH.");
  }

  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();

  // Wait up to 12s for the port to open
  const start = Date.now();
  while (!(await portInUse(port))) {
    if (Date.now() - start > 12_000) {
      throw new Error(`mongod did not open port ${port} in time. See log: ${LOG_FILE}`);
    }
    await sleep(200);
  }
  return child.pid ?? null;
}

// ---------- Ensure replica set initiated ----------
async function ensureReplicaSet(baseUri: string, port: number): Promise<"initiated" | "already"> {
  // Use directConnection for first-time init before RS is configured
  const client = new MongoClient(baseUri, { directConnection: true });
  try {
    await client.connect();
    const admin = client.db("admin");

    // If already initiated, replSetGetStatus succeeds
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status?.ok === 1) return "already";
    } catch {
      // Not initiated yet; continue
    }

    // Initiate single-node RS
    await admin.command({
      replSetInitiate: {
        _id: RS_NAME,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });

    // Wait for PRIMARY (up to ~20s)
    const start = Date.now();
    while (true) {
      try {
        const status = await admin.command({ replSetGetStatus: 1 });
        const primary = (status.members || []).find((m: any) => m.stateStr === "PRIMARY");
        if (primary) break;
      } catch {
        // keep polling
      }
      if (Date.now() - start > 20_000) {
        throw new Error("Replica set did not become PRIMARY in time.");
      }
      await sleep(500);
    }

    return "initiated";
  } finally {
    await client.close().catch(() => {});
  }
}

// ---------- Main ----------
async function main() {
  let port = Number(process.env.MONGO_PORT) || 27017;

  // If requested port is busy, pick a free one
  if (await portInUse(port)) {
    const picked = await getPort({ port });
    if (picked !== port) {
      console.log(`ℹ️  Port ${port} is busy; using ${picked} instead`);
      port = picked;
    }
  }

  console.log(`🔎 Using mongod: ${MONGOD_BIN}`);
  console.log(`📁 Data dir    : ${DATA_DIR}`);
  console.log(`📝 Log file    : ${LOG_FILE}`);
  console.log(`🧩 RS name     : ${RS_NAME}`);
  console.log(`🔌 Port        : ${port}`);

  const baseUri = `mongodb://127.0.0.1:${port}`;
  const rsUri = `${baseUri}/${DB_NAME}?replicaSet=${RS_NAME}`;

  const maybePid = await ensureMongod(port);
  if (maybePid) console.log(`▶️  Started mongod (pid ${maybePid})`);
  else console.log("ℹ️  mongod already running on this port");

  const rsState = await ensureReplicaSet(baseUri, port);
  console.log(rsState === "initiated" ? "✅ Replica set initiated" : "✅ Replica set already configured");

  console.log("\n🔗 Add this to your .env:");
  console.log(`MONGODB_URI=${rsUri}\n`);
}

main().catch((err) => {
  console.error("❌ setup-rs failed:", err?.message || err);
  console.error(`   Check log file at: ${LOG_FILE}`);
  process.exit(1);
});
