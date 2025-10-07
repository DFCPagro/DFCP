/**
 * Seed 4 orders for one customer:
 *  - 3 past orders with status "received"
 *  - 1 future order (next shift) with status "packing"
 * AMS: DO NOT create AMS docs. Assign a unique random amsId per (date, shift).
 * Item price: take price.a from Item document.
 *
 * Run:
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:testorders
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";

import { connectDB, disconnectDB } from "../../../src/db/connect";
import { Order } from "../../../src/models/order.model";
import { Item } from "../../../src/models/Item.model";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const LC_ID = "66e007000000000000000001";       // LogisticsCenterId (ObjectId string)
const CUSTOMER_ID = "66f2aa00000000000000001a";  // Existing customer id (ObjectId string)

const SHIFT_CONFIG = [
  { name: "morning" as const,   startMin:  60,  endMin: 420  },
  { name: "afternoon" as const, startMin: 420,  endMin: 780  },
  { name: "evening" as const,   startMin: 780,  endMin: 1140 },
  { name: "night" as const,     startMin: 1140, endMin: 60   }, // wraps midnight
];
type ShiftName = typeof SHIFT_CONFIG[number]["name"];

// Fake farmers (randomized per item line)
const FARMERS = [
  { farmerId: new Types.ObjectId(), farmerName: "Levy Cohen",     farmName: "Galilee Greens" },
  { farmerId: new Types.ObjectId(), farmerName: "Ayala Ben-David", farmName: "Sunrise Fields" },
  { farmerId: new Types.ObjectId(), farmerName: "Yousef Haddad",  farmName: "Valley Harvest" },
  { farmerId: new Types.ObjectId(), farmerName: "Maya Klein",     farmName: "Olive Ridge" },
  { farmerId: new Types.ObjectId(), farmerName: "Tomer Azulay",   farmName: "Coastal Farm" },
];

// -----------------------------
// Time helpers
// -----------------------------
function fmtYMD(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(date); // "YYYY-MM-DD"
}
function parts(date: Date, timeZone: string) {
  const ps = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const g = (t: string) => Number(ps.find(p => p.type === t)?.value);
  return { year: g("year"), month: g("month"), day: g("day"), hour: g("hour"), minute: g("minute") };
}
function minuteOfDay(date: Date, timeZone: string) {
  const { hour, minute } = parts(date, timeZone);
  return hour * 60 + minute;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function chooseRandomShift(): ShiftName {
  return SHIFT_CONFIG[Math.floor(Math.random() * SHIFT_CONFIG.length)].name;
}
function nextShift(now = new Date()): { ymd: string; shift: ShiftName; date: Date } {
  const mod = minuteOfDay(now, TZ);
  const { year, month, day } = parts(now, TZ);
  const todayUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  const candidates: Array<{ dayOffset: number; shift: ShiftName; startMin: number }> = [];
  for (let d = 0; d < 3; d++) for (const s of SHIFT_CONFIG) candidates.push({ dayOffset: d, shift: s.name, startMin: s.startMin });

  const nx = candidates
    .filter(c => (c.dayOffset > 0 ? true : c.startMin > mod))
    .sort((a, b) => (a.dayOffset - b.dayOffset) || (a.startMin - b.startMin))[0];

  const localDate = new Date(todayUTC + nx.dayOffset * 24 * 60 * 60 * 1000);
  const ymd = fmtYMD(localDate, TZ);
  return { ymd, shift: nx.shift, date: new Date(`${ymd}T00:00:00.000Z`) };
}

// -----------------------------
// Data helpers
// -----------------------------
function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pickOne<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }

async function sampleItems(n: number) {
  const total = await Item.countDocuments({});
  if (total === 0) throw new Error("No items found in DB.");
  const size = Math.min(n, total);
  const docs = await Item.aggregate([{ $sample: { size } }]); // diverse set
  return docs;
}

function makeDeliveryAddress(logisticCenterId: string) {
  // Keep in sync with your AddressSchema. This matches previous seeds you shared.
  return {
    lnt: 35.571,
    alt: 33.207,
    address: "123 Market St, Haifa, Israel",
    logisticCenterId,
  };
}

function itemDisplayName(it: any) {
  // adapt to your Item fields (type/variety or name)
  if (it?.type && it?.variety) return `${it.type} ${it.variety}`;
  if (it?.displayName) return it.displayName;
  return it?.type || it?.variety || it?.name || "Fresh Produce";
}

function categoryFromItem(it: any) {
  if (typeof it?.category === "string") return it.category;
  if (it?.category?.name) return it.category.name;
  return "";
}

function priceFromItemA(it: any) {
  const p = Number(it?.price?.a);
  return !isNaN(p) && p > 0 ? p : Math.round(rand(6, 24) * 100) / 100; // fallback
}

// Estimates: try to pull from item avgWeightPerUnitGr, else create a plausible value
function avgUnitKgFromItem(it: any) {
  const gr = Number(it?.avgWeightPerUnitGr);
  if (Number.isFinite(gr) && gr > 0) return Math.round((gr / 1000) * 1000) / 1000;
  // fallback range 0.12kg–1.4kg
  return Math.round(rand(0.12, 1.4) * 1000) / 1000;
}

type UnitMode = "kg" | "unit" | "mixed";
function pickUnitMode(): UnitMode {
  const r = Math.random();
  if (r < 0.45) return "kg";
  if (r < 0.80) return "unit";
  return "mixed";
}

function randomQuantityKg() {
  // 0.3–3.5 kg
  return Math.round(rand(0.3, 3.5) * 100) / 100;
}

function randomUnits() {
  // 1–8 units
  return randInt(1, 8);
}

function makeOrderItems(fromItems: any[]) {
  const count = randInt(2, Math.min(5, fromItems.length));
  const chosen = [...fromItems].sort(() => Math.random() - 0.5).slice(0, count);

  return chosen.map((it) => {
    const farmer = pickOne(FARMERS);
    const mode = pickUnitMode();

    // establish defaults
    let quantityKg = 0;
    let units = 0;
    const avgKg = avgUnitKgFromItem(it);
    const stdDevKg = Math.round(rand(0.01, Math.max(0.02, avgKg * 0.15)) * 1000) / 1000;

    if (mode === "kg") {
      quantityKg = randomQuantityKg();
      units = 0;
    } else if (mode === "unit") {
      units = randomUnits();
      quantityKg = 0;
    } else {
      // mixed: both may be positive
      quantityKg = Math.random() < 0.7 ? randomQuantityKg() : 0;
      units = Math.random() < 0.7 ? randomUnits() : 0;
      if (quantityKg === 0 && units === 0) {
        // ensure at least one
        quantityKg = randomQuantityKg();
      }
    }

    return {
      // --- required by OrderItemSchema ---
      itemId: new Types.ObjectId(it._id),
      name: itemDisplayName(it),
      imageUrl: it?.imageUrl || "",
      category: categoryFromItem(it),

      pricePerUnit: priceFromItemA(it), // per KG

      unitMode: mode,
      quantityKg,
      units,
      estimatesSnapshot: {
        avgWeightPerUnitKg: units > 0 ? avgKg : null,
        stdDevKg: units > 0 ? stdDevKg : null,
      },

      // Final weights left undefined (set during packing flow)
      finalWeightKg: undefined,
      finalizedAt: undefined,
      finalizedBy: undefined,

      // provenance
      sourceFarmerName: farmer.farmerName,
      sourceFarmName: farmer.farmName,
      farmerOrderId: new Types.ObjectId(), // random link for seed
    };
  });
}

// -----------------------------
// AMS ID manager (no DB writes)
// -----------------------------
// Keep a unique random ObjectId per (date, shift)
const amsIdByKey = new Map<string, Types.ObjectId>();

function getAmsIdForKey(ymd: string, shift: ShiftName): Types.ObjectId {
  const key = `${ymd}__${shift}`;
  let id = amsIdByKey.get(key);
  if (!id) {
    id = new Types.ObjectId();
    amsIdByKey.set(key, id);
  }
  return id;
}

// -----------------------------
// Seed workflow
// -----------------------------
async function seed() {
  const conn = await connectDB();
  console.log(`🔌 Connected to DB: ${conn.name}`);

  try {
    // Pull a pool of ~12 items to randomize
    const itemsPool = await sampleItems(12);
    console.log(`[Items] Pulled ${itemsPool.length}`);

    // 1) Three past "received" orders: -3d, -2d, -1d; random shifts
    for (const daysAgo of [3, 2, 1]) {
      const when = addDays(new Date(), -daysAgo);
      const ymd = fmtYMD(when, TZ);
      const shift = chooseRandomShift();

      const amsId = getAmsIdForKey(ymd, shift);
      const items = makeOrderItems(itemsPool);

      const order = await Order.create({
        customerId: new Types.ObjectId(CUSTOMER_ID),
        deliveryAddress: makeDeliveryAddress(LC_ID),
        deliveryDate: new Date(`${ymd}T00:00:00.000Z`),
        shiftName: shift,
        LogisticsCenterId: new Types.ObjectId(LC_ID),
        amsId,
        items,
        status: "received", // matches enum
        assignedDelivererId: null,
        customerDeliveryId: null,
        historyAuditTrail: [],
      });

      console.log(`✔️ Past order: ${order._id.toString()} | ${ymd} ${shift} | amsId=${amsId.toString()}`);
    }

    // 2) One future "packing" order on next shift
    const nx = nextShift(new Date());
    const amsId = getAmsIdForKey(nx.ymd, nx.shift);
    const items = makeOrderItems(itemsPool);

    const futureOrder = await Order.create({
      customerId: new Types.ObjectId(CUSTOMER_ID),
      deliveryAddress: makeDeliveryAddress(LC_ID),
      deliveryDate: nx.date,
      shiftName: nx.shift,
      LogisticsCenterId: new Types.ObjectId(LC_ID),
      amsId,
      items,
      status: "packing",
      assignedDelivererId: null,
      customerDeliveryId: null,
      historyAuditTrail: [],
    });

    console.log(`✔️ Future order (packing): ${futureOrder._id.toString()} | ${nx.ymd} ${nx.shift} | amsId=${amsId.toString()}`);
    console.log("✅ Done seeding orders.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    await disconnectDB().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

if (require.main === module) {
  seed().catch(() => process.exit(1));
}

export default seed;
