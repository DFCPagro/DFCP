/**
 * Dev Seeder – Orders
 *
 * Seeds 15 orders total:
 *  • 5 for the current shift
 *  • 5 for the next shift
 *  • 5 for the shift after that
 *
 * Uses static data from `db/seeds/data/orders.seed.json`.
 * Does NOT create AMS documents — each order gets a random amsId.
 * Forces LogisticsCenterId = 66e007000000000000000001.
 *
 * Run:
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:orders
 */

import "dotenv/config";
import path from "path";
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../../../src/db/connect";
import { Order } from "../../../src/models/order.model";
import { loadJSON } from "../utils/io";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const LC_ID = "66e007000000000000000001";
const DATA_PATH = path.resolve(__dirname, "../data/orders.data.json");

const SHIFT_CONFIG = [
  { name: "morning" as const, startMin: 360, endMin: 720 },
  { name: "afternoon" as const, startMin: 720, endMin: 1080 },
  { name: "evening" as const, startMin: 1080, endMin: 1380 },
  { name: "night" as const, startMin: 1380, endMin: 1740 }, // wraps midnight
];
type ShiftName = typeof SHIFT_CONFIG[number]["name"];

// -----------------------------
// Time helpers
// -----------------------------
function fmtYMD(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // "YYYY-MM-DD"
}
function minutesSinceMidnight(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hh, mm] = fmt.format(date).split(":").map(Number);
  return hh * 60 + mm;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function isInShift(mins: number, start: number, end: number) {
  return end <= 1440 ? start <= mins && mins < end : mins >= start || mins < (end - 1440);
}

// determine current + next two shifts
function getNextThreeShifts(now = new Date()): Array<{ ymd: string; shift: ShiftName }> {
  const mins = minutesSinceMidnight(now, TZ);
  let curIdx = 0;
  for (let i = 0; i < SHIFT_CONFIG.length; i++) {
    if (isInShift(mins, SHIFT_CONFIG[i].startMin, SHIFT_CONFIG[i].endMin)) {
      curIdx = i;
      break;
    }
  }

  const result: Array<{ ymd: string; shift: ShiftName }> = [];
  for (let k = 0; k < 3; k++) {
    const idx = (curIdx + k) % SHIFT_CONFIG.length;
    const wraps = curIdx + k >= SHIFT_CONFIG.length;
    const date = wraps ? addDays(now, 1) : now;
    result.push({ ymd: fmtYMD(date, TZ), shift: SHIFT_CONFIG[idx].name });
  }
  return result;
}

// -----------------------------
// Seed logic
// -----------------------------
async function seed() {
  const conn = await connectDB();
  console.log(`🔌 Connected to DB: ${conn.name}`);

  try {
    const staticData: any[] = await loadJSON(DATA_PATH);
    if (!Array.isArray(staticData) || staticData.length === 0) {
      throw new Error("orders.seed.json is empty or invalid.");
    }

    const windows = getNextThreeShifts(new Date());
    console.log(`📦 Using 3 shifts: ${windows.map((w) => `${w.ymd} ${w.shift}`).join(", ")}`);

    const needed = 15;
    const docs: any[] = [];
    for (let i = 0; i < needed; i++) docs.push(staticData[i % staticData.length]);

    const ordersToInsert: any[] = [];
    let cursor = 0;

    for (const win of windows) {
      for (let j = 0; j < 5; j++) {
        const src = { ...docs[cursor++] };
        const order = {
          ...src,
          _id: new Types.ObjectId(),
          deliveryDate: new Date(`${win.ymd}T00:00:00.000Z`),
          shiftName: win.shift,
          LogisticsCenterId: new Types.ObjectId(LC_ID),
          amsId: new Types.ObjectId(), // random AMS per order
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        ordersToInsert.push(order);
      }
    }

    // Clear old dev orders first (optional)
    await Order.deleteMany({});
    const inserted = await Order.insertMany(ordersToInsert);
    console.log(`✅ Inserted ${inserted.length} orders (5 per shift × 3 shifts)`);

  } catch (err) {
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    await disconnectDB().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

// -----------------------------
if (require.main === module) {
  seed().catch(() => process.exit(1));
}
export default seed;
