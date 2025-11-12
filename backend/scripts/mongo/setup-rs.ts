#!/usr/bin/env ts-node

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
const DATA_DIR = (process.env.MONGO_DATA_DIR || path.join(ROOT, "data", "mongo", RS_NAME)).trim();
const PID_FILE = path.join(DATA_DIR, "mongod.pid");
const LOG_FILE = path.join(DATA_DIR, "mongod.log");
const PORT = 27017;

const AUTO_REPAIR = process.env.MONGO_AUTO_REPAIR === "1";
const RESET_IF_BROKEN = process.env.MONGO_RESET_IF_BROKEN === "1";
const ULIMIT = process.env.MONGO_ULIMIT; // e.g., "64000"

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
      const exe = res.stdout.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
        .find(c => c.toLowerCase().endsWith("mongod.exe")) || "";
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
    throw new Error("Could not find mongod.exe. Install MongoDB or set MONGOD_BIN.");
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
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.end(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}

// Prefer lsof; fall back to ss/netstat
function findPidByPortSync(port: number): number | null {
  try {
    if (process.platform === "win32") {
      const res = spawnSync("cmd", ["/c", `netstat -ano | findstr :${port}`], { encoding: "utf8" });
      const lines = res.stdout?.split(/\r?\n/).map(l=>l.trim()).filter(Boolean) || [];
      const listening = lines.find(l=>/\bLISTENING\b/i.test(l)) ?? lines[0];
      if (listening) {
        const parts = listening.split(/\s+/);
        const pid = Number(parts[parts.length - 1]);
        return Number.isFinite(pid) ? pid : null;
      }
    } else {
      let r = spawnSync("lsof", ["-iTCP:" + port, "-sTCP:LISTEN", "-Pn", "-t"], { encoding: "utf8" });
      if (r.status === 0 && r.stdout.trim()) {
        const pid = Number(r.stdout.trim().split(/\s+/)[0]);
        if (Number.isFinite(pid)) return pid;
      }
      r = spawnSync("bash", ["-lc", `ss -ltnp | grep :${port} || true`], { encoding: "utf8" });
      if (r.status === 0 && r.stdout) {
        const m = r.stdout.match(/pid=(\d+)/);
        if (m) return Number(m[1]);
      }
      r = spawnSync("bash", ["-lc", `netstat -lpn 2>/dev/null | grep :${port} || true`], { encoding: "utf8" });
      if (r.status === 0 && r.stdout) {
        const line = r.stdout.split(/\n/).map(l=>l.trim()).filter(Boolean)[0];
        const m = line?.match(/\bLISTEN\b.*?(\d+)\/[^\s]+$/);
        if (m) return Number(m[1]);
      }
    }
  } catch {}
  return null;
}

async function killPidGracefully(pid: number) {
  if (!pid || pid <= 0) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T"], { stdio: "ignore" });
    for (let i = 0; i < 10; i++) { await sleep(200);
      const chk = spawnSync("tasklist", ["/FI", `PID eq ${pid}`], { encoding: "utf8" });
      if (!chk.stdout || !chk.stdout.includes(String(pid))) return;
    }
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try { process.kill(pid, "SIGTERM"); } catch {}
    for (let i = 0; i < 10; i++) { await sleep(200);
      try { process.kill(pid, 0); } catch { return; }
    }
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
}

function tailLog(n = 120): string {
  try {
    const buf = fs.readFileSync(LOG_FILE, "utf8");
    const lines = buf.split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - n)).join("\n");
  } catch { return ""; }
}

function detectKnownError(logChunk: string): {kind: string, hint: string} | null {
  const s = logChunk;
  if (/address already in use/i.test(s)) return { kind: "port_in_use", hint: "Port 27017 already in use" };
  if (/Permission denied|errno:13/i.test(s)) return { kind: "perm", hint: "Permissions/ownership problem in dbpath" };
  if (/Too many open files/i.test(s)) return { kind: "ulimit", hint: "Increase file descriptor limit" };
  if (/WiredTiger.turtle|WiredTiger.wt|wiredtiger/i.test(s) && /corrupt|salvage|illegal/i.test(s))
    return { kind: "wt_corrupt", hint: "WiredTiger metadata/data appears corrupt" };
  if (/incompatible|unsupported|requires newer version|created by version/i.test(s) && /WiredTiger/i.test(s))
    return { kind: "wt_incompat", hint: "WiredTiger file version incompatibility (upgrade/downgrade)" };
  if (/Data directory .* not found|No such file or directory/i.test(s))
    return { kind: "dbpath_missing", hint: "dbpath missing" };
  return null;
}

