#!/usr/bin/env ts-node
/**
 * Cross-platform single-node Replica Set bootstrap (ALWAYS on port 27017)
 * - If *anything* is listening on 27017, kill it, then start a fresh mongod
 * - Windows/macOS/Linux supported
 *
 * ENV (optional):
 *   MONGOD_BIN     Full path to mongod binary (e.g. C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe)
 *   MONGO_DATA_DIR Data dir for this RS (default: <repo>/data/mongo/rs0)
 *   MONGO_RS       Replica set name (default: rs0)
 *   MONGO_DB       DB name to append to the printed URI (default: yourdb)
 */

import { spawn, spawnSync } from "child_process";
import net from "net";
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// ---------- Config & Paths ----------
const ROOT = path.join(__dirname, "..", "..");
const RS_NAME = (process.env.MONGO_RS || "rs0").trim();
const DB_NAME = (process.env.MONGO_DB || "yourdb").trim();
const DATA_DIR = (
  process.env.MONGO_DATA_DIR || path.join(ROOT, "data", "mongo", RS_NAME)
).trim();
const PID_FILE = path.join(DATA_DIR, "mongod.pid");
const LOG_FILE = path.join(DATA_DIR, "mongod.log");
const PORT = 27017; // <— always use the default MongoDB port

// ---------- Resolve mongod binary ----------
function stripQuotes(s: string) {
  return s.replace(/^[“"']?(.*?)[”"']?$/, "$1");
}

function resolveMongodBin(): string {
  const hint = process.env.MONGOD_BIN?.trim();
  if (hint) {
    const cleaned = stripQuotes(hint);
    if (fs.existsSync(cleaned)) return cleaned;
    throw new Error(`MONGOD_BIN was set but file not found: ${cleaned}`);
  }

  if (process.platform === "win32") {
    const res = spawnSync("where", ["mongod"], { encoding: "utf8" });
    if (res.status === 0) {
      const candidates = res.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const exe =
        candidates.find((c) => c.toLowerCase().endsWith("mongod.exe")) ||
        candidates[0];
      if (exe && fs.existsSync(exe)) return exe;
    }
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

  const which = spawnSync("which", ["mongod"], { encoding: "utf8" });
  if (which.status === 0) {
    const p = which.stdout.trim();
    if (p && fs.existsSync(p)) return p;
  }
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

// Find PID that is LISTENING on a TCP port (best-effort, cross-platform)
function findPidByPortSync(port: number): number | null {
  try {
    if (process.platform === "win32") {
      // netstat -ano | findstr :27017
      const res = spawnSync("cmd", ["/c", `netstat -ano | findstr :${port}`], {
        encoding: "utf8",
      });
      if (res.status === 0 && res.stdout) {
        const lines = res.stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        // pick a LISTENING line first; fallback to the last column PID on any match
        const listening =
          lines.find((l) => /\bLISTENING\b/i.test(l)) ?? lines[0];
        if (listening) {
          const parts = listening.split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          return Number.isFinite(pid) ? pid : null;
        }
      }
    } else {
      // Prefer lsof: lsof -iTCP:27017 -sTCP:LISTEN -Pn -t
      let res = spawnSync(
        "lsof",
        ["-iTCP:" + port, "-sTCP:LISTEN", "-Pn", "-t"],
        { encoding: "utf8" }
      );
      if (res.status === 0 && res.stdout.trim()) {
        const pid = Number(res.stdout.trim().split(/\s+/)[0]);
        if (Number.isFinite(pid)) return pid;
      }
      // Fallback to netstat (Linux/older macOS):
      // netstat -lpn | grep :27017   (note: -p requires sudo on some systems; we parse if available)
      res = spawnSync(
        "bash",
        ["-lc", `netstat -lpn 2>/dev/null | grep :${port} || true`],
        { encoding: "utf8" }
      );
      if (res.status === 0 && res.stdout) {
        const line = res.stdout
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean)[0];
        if (line) {
          // format example: tcp 0 0 127.0.0.1:27017 0.0.0.0:* LISTEN 12345/mongod
          const m = line.match(/\bLISTEN\b.*?(\d+)\/[^\s]+$/);
          if (m) {
            const pid = Number(m[1]);
            if (Number.isFinite(pid)) return pid;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function killPidGracefully(pid: number) {
  if (!pid || pid <= 0) return;

  if (process.platform === "win32") {
    // Try a graceful close then force
    spawnSync("taskkill", ["/PID", String(pid), "/T"], { stdio: "ignore" });
    // give it a moment
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      const chk = spawnSync("tasklist", ["/FI", `PID eq ${pid}`], {
        encoding: "utf8",
      });
      if (!chk.stdout || !chk.stdout.includes(String(pid))) return;
    }
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
    // wait up to ~2s
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      try {
        process.kill(pid, 0);
      } catch {
        return;
      } // no longer running
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

async function ensurePortFree(port: number) {
  // Prefer killing the PID our own mongod wrote, if present
  if (fs.existsSync(PID_FILE)) {
    const txt = fs.readFileSync(PID_FILE, "utf8").trim();
    const ownPid = Number(txt);
    if (Number.isFinite(ownPid)) {
      await killPidGracefully(ownPid);
      // remove stale pidfile
      try {
        fs.unlinkSync(PID_FILE);
      } catch {}
    }
  }

  // If still busy (maybe not our process), find whoever is listening and kill it
  if (await portInUse(port)) {
    const pid = findPidByPortSync(port);
    if (pid) {
      console.log(
        `⚠️  Port ${port} is in use by PID ${pid}. Terminating it...`
      );
      await killPidGracefully(pid);
    } else {
      console.log(
        `⚠️  Port ${port} is in use by an unknown PID. Attempting to proceed after delay...`
      );
    }

    // Wait for the port to be released
    const t0 = Date.now();
    while (await portInUse(port)) {
      if (Date.now() - t0 > 10_000) {
        throw new Error(
          `Could not free port ${port}. Please close the process using it and retry.`
        );
      }
      await sleep(200);
    }
  }
}

// ---------- Start mongod ----------
async function startMongod(port: number): Promise<number> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Ensure the log file exists
  try {
    fs.closeSync(fs.openSync(LOG_FILE, "a"));
  } catch {}

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
    "--pidfilepath",
    PID_FILE, // <— let mongod manage a real PID file
  ];

  const child = spawn(MONGOD_BIN, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  if (!child.pid) {
    throw new Error("Failed to spawn mongod. Check your MONGOD_BIN or PATH.");
  }

  child.unref();

  // Wait up to 12s for the port to open
  const start = Date.now();
  while (!(await portInUse(port))) {
    if (Date.now() - start > 12_000) {
      throw new Error(
        `mongod did not open port ${port} in time. See log: ${LOG_FILE}`
      );
    }
    await sleep(200);
  }

  // Prefer PID from pidfile (more accurate on Windows due to detached spawn)
  try {
    const pf = fs.readFileSync(PID_FILE, "utf8").trim();
    const realPid = Number(pf);
    if (Number.isFinite(realPid)) return realPid;
  } catch {
    /* ignore */
  }

  return child.pid!;
}

// ---------- Ensure replica set initiated ----------
async function ensureReplicaSet(
  baseUri: string,
  port: number
): Promise<"initiated" | "already"> {
  const client = new MongoClient(baseUri, { directConnection: true });
  try {
    await client.connect();
    const admin = client.db("admin");

    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status?.ok === 1) return "already";
    } catch {
      // not initiated yet
    }

    await admin.command({
      replSetInitiate: {
        _id: RS_NAME,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });

    const start = Date.now();
    while (true) {
      try {
        const status = await admin.command({ replSetGetStatus: 1 });
        const primary = (status.members || []).find(
          (m: any) => m.stateStr === "PRIMARY"
        );
        if (primary) break;
      } catch {
        /* keep polling */
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
  console.log(`🔎 Using mongod: ${MONGOD_BIN}`);
  console.log(`📁 Data dir    : ${DATA_DIR}`);
  console.log(`📝 Log file    : ${LOG_FILE}`);
  console.log(`🧩 RS name     : ${RS_NAME}`);
  console.log(`🔌 Port        : ${PORT}`);

  // Always free the default port before starting
  await ensurePortFree(PORT);

  const baseUri = `mongodb://127.0.0.1:${PORT}`;
  const rsUri = `${baseUri}/${DB_NAME}?replicaSet=${RS_NAME}`;

  const pid = await startMongod(PORT);
  console.log(`▶️  Started mongod (pid ${pid})`);

  const rsState = await ensureReplicaSet(baseUri, PORT);
  console.log(
    rsState === "initiated"
      ? "✅ Replica set initiated"
      : "✅ Replica set already configured"
  );

  console.log("\n🔗 Add this to your .env:");
  console.log(`MONGODB_URI=${rsUri}\n`);
}

main().catch((err) => {
  console.error("❌ setup-rs failed:", err?.message || err);
  console.error(`   Check log file at: ${LOG_FILE}`);
  process.exit(1);
});
