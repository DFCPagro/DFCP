/**
 * Seed ShiftConfig collection with default shifts
 *
 * Usage:
 *   npx ts-node db/seeds/seedShiftConfig.ts
 * or with npm script:
 *   "seed:shifts": "ts-node db/seeds/seedShiftConfig.ts"
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import ShiftConfig from "../../src/models/shiftConfig.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/dfcp";
// npm run seed:shifts

async function seed() {
  await mongoose.connect(MONGO_URI);

  const logisticCenterId = "LC-1"; // change or add more as needed
  const timezone = "Asia/Jerusalem";

  const seeds = [
    {
      logisticCenterId,
      name: "morning",
      timezone,
      generalStartMin: 360,  // 06:00
      generalEndMin:  900,   // 15:00
      industrialDelivererStartMin: 420,  // 07:00
      industrialDelivererEndMin:   840,  // 14:00
      delivererStartMin: 540,   // 09:00
      delivererEndMin:   1080,  // 18:00
      deliveryTimeSlotStartMin: 600, // 10:00
      deliveryTimeSlotEndMin:   1020, // 17:00
      slotSizeMin: 30,
    },
    {
      logisticCenterId,
      name: "afternoon",
      timezone,
      generalStartMin: 900,   // 15:00
      generalEndMin:   1260,  // 21:00
      industrialDelivererStartMin: 930,  // 15:30
      industrialDelivererEndMin:   1200, // 20:00
      delivererStartMin: 960,   // 16:00
      delivererEndMin:   1320,  // 22:00
      deliveryTimeSlotStartMin: 990,  // 16:30
      deliveryTimeSlotEndMin:   1260, // 21:00
      slotSizeMin: 30,
    },
    {
      logisticCenterId,
      name: "evening",
      timezone,
      generalStartMin: 1260,  // 21:00
      generalEndMin:   1439,  // 23:59
      industrialDelivererStartMin: 1260, // 21:00
      industrialDelivererEndMin:   1380, // 23:00
      delivererStartMin: 1260, // 21:00
      delivererEndMin:   1439, // 23:59
      deliveryTimeSlotStartMin: 1260, // 21:00
      deliveryTimeSlotEndMin:   1410, // 23:30
      slotSizeMin: 30,
    },
    {
      logisticCenterId,
      name: "night",
      timezone,
      generalStartMin: 0,   // 00:00
      generalEndMin:   360, // 06:00
      industrialDelivererStartMin: 0,
      industrialDelivererEndMin:   300, // 05:00
      delivererStartMin: 60,   // 01:00
      delivererEndMin:   360,  // 06:00
      deliveryTimeSlotStartMin: 120, // 02:00
      deliveryTimeSlotEndMin:   330, // 05:30
      slotSizeMin: 30,
    },
  ];

  for (const s of seeds) {
    await ShiftConfig.findOneAndUpdate(
      { logisticCenterId: s.logisticCenterId, name: s.name },
      { $set: s },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded shift ${s.name} for ${s.logisticCenterId}`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