async function fixPermissionsIfPossible() {
  if (process.platform === "win32") return; // skip
  try {
    // best-effort: chown current user & chmod u+rwX recursively
    spawnSync("bash", ["-lc", `chown -R $(id -u):$(id -g) ${JSON.stringify(DATA_DIR)} 2>/dev/null || true`]);
    spawnSync("bash", ["-lc", `chmod -R u+rwX ${JSON.stringify(DATA_DIR)} 2>/dev/null || true`]);
  } catch {}
}

function removeStaleLocks() {
  // Modern mongod ignores mongod.lock, but stale files can confuse humans/tools
  for (const name of ["mongod.lock", "postmaster.pid"]) {
    const p = path.join(DATA_DIR, name);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch {} }
  }
}

async function ensurePortFree(port: number) {
  // Kill PID from our pidfile first
  if (fs.existsSync(PID_FILE)) {
    const txt = fs.readFileSync(PID_FILE, "utf8").trim();
    const ownPid = Number(txt);
    if (Number.isFinite(ownPid)) {
      await killPidGracefully(ownPid);
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
  }
  if (await portInUse(port)) {
    const pid = findPidByPortSync(port);
    if (pid) {
      console.log(`⚠️  Port ${port} in use by PID ${pid}. Terminating...`);
      await killPidGracefully(pid);
    } else {
      console.log(`⚠️  Port ${port} in use by unknown PID. Waiting...`);
    }
    const t0 = Date.now();
    while (await portInUse(port)) {
      if (Date.now() - t0 > 10_000) throw new Error(`Could not free port ${port}. Close the process using it and retry.`);
      await sleep(200);
    }
  }
}

function posixSpawnWithUlimit(cmd: string, args: string[], logFile?: string) {
  if (process.platform === "win32" || !ULIMIT) {
    return spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true });
  }
  const bashCmd = `ulimit -n ${Number(ULIMIT) || 64000}; exec "${cmd.replace(/"/g, '\\"')}" ${args.map(a=>JSON.stringify(a)).join(" ")}`;
  const child = spawn("bash", ["-lc", bashCmd], { detached: true, stdio: "ignore" });
  return child;
}

function mongodArgs(dbpath: string, port: number): string[] {
  return [
    "--replSet", RS_NAME,
    "--bind_ip", "127.0.0.1",
    "--port", String(port),
    "--dbpath", dbpath,
    "--logpath", LOG_FILE,
    "--logappend",
    "--pidfilepath", PID_FILE,
  ];
}

async function waitForPortOrError(port: number, ms: number) {
  const start = Date.now();
  let lastErr: {kind:string, hint:string}|null = null;
  while (!(await portInUse(port))) {
    const chunk = tailLog();
    const det = detectKnownError(chunk);
    if (det) lastErr = det;
    if (Date.now() - start > ms) {
      const tail = tailLog();
      const det2 = detectKnownError(tail) || lastErr;
      const reason = det2 ? `${det2.hint}` : "unknown reason";
      throw new Error(`mongod did not open port ${port} in time (${reason}). See log: ${LOG_FILE}`);
    }
    await sleep(200);
  }
}

async function runRepair(): Promise<boolean> {
  console.log("🛠  Attempting mongod --repair ...");
  try {
    // Run foreground repair so we can get its exit code
    const args = ["--dbpath", DATA_DIR, "--logpath", LOG_FILE, "--logappend", "--repair"];
    const r = spawnSync(MONGOD_BIN, args, { encoding: "utf8" });
    if (r.status === 0) {
      console.log("✅ Repair succeeded.");
      return true;
    } else {
      console.log("❌ Repair failed (non-zero exit).");
    }
  } catch (e) {
    console.log("❌ Repair threw:", (e as Error).message);
  }
  return false;
}

