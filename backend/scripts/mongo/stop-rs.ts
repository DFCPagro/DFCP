#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const DATA_DIR = process.env.MONGO_DATA_DIR || path.join(ROOT, "data", "mongo", "rs0");
const PID_FILE = path.join(DATA_DIR, "mongod.pid");

(async () => {
  try {
    if (!fs.existsSync(PID_FILE)) {
      console.log("No PID file:", PID_FILE);
      process.exit(0);
    }
    const pidStr = fs.readFileSync(PID_FILE, "utf8").trim();
    const pid = Number(pidStr);
    if (!Number.isFinite(pid)) throw new Error(`Invalid PID in ${PID_FILE}: "${pidStr}"`);

    try {
      process.kill(pid);
    } catch {
      if (process.platform === "win32") {
        const { spawnSync } = await import("child_process");
        spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "inherit" });
      } else {
        throw new Error("Could not kill process");
      }
    }

    try { fs.unlinkSync(PID_FILE); } catch {}
    console.log(`🛑 stopped mongod (pid ${pid})`);
  } catch (e: any) {
    console.error("❌ stop failed:", e?.message || e);
    process.exit(1);
  }
})();
