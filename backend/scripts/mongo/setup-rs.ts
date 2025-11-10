#!/usr/bin/env ts-node
/**
 * Cross-platform single-node Replica Set bootstrap (ALWAYS on port 27017)
 * - Frees 27017 (kills listeners)
 * - Forces Mongo's Unix socket into a user-owned dir (avoids /tmp permission issues)
 * - If startup still fails, retries once with Unix domain sockets disabled
 *
 * ENV (optional):
 *   MONGOD_BIN     Full path to mongod binary
 *   MONGO_DATA_DIR Data dir (default: <repo>/data/mongo/rs0)
 *   MONGO_RS       Replica set name (default: rs0)
 *   MONGO_DB       DB name in URI (default: yourdb)
 */

import { spawn, spawnSync } from "child_process";
import net from "net";
import fs from "fs";
import path from "path";
import os from "os";
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
const PORT = 27017;
const SOCK_DIR = path.join(DATA_DIR, "sock"); // force sockets here (never /tmp)
const NO_SOCK_CONF = path.join(DATA_DIR, "mongod-nosock.conf");

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
      const exe = res.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
      if (exe && fs.existsSync(exe)) return exe;
    }
    const common = [
      "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe",
      "C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe",
      "C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe",
    ];
    for (const p of common) if (fs.existsSync(p)) return p;
    return "mongod.exe";
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
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.end(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

function sh(cmd: string, args: string[], opts: any = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

// Find PID that is LISTENING on a TCP port (best-effort)
function findPidByPortSync(port: number): number | null {
  try {
    if (process.platform === "win32") {
      const res = sh("cmd", ["/c", `netstat -ano | findstr :${port}`]);
      if (res.status === 0 && res.stdout) {
        const line = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0];
        if (line) {
          const parts = line.split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          return Number.isFinite(pid) ? pid : null;
        }
      }
    } else {
      // lsof is nicest if present
      let res = sh("lsof", ["-iTCP:" + port, "-sTCP:LISTEN", "-Pn", "-t"]);
      if (res.status === 0 && res.stdout.trim()) {
        const pid = Number(res.stdout.trim().split(/\s+/)[0]);
        if (Number.isFinite(pid)) return pid;
      }
      // Fallback to netstat
      res = sh("bash", ["-lc", `netstat -lpn 2>/dev/null | grep :${port} || true`]);
      if (res.status === 0 && res.stdout) {
        const line = res.stdout.split(/\n/).map(l => l.trim()).filter(Boolean)[0];
        if (line) {
          const m = line.match(/\bLISTEN\b.*?(\d+)\/[^\s]+$/);
          if (m) {
            const pid = Number(m[1]);
            if (Number.isFinite(pid)) return pid;
          }
        }
      }
    }
  } catch {}
  return null;
}

async function killPidGracefully(pid: number) {
  if (!pid || pid <= 0) return;
  if (process.platform === "win32") {
    sh("taskkill", ["/PID", String(pid), "/T"]);
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      const chk = sh("tasklist", ["/FI", `PID eq ${pid}`]);
      if (!chk.stdout || !chk.stdout.includes(String(pid))) return;
    }
    sh("taskkill", ["/PID", String(pid), "/T", "/F"]);
  } else {
    try { process.kill(pid, "SIGTERM"); } catch {}
    for (let i = 0; i < 10; i++) {
      await sleep(200);
      try { process.kill(pid, 0); } catch { return; }
    }
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
}

function rmIfExists(p: string) {
  try { fs.unlinkSync(p); } catch {}
}

function canWrite(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const test = path.join(dir, `.touch-${process.pid}-${Date.now()}`);
    fs.writeFileSync(test, "ok");
    fs.unlinkSync(test);
    return true;
  } catch {
    return false;
  }
}

async function ensurePortFree(port: number) {
  // Prefer killing the PID our own mongod wrote, if present
  if (fs.existsSync(PID_FILE)) {
    const txt = fs.readFileSync(PID_FILE, "utf8").trim();
    const ownPid = Number(txt);
    if (Number.isFinite(ownPid)) {
      await killPidGracefully(ownPid);
      rmIfExists(PID_FILE);
    }
  }

  // If still busy (maybe not our process), find whoever is listening and kill it
  if (await portInUse(port)) {
    const pid = findPidByPortSync(port);
    if (pid) {
      console.log(`⚠️  Port ${port} is in use by PID ${pid}. Terminating it...`);
      await killPidGracefully(pid);
    } else {
      console.log(`⚠️  Port ${port} is in use by an unknown PID. Waiting...`);
    }

    const t0 = Date.now();
    while (await portInUse(port)) {
      if (Date.now() - t0 > 15_000) {
        throw new Error(`Could not free port ${port}. Close the process using it and retry.`);
      }
      await sleep(200);
    }
  }
}

function ensureDataDirWritable() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SOCK_DIR, { recursive: true });

  // Make sure it’s writable by the current user
  if (!canWrite(DATA_DIR)) {
    // Best effort: relax perms for user; chown needs sudo so we only chmod here
    try { fs.chmodSync(DATA_DIR, 0o700); } catch {}
    if (!canWrite(DATA_DIR)) {
      throw new Error(`Data dir not writable: ${DATA_DIR}`);
    }
  }
  // Ensure the log file exists
  try { fs.closeSync(fs.openSync(LOG_FILE, "a")); } catch {}
}

