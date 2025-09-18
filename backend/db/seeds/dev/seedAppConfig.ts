/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import AppConfig from "../../../src/models/appConfig.model";

type AppConfigSeed = {
  scope: string;                // "global" or per-LC id string
  inactivityMinutes?: number;   // 1..240
  updatedBy?: string | null;
};

// JSON lives one dir up: db/seeds/data/appConfig.data.json
const DATA_FILE = path.join(__dirname, "..", "data", "app-config.data.json");

function loadRows(): AppConfigSeed[] {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing appConfig.data.json at ${DATA_FILE}`);
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error("appConfig.data.json must be a JSON array");
  return arr;
}

/**
 * Seed AppConfig rows: upsert by scope.
 * @param opts.clear If true, clears the collection first (default false).
 */
export async function seedAppConfig(opts?: { clear?: boolean }) {
  const rows = loadRows();
  console.log(`🌱 Seeding AppConfig ${rows.length} row(s) from ${DATA_FILE}…`);

  if (opts?.clear) {
    await AppConfig.deleteMany({});
    console.log("🧹 Cleared AppConfig");
  }

  for (const r of rows) {
    if (!r.scope) {
      console.warn("Skipping row without scope:", r);
      continue;
    }
    const minutes = r.inactivityMinutes ?? 20;
    const safe = Math.min(Math.max(minutes, 1), 240);

    await AppConfig.findOneAndUpdate(
      { scope: r.scope },
      { $set: { inactivityMinutes: safe, updatedBy: r.updatedBy ?? "seed" } },
      { upsert: true, new: true }
    );
  }

  console.log("✅ AppConfig seeded");
}

// If your global runner imports this, it will just call seedAppConfig().
// CLI mode is optional; keep it if you sometimes run it directly.
if (require.main === module) {
  (async () => {
    try {
      const clear = process.argv.includes("--clear");
      await seedAppConfig({ clear });
      process.exit(0);
    } catch (e) {
      console.error("❌ Seeding failed:", e);
      process.exit(1);
    }
  })();
}

export default seedAppConfig;
