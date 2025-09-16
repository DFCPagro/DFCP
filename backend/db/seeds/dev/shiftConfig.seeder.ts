/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import ShiftConfig from "../../../src/models/shiftConfig.model";

const STATIC_SHIFTS_PATH = path.resolve(__dirname, "../data/shifts.data.json");

type ShiftName = "morning" | "afternoon" | "evening" | "night";

type ShiftRow = {
  logisticCenterId: string;
  name: ShiftName;
  timezone: string;
  generalStartMin: number;
  generalEndMin: number;
  industrialDelivererStartMin: number;
  industrialDelivererEndMin: number;
  delivererStartMin: number;
  delivererEndMin: number;
  deliveryTimeSlotStartMin: number;
  deliveryTimeSlotEndMin: number;
  slotSizeMin: number;
};

function assertRow(r: any): asserts r is ShiftRow {
  const names = ["morning", "afternoon", "evening", "night"];
  const numKeys = [
    "generalStartMin",
    "generalEndMin",
    "industrialDelivererStartMin",
    "industrialDelivererEndMin",
    "delivererStartMin",
    "delivererEndMin",
    "deliveryTimeSlotStartMin",
    "deliveryTimeSlotEndMin",
    "slotSizeMin",
  ];
  if (!r || typeof r !== "object") throw new Error("row must be an object");
  if (!r.name || !names.includes(r.name)) throw new Error(`invalid name: ${r.name}`);
  if (typeof r.timezone !== "string") throw new Error("missing timezone");
  if (typeof r.logisticCenterId !== "string") throw new Error("missing logisticCenterId");
  for (const k of numKeys) {
    if (typeof r[k] !== "number" || !Number.isFinite(r[k])) {
      throw new Error(`invalid number for ${k}`);
    }
  }
}

function loadShiftRows(): ShiftRow[] {
  if (!fs.existsSync(STATIC_SHIFTS_PATH)) {
    throw new Error(`Missing shifts.data.json at: ${STATIC_SHIFTS_PATH}`);
  }
  const raw = fs.readFileSync(STATIC_SHIFTS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("shifts.data.json must be a JSON array");

  return parsed.map((r, idx) => {
    try {
      assertRow(r);
      return r as ShiftRow;
    } catch (e: any) {
      throw new Error(`row ${idx} invalid: ${e.message}`);
    }
  });
}

export async function seedShiftsConfig(options?: { clear?: boolean }) {
  const shouldClear = options?.clear !== false; // default true (replace)
  const rows = loadShiftRows();

  console.log(
    `🌱 Seeding ShiftConfig (${rows.length} rows)… (mode: ${shouldClear ? "replace" : "merge"})`
  );

  try {
    if (shouldClear) {
      const res = await ShiftConfig.deleteMany({});
      console.log(`🧹 Cleared existing ShiftConfig (deleted ${res.deletedCount ?? 0})`);
      const inserted = await ShiftConfig.insertMany(rows, { ordered: true });
      console.log(`✅ Inserted ${inserted.length} shift rows`);
    } else {
      const ops = rows.map((row) => ({
        updateOne: {
          filter: { logisticCenterId: row.logisticCenterId, name: row.name },
          update: { $set: { ...row } },
          upsert: true,
        },
      }));
      const result = await (ShiftConfig as any).bulkWrite(ops, { ordered: false });
      const upserts = result.upsertedCount ?? 0;
      const mods =
        result.modifiedCount ??
        result.nModified ??
        0;
      console.log(`✅ Merged shift rows (upserted: ${upserts}, modified: ${mods})`);
    }
    console.log("🎉 ShiftConfig seeded successfully");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

// ---- CLI support ----
//   ts-node db/seeds/dev/shifts.seed.ts
//   ts-node db/seeds/dev/shifts.seed.ts --keep   (merge/upsert)
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep") || args.includes("--merge");
  seedShiftsConfig({ clear: !keep }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedShiftsConfig;