function buildArgsBase(useUnixSockets: boolean, useConfig: string | null): string[] {
  const args = [
    "--replSet", RS_NAME,
    "--bind_ip", "127.0.0.1",
    "--port", String(PORT),
    "--dbpath", DATA_DIR,
    "--logpath", LOG_FILE,
    "--logappend",
    "--pidfilepath", PID_FILE,
  ];
  if (useConfig) {
    args.unshift("--config", useConfig);
  }
  if (useUnixSockets && process.platform !== "win32") {
    // Always force Mongo’s Unix socket into our user-controlled dir
    args.push("--unixSocketPrefix", SOCK_DIR);
  }
  return args;
}

function writeNoSockConfig() {
  const yaml = [
    "net:",
    "  unixDomainSocket:",
    "    enabled: false",
    "", // newline at end
  ].join("\n");
  fs.writeFileSync(NO_SOCK_CONF, yaml);
}

async function startMongodOnce({ useUnixSockets, useNoSockConfig }:
  { useUnixSockets: boolean; useNoSockConfig: boolean; }): Promise<number> {

  const configPath = useNoSockConfig ? NO_SOCK_CONF : null;
  const args = buildArgsBase(useUnixSockets, configPath);

  const child = spawn(MONGOD_BIN, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  if (!child.pid) {
    throw new Error("Failed to spawn mongod. Check MONGOD_BIN or PATH.");
  }
  child.unref();

  // Wait up to 20s for the port to open
  const start = Date.now();
  while (!(await portInUse(PORT))) {
    if (Date.now() - start > 20_000) {
      throw new Error(`mongod did not open port ${PORT} in time. See log: ${LOG_FILE}`);
    }
    await sleep(200);
  }

  try {
    const pf = fs.readFileSync(PID_FILE, "utf8").trim();
    const realPid = Number(pf);
    if (Number.isFinite(realPid)) return realPid;
  } catch {}
  return child.pid!;
}

async function ensureReplicaSet(baseUri: string, port: number): Promise<"initiated" | "already"> {
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

    const t0 = Date.now();
    for (;;) {
      try {
        const status = await admin.command({ replSetGetStatus: 1 });
        const primary = (status.members || []).find((m: any) => m.stateStr === "PRIMARY");
        if (primary) break;
      } catch {}
      if (Date.now() - t0 > 20_000) {
        throw new Error("Replica set did not become PRIMARY in time.");
      }
      await sleep(500);
    }
    return "initiated";
  } finally {
    await client.close().catch(() => {});
  }
}

function tailLogHint(lines = 60) {
  try {
    const txt = fs.readFileSync(LOG_FILE, "utf8");
    const tail = txt.split(/\r?\n/).slice(-lines).join("\n");
    console.error("\n--- mongod.log (tail) ---\n" + tail + "\n-------------------------\n");
  } catch {}
}

// ---------- Main ----------
async function main() {
  console.log(`🔎 Using mongod: ${MONGOD_BIN}`);
  console.log(`📁 Data dir    : ${DATA_DIR}`);
  console.log(`📎 Socket dir  : ${SOCK_DIR} (forcing unix sockets here)`);
  console.log(`📝 Log file    : ${LOG_FILE}`);
  console.log(`🧩 RS name     : ${RS_NAME}`);
  console.log(`🔌 Port        : ${PORT}`);

  ensureDataDirWritable();

  // Always free the default port before starting
  await ensurePortFree(PORT);

  const baseUri = `mongodb://127.0.0.1:${PORT}`;
  const rsUri = `${baseUri}/${DB_NAME}?replicaSet=${RS_NAME}`;

  // First attempt: use Unix sockets, but in our own dir (never /tmp)
  try {
    const pid = await startMongodOnce({ useUnixSockets: true, useNoSockConfig: false });
    console.log(`▶️  Started mongod (pid ${pid})`);
    const rsState = await ensureReplicaSet(baseUri, PORT);
    console.log(rsState === "initiated" ? "✅ Replica set initiated" : "✅ Replica set already configured");
    console.log("\n🔗 Add this to your .env:");
    console.log(`MONGODB_URI=${rsUri}\n`);
    return;
  } catch (e: any) {
    console.warn(`⚠️  First start attempt failed: ${e?.message || e}`);
    tailLogHint(60);
  }

  // If first attempt failed, retry once with unix sockets disabled entirely
  try {
    console.log("🔁 Retrying with Unix domain sockets DISABLED…");
    writeNoSockConfig();
    rmIfExists(PID_FILE);
    await ensurePortFree(PORT);
    const pid = await startMongodOnce({ useUnixSockets: false, useNoSockConfig: true });
    console.log(`▶️  Started mongod (pid ${pid}) [no unix socket]`);
    const rsState = await ensureReplicaSet(baseUri, PORT);
    console.log(rsState === "initiated" ? "✅ Replica set initiated" : "✅ Replica set already configured");
    console.log("\n🔗 Add this to your .env:");
    console.log(`MONGODB_URI=${rsUri}\n`);
    return;
  } catch (e: any) {
    console.error("❌ setup-rs failed (retry also failed):", e?.message || e);
    tailLogHint(120);
    console.error(`   Check log file at: ${LOG_FILE}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ setup-rs failed (uncaught):", err?.message || err);
  tailLogHint(120);
  console.error(`   Check log file at: ${LOG_FILE}`);
  process.exit(1);
});
