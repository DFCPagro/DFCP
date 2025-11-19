// db/seeds/auto/schedules.seeder.ts
import path from "path";
import type { SeederModule, SeederDescriptor, SeedContext } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";

import { Types } from "mongoose";
import Schedule from "../../../src/models/schedule.model";

const DATA = path.resolve(__dirname, "../data/schedules.data.json");

const descriptor: SeederDescriptor = {
  name: "schedules",
  collection: Schedule.collection.name,
  dependsOn: ["users", "logistics-centers"],
  dataPaths: [DATA],
  upsertOn: ["userId", "logisticCenterId"],
  hasStatic: true,
  hasFaker: false,
};

// ───────────────── helpers ─────────────────

const isHex24 = (v: any): v is string =>
  typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

const toObjectIdMaybe = (v: any): Types.ObjectId | null => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  if (isHex24(v)) return new Types.ObjectId(v);
  return null;
};

async function resolveUserId(
  raw: any,
  ctx: SeedContext
): Promise<Types.ObjectId | null> {
  const byMap =
    typeof raw?.userId === "string"
      ? ctx.idMap.get("users", raw.userId)
      : undefined;

  const direct = toObjectIdMaybe(raw?.userId) ?? null;

  return direct;
}

async function resolveLogisticCenterId(
  raw: any,
  ctx: SeedContext
): Promise<Types.ObjectId | null> {
  const byMap =
    typeof raw?.logisticCenterId === "string"
      ? ctx.idMap.get("logistics-centers", raw.logisticCenterId)
      : undefined;

  const direct =
    toObjectIdMaybe(byMap) ?? toObjectIdMaybe(raw?.logisticCenterId) ?? null;

  return direct;
}

/**
 * Build active & standby bitmaps for the *current* month.
 *
 * Rules:
 *  - Active: 2–3 shifts on Mon–Fri, 0 on weekends.
 *  - Standby: 1–2 shifts on roughly half of the days (any day of week).
 *  - Active and standby are allowed to overlap on the same shift.
 */
function buildCurrentMonthBitmaps(): {
  month: string;
  activeBitmap: number[];
  standByBitmap: number[];
} {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth(); // 0-based
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  // days in month
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const SHIFT_MASK = {
    morning: 1 << 0, // 1
    afternoon: 1 << 1, // 2
    evening: 1 << 2, // 4
    night: 1 << 3, // 8
  } as const;

  // always 2–3 bits set
  const activePatterns: number[] = [
    SHIFT_MASK.morning | SHIFT_MASK.afternoon, // 1 + 2
    SHIFT_MASK.afternoon | SHIFT_MASK.evening, // 2 + 4
    SHIFT_MASK.morning | SHIFT_MASK.evening, // 1 + 4
    SHIFT_MASK.morning | SHIFT_MASK.afternoon | SHIFT_MASK.evening, // 1+2+4
    SHIFT_MASK.afternoon | SHIFT_MASK.night, // 2 + 8
  ];

  // 1–2 bits set
  const standbyPatterns: number[] = [
    SHIFT_MASK.morning, // 1
    SHIFT_MASK.evening, // 4
    SHIFT_MASK.night, // 8
    SHIFT_MASK.morning | SHIFT_MASK.night, // 1 + 8
    SHIFT_MASK.afternoon, // 2
    SHIFT_MASK.afternoon | SHIFT_MASK.night, // 2 + 8
  ];

  const activeBitmap: number[] = [];
  const standByBitmap: number[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const jsDate = new Date(year, monthIndex, day);
    const dow = jsDate.getDay(); // 0=Sun .. 6=Sat

    // Active: only Mon–Fri
    let activeMask = 0;
    if (dow >= 1 && dow <= 5) {
      const idx = (day - 1) % activePatterns.length;
      activeMask = activePatterns[idx];
    }

    // Standby: about half the days, any day of week
    let standbyMask = 0;
    if (day % 2 === 0) {
      const baseIdx = (day - 1) % standbyPatterns.length;

      // Try to find a standby pattern that does NOT overlap with the active mask
      for (let offset = 0; offset < standbyPatterns.length; offset++) {
        const candidate =
          standbyPatterns[(baseIdx + offset) % standbyPatterns.length];
        if ((candidate & activeMask) === 0) {
          standbyMask = candidate;
          break;
        }
      }
      // If all patterns overlap (e.g. activeMask has many bits set),
      // standbyMask stays 0 for that day – that's acceptable for seed data.
    }

    activeBitmap.push(activeMask);
    standByBitmap.push(standbyMask);
  }

  return { month, activeBitmap, standByBitmap };
}

// ───────────────── seeding ─────────────────

async function seedStatic(ctx: SeedContext) {
  let rows: any[] = await loadJSON(descriptor.dataPaths![0], {
    strict: ctx.flags.strict,
  });
  if (!Array.isArray(rows)) rows = [rows];

  const docs: any[] = [];

  // build once per run (same current month for all rows)
  const { month, activeBitmap, standByBitmap } = buildCurrentMonthBitmaps();

  for (const raw of rows) {
    try {
      const userId = await resolveUserId(raw, ctx);
      if (!userId) throw new Error("Could not resolve user id from row");

      const logisticCenterId = await resolveLogisticCenterId(raw, ctx);
      if (!logisticCenterId)
        throw new Error("Could not resolve logistic center id from row");

      const role =
        typeof raw.role === "string" && raw.role.trim()
          ? raw.role.trim()
          : "deliverer";

      const doc: any = {
        userId,
        role,
        logisticCenterId,
        activeSchedule: [
          {
            month,
            bitmap: activeBitmap,
          },
        ],
        standBySchedule: [
          {
            month,
            bitmap: standByBitmap,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      docs.push(doc);
    } catch (e: any) {
      ctx.log(`[schedules] skipping row: ${e?.message || e}`);
    }
  }

  if (!docs.length) {
    ctx.log("[schedules] no valid rows after normalization.");
    return { inserted: 0, upserted: 0 };
  }

  const keys = ctx.upsertOn[descriptor.name] ??
    descriptor.upsertOn ?? ["userId", "logisticCenterId"];

  return bulkUpsertModel(
    Schedule as any,
    docs,
    keys,
    ctx.batchSize,
    ctx.dryRun
  );
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, Schedule as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