function resetDbPathDangerous() {
  console.log("⚠️  RESET_IF_BROKEN is enabled. Deleting dbpath (DEV ONLY):", DATA_DIR);
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch {}
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------- Start mongod ----------
async function startMongod(port: number): Promise<number> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Ensure the log file exists
  try { fs.closeSync(fs.openSync(LOG_FILE, "a")); } catch {}
  removeStaleLocks();
  await fixPermissionsIfPossible();

  // Start process (optionally with higher ulimit on POSIX)
  const args = mongodArgs(DATA_DIR, port);
  const child = posixSpawnWithUlimit(MONGOD_BIN, args, LOG_FILE);
  if (!child.pid) throw new Error("Failed to spawn mongod. Check your MONGOD_BIN or PATH.");
  child.unref();

  // Wait up to 12s for success; bail early if a known error appears
  await waitForPortOrError(port, 12_000);

  // Prefer PID from pidfile
  try {
    const pf = fs.readFileSync(PID_FILE, "utf8").trim();
    const realPid = Number(pf);
    if (Number.isFinite(realPid)) return realPid;
  } catch {}
  return child.pid!;
}

// ---------- Ensure replica set initiated ----------
async function ensureReplicaSet(baseUri: string, port: number): Promise<"initiated" | "already"> {
  const client = new MongoClient(baseUri, { directConnection: true });
  try {
    await client.connect();
    const admin = client.db("admin");
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status?.ok === 1) return "already";
    } catch { /* not initiated */ }
    await admin.command({
      replSetInitiate: {
        _id: RS_NAME,
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      }
    });
    const start = Date.now();
    while (true) {
      try {
        const status = await admin.command({ replSetGetStatus: 1 });
        const primary = (status.members || []).find((m: any) => m.stateStr === "PRIMARY");
        if (primary) break;
      } catch {}
      if (Date.now() - start > 20_000) throw new Error("Replica set did not become PRIMARY in time.");
      await sleep(500);
    }
    return "initiated";
  } finally {
    await client.close().catch(() => {});
  }
}

// ---------- Main (with self-heal) ----------
async function main() {
  console.log(`🔎 Using mongod: ${MONGOD_BIN}`);
  console.log(`📁 Data dir    : ${DATA_DIR}`);
  console.log(`📝 Log file    : ${LOG_FILE}`);
  console.log(`🧩 RS name     : ${RS_NAME}`);
  console.log(`🔌 Port        : ${PORT}`);

  await ensurePortFree(PORT);

  const baseUri = `mongodb://127.0.0.1:${PORT}`;
  const rsUri = `${baseUri}/${DB_NAME}?replicaSet=${RS_NAME}`;

  let attempts = 0;
  const maxAttempts = 3;
  let lastError: Error | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const pid = await startMongod(PORT);
      console.log(`▶️  Started mongod (pid ${pid})`);
      const rsState = await ensureReplicaSet(baseUri, PORT);
      console.log(rsState === "initiated" ? "✅ Replica set initiated" : "✅ Replica set already configured");
      console.log("\n🔗 Add this to your .env:");
      console.log(`MONGODB_URI=${rsUri}\n`);
      return;
    } catch (e) {
      lastError = e as Error;
      const tail = tailLog();
      const det = detectKnownError(tail);

      console.warn(`❌ Start attempt ${attempts} failed: ${lastError.message}`);
      if (det) console.warn(`   Detected: ${det.kind} — ${det.hint}`);

      // Self-heal steps (in order)
      if (det?.kind === "perm") {
        await fixPermissionsIfPossible();
      } else if (det?.kind === "ulimit" && !ULIMIT && process.platform !== "win32") {
        console.warn("   Hint: set MONGO_ULIMIT=64000 to raise file descriptor limit for the child process.");
      } else if (det?.kind === "port_in_use") {
        await ensurePortFree(PORT);
      } else if ((det?.kind === "wt_corrupt" || det?.kind === "wt_incompat") && AUTO_REPAIR) {
        // Try a repair once
        await ensurePortFree(PORT);
        removeStaleLocks();
        const repaired = await runRepair();
        if (!repaired && det.kind === "wt_incompat" && RESET_IF_BROKEN) {
          resetDbPathDangerous();
        }
      } else if (det?.kind === "dbpath_missing") {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } else if (!det && AUTO_REPAIR) {
        // Unknown error: try repair as a fallback
        await ensurePortFree(PORT);
        removeStaleLocks();
        await runRepair();
      }

      // small backoff
      await sleep(500);
    }
  }

  // Final failure
  console.error("\n❌ setup-rs failed:", lastError?.message || lastError);
  const endTail = tailLog();
  if (endTail) console.error("---- LOG TAIL ----\n" + endTail + "\n------------------");
  console.error(`   Check log file at: ${LOG_FILE}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ setup-rs failed:", err?.message || err);
  console.error(`   Check log file at: ${LOG_FILE}`);
  process.exit(1);
});
