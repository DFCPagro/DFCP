/**
 * Dev Seeder – Orders (+ PickerTasks bootstrap for current shift)
 *
 * Seeds 30 orders total:
 *  • 10 for the current shift
 *  • 10 for the next shift
 *  • 10 for the shift after that
 *
 * Uses static data from `db/seeds/data/orders.data.json`.
 * Does NOT create AMS documents — each order gets a random amsId.
 * Forces LogisticsCenterId = 66e007000000000000000001.
 *
 * After seeding, generates PickerTasks **for the current shift only**,
 * then marks the **first 7 tasks** as "ready".
 *
 * Run:
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   $env:ADMIN_USER_ID="66e00700000000000000abcd"  # optional
 *   npm run seed:orders
 */

import "dotenv/config";
import path from "path";
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../../../src/db/connect";
import { Order } from "../../../src/models/order.model";
import { loadJSON } from "../utils/io";

// 👇 imports for picker tasks
import { default as PickerTaskModel } from "../../../src/models/PickerTasks.model";
import { generatePickerTasksForShift } from "../../../src/services/pickerTasks.service";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const LC_ID = "66e007000000000000000001";
const DATA_PATH = path.resolve(__dirname, "../data/orders.data.json");

const ORDERS_PER_SHIFT = 10;

const ITEM_NAME_BY_ID: Record<string, string> = {
  "db63c0177cfae45a8385313a": "Apple Fuji",
  "6873f67b8027abff0fdb32f3": "Banana Cavendish",
  "bb87115ed0ab8a728b7d9622": "Orange Navel",
  "497bb3e65bf348533160cec0": "Grapes Red Globe",
  "30eb71d9a20cb517be34112f": "Strawberry Albion",
  "ad126949daa1c7dd61ffcc4c": "Tomato Cherry",
  "39bd70c4db17647c60d33c8f": "Lettuce Romaine",
  "fa56428339a4f47db7d15600": "Cucumber Persian",
  "885df3d97431436c3a205ff3": "Carrot Nantes",
  "f68140ef8273c40bbae48b98": "Spinach Baby",
  "64f1e2c3a5b6c7d8e9f0a1b2": "Eggs Free Range",
};

const SHIFT_CONFIG = [
  { name: "morning" as const, startMin: 360, endMin: 720 },
  { name: "afternoon" as const, startMin: 720, endMin: 1080 },
  { name: "evening" as const, startMin: 1080, endMin: 1380 },
  { name: "night" as const, startMin: 1380, endMin: 1740 }, // wraps midnight
];
type ShiftName = (typeof SHIFT_CONFIG)[number]["name"];

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
  return end <= 1440 ? start <= mins && mins < end : mins >= start || mins < end - 1440;
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
      throw new Error("orders.data.json is empty or invalid.");
    }

    const windows = getNextThreeShifts(new Date());
    console.log(`📦 Using 3 shifts: ${windows.map((w) => `${w.ymd} ${w.shift}`).join(", ")}`);

    // build a pool of docs we can cycle through
    const needed = ORDERS_PER_SHIFT; // per shift
    const docs: any[] = [];
    for (let i = 0; i < needed; i++) docs.push(staticData[i % staticData.length]);

    const ordersToInsert: any[] = [];
    let cursor = 0;

    for (const win of windows) {
      for (let j = 0; j < ORDERS_PER_SHIFT; j++) {
        const src = { ...docs[cursor++ % docs.length] };

        // (optional) ensure lines have name if missing: use ITEM_NAME_BY_ID
        if (Array.isArray(src.items)) {
          src.items = src.items.map((row: any) => ({
            ...row,
            name:
              row?.name ||
              ITEM_NAME_BY_ID[String(row?.itemId)] ||
              ITEM_NAME_BY_ID[String(row?.itemID)] ||
              undefined,
          }));
        }

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
    console.log(`✅ Inserted ${inserted.length} orders (${ORDERS_PER_SHIFT} per shift × 3 shifts)`);

    // ---------------------------------------------------------
// Generate PickerTasks for ALL three shifts and flip 7 per shift
// ---------------------------------------------------------
const ADMIN_USER_ID =
  process.env.ADMIN_USER_ID && Types.ObjectId.isValid(process.env.ADMIN_USER_ID)
    ? new Types.ObjectId(process.env.ADMIN_USER_ID)
    : new Types.ObjectId(); // fallback dummy

for (const win of windows) {
  console.log(`🧰 Generating picker tasks for ${win.ymd} ${win.shift} (LC=${LC_ID})`);

  // Keep new tasks OPEN (autoSetReady: false). We’ll flip exactly 7 below.
  const genRes = await generatePickerTasksForShift({
    logisticCenterId: LC_ID,
    createdByUserId: ADMIN_USER_ID,
    shiftName: win.shift,
    shiftDate: win.ymd,
    autoSetReady: false,
  });

  console.log(
    `📋 ${win.ymd} ${win.shift}: created=${genRes.createdCount}, existed=${genRes.alreadyExisted}, ordersProcessed=${genRes.ordersProcessed}`
  );

  // Flip first 7 OPEN tasks to READY (stable order: priority desc, FIFO within priority)
  const toReady = await PickerTaskModel.find({
    logisticCenterId: new Types.ObjectId(LC_ID),
    shiftName: win.shift,
    shiftDate: win.ymd,
    status: "open",
  })
    .sort({ priority: -1, createdAt: 1, _id: 1 })
    .select({ _id: 1 })
    .limit(7)
    .lean()
    .exec();

  if (toReady.length > 0) {
    await PickerTaskModel.updateMany(
      { _id: { $in: toReady.map((t) => t._id) } },
      { $set: { status: "ready" } }
    );
  }

  console.log(`🚦 ${win.ymd} ${win.shift}: marked ${toReady.length} tasks as "ready"`);
}

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
