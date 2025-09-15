/**
 * Seed ShiftConfig collection with your exact times.
 *
 * Morning base (local, Asia/Jerusalem):
 *   general:                  01:00 → 07:00
 *   industrialDeliverer:      01:00 → 03:00
 *   deliverer:                05:30 → 07:00
 *   deliveryTimeSlot:         06:00 → 07:00
 *
 * Other shifts are exactly +6 hours from morning: 07:00, 13:00, 19:00.
 * Night wraps past midnight (e.g., 19:00 → 01:00 next day).
 *
 * Run:
 *   npx ts-node db/seeds/seedShiftConfig.ts
 *   // or add "seed:shifts": "ts-node db/seeds/seedShiftConfig.ts" to package.json
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import ShiftConfig from "../../src/models/shiftConfig.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/dfcp";
const LC = process.env.SEED_LC_ID || "LC-1";
const TZ = "Asia/Jerusalem";

// Helpers
const h2m = (hh: number, mm: number = 0) => (hh * 60 + mm) % 1440;
const addWrap = (min: number, plus: number) => (min + plus) % 1440;

// Base (morning) in minutes since midnight
const base = {
  generalStart: h2m(1, 0),    // 01:00 -> 60
  generalEnd:   h2m(7, 0),    // 07:00 -> 420

  indStart:     h2m(1, 0),    // 01:00 -> 60
  indEnd:       h2m(3, 0),    // 03:00 -> 180

  delStart:     h2m(5, 30),   // 05:30 -> 330
  delEnd:       h2m(7, 0),    // 07:00 -> 420

  slotStart:    h2m(6, 0),    // 06:00 -> 360
  slotEnd:      h2m(7, 0),    // 07:00 -> 420
};

// 6-hour steps for the 4 shifts
const OFF = {
  morning: 0,
  afternoon: 360,   // +6h
  evening: 720,     // +12h
  night: 1080,      // +18h
} as const;

const NAMES = ["morning", "afternoon", "evening", "night"] as const;
type ShiftName = typeof NAMES[number];

function shiftRow(name: ShiftName) {
  const o = OFF[name];
  return {
    logisticCenterId: LC,
    name,
    timezone: TZ,

    generalStartMin: addWrap(base.generalStart, o),
    generalEndMin:   addWrap(base.generalEnd,   o),

    industrialDelivererStartMin: addWrap(base.indStart, o),
    industrialDelivererEndMin:   addWrap(base.indEnd,   o),

    delivererStartMin: addWrap(base.delStart, o),
    delivererEndMin:   addWrap(base.delEnd,   o),

    deliveryTimeSlotStartMin: addWrap(base.slotStart, o),
    deliveryTimeSlotEndMin:   addWrap(base.slotEnd,   o),

    slotSizeMin: 30, // granularity for splitting deliveryTimeSlot window (e.g., 30-minute slots)
  };
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  for (const name of NAMES) {
    const row = shiftRow(name);
    await ShiftConfig.findOneAndUpdate(
      { logisticCenterId: LC, name },
      { $set: row },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded ${name} — start ${row.generalStartMin} min, end ${row.generalEndMin} min`);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
