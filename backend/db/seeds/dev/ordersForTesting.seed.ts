/**
 * Seed 4 orders for one customer (DIRECT ORDER INSERT + QR mint):
 *  - 3 past orders with status "received"
 *  - 1 future order (next shift) with status "packing"
 * AMS: DO NOT create AMS docs. Assign a unique random amsId per (date, shift).
 * Item price: take price.a (per KG) from Item document.
 * For each order, mint/reuse a QR via ensureOrderToken().
 *
 * Run:
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:testorders
 */

import "dotenv/config";
import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";

import { connectDB, disconnectDB } from "../../../src/db/connect";
import { Order as OrderModel } from "../../../src/models/order.model";
import { Item } from "../../../src/models/Item.model";
import QRModel from "../../../src/models/QRModel.model"; // <-- adjust if your QR model path differs
import ApiError from "../../../src/utils/ApiError"; // <-- adjust if your error util path differs

// Import only the QR service helpers you need.  Use ensureOrderToken from the
// main ops.service so that the seeder uses the exact same signer/claims logic.
import { ensureOrderToken as ensureOrderTokenService, verifyQRSignature } from "../../../src/services/ops.service";

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

// -----------------------------
// Small math helpers (consistent rounding)
// -----------------------------
const r2 = (n: number) => Math.round(n * 100) / 100;    // cents
const r3 = (n: number) => Math.round(n * 1000) / 1000;  // kg precision

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

// Matches your AddressSchema (address, alt, lnt, logisticCenterId)
function makeDeliveryAddress(logisticCenterId: string) {
  return {
    lnt: 35.571, // longitude
    alt: 33.207, // latitude
    address: "123 Market St, Haifa, Israel",
    logisticCenterId,
  };
}

function itemDisplayName(it: any) {
  if (it?.type && it?.variety) return `${it.type} ${it.variety}`;
  if (it?.displayName) return it.displayName;
  return it?.type || it?.variety || it?.name || "Fresh Produce";
}

function categoryFromItem(it: any) {
  if (typeof it?.category === "string") return it.category;
  if (it?.category?.name) return it.category.name;
  return "";
}

function pricePerKgFromItem(it: any) {
  const p = Number(it?.price?.a);
  return Number.isFinite(p) && p > 0 ? p : r2(rand(6, 24)); // defensive fallback
}

function avgUnitKgFromItem(it: any) {
  const gr = Number(it?.avgWeightPerUnitGr);
  if (Number.isFinite(gr) && gr > 0) return r3(gr / 1000);  // grams → kg (3dp)
  return 0; // no avg known
}

function stdDevKgFromItem(it: any, avgKg: number) {
  const sdGr = Number(it?.sdWeightPerUnitGr);
  if (Number.isFinite(sdGr) && sdGr > 0) return r3(sdGr / 1000);
  if (avgKg > 0) return r3(Math.max(0.01, avgKg * 0.15));
  return null;
}

type UnitMode = "kg" | "unit" | "mixed";

/** Decide unitMode from Item.sellModes + presence of avg */
function decideUnitModeFromItem(it: any): UnitMode {
  const byKg = it?.sellModes?.byKg !== false; // default true
  const byUnit = !!it?.sellModes?.byUnit;
  const hasAvg = Number.isFinite(it?.avgWeightPerUnitGr) && it.avgWeightPerUnitGr > 0;

  if (byUnit && byKg && hasAvg) return "mixed";
  if (byUnit && hasAvg) return "unit";
  return "kg";
}

function randomQuantityKg() {
  return r2(rand(0.35, 3.2)); // 0.35–3.2 kg
}
function randomUnits() {
  return randInt(1, 8);
}

/** Create order lines that always pass OrderItemSchema validation and mirror model math */
function makeOrderItems(fromItems: any[]) {
  const count = randInt(2, Math.min(5, fromItems.length));
  const chosen = [...fromItems].sort(() => Math.random() - 0.5).slice(0, count);

  return chosen.map((it) => {
    const farmer = pickOne(FARMERS);

    const pricePerKg = pricePerKgFromItem(it);
    const unitMode: UnitMode = decideUnitModeFromItem(it);

    let quantityKg = 0;
    let units = 0;

    const avgKg = avgUnitKgFromItem(it);          // 0 means unknown
    const stdDevKg = stdDevKgFromItem(it, avgKg); // null or 3dp number

    if (unitMode === "kg") {
      quantityKg = randomQuantityKg();
    } else if (unitMode === "unit") {
      if (avgKg > 0) {
        units = randomUnits();
      } else {
        quantityKg = randomQuantityKg();
      }
    } else {
      // mixed
      if (avgKg > 0) {
        quantityKg = r2(rand(0.25, 2.0));
        units = randomUnits();
      } else {
        quantityKg = randomQuantityKg();
      }
    }

    const estKg = quantityKg + (units * avgKg);
    const name = itemDisplayName(it);
    const category = categoryFromItem(it);

    return {
      itemId: it._id,
      name,
      imageUrl: it.imageUrl || "",
      category,
      pricePerUnit: pricePerKg,
      pricePerKg,
      derivedUnitPrice: null,
      unitMode,
      quantityKg,
      units,
      estimatesSnapshot: {
        avgWeightPerUnitKg: avgKg || null,
        stdDevKg,
      },
      finalWeightKg: undefined,
      finalizedAt: undefined,
      finalizedBy: undefined,
      sourceFarmerName: farmer.farmerName,
      sourceFarmName: farmer.farmName,
      farmerOrderId: farmer.farmerId,
    };
  });
}

// Reuse your FARMERS pool from earlier
const FARMERS = [
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1e8"), farmerName: "Levy Cohen",     farmName: "Galilee Greens" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1e9"), farmerName: "Ayala Ben-David", farmName: "Sunrise Fields" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1ea"), farmerName: "Yousef Haddad",  farmName: "Valley Harvest" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1eb"), farmerName: "Maya Klein",     farmName: "Olive Ridge" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1ec"), farmerName: "Tomer Azulay",   farmName: "Coastal Farm" },
];

// -----------------------------
// AMS ID manager (no DB writes, as in your original)
// -----------------------------
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

      const order = await OrderModel.create({
        customerId: new Types.ObjectId(CUSTOMER_ID),
        deliveryAddress: makeDeliveryAddress(LC_ID),
        deliveryDate: new Date(`${ymd}T00:00:00.000Z`),
        shiftName: shift,
        LogisticsCenterId: new Types.ObjectId(LC_ID),
        amsId,
        items,
        status: "received",
        assignedDelivererId: null,
        customerDeliveryId: null,
        historyAuditTrail: [],
      });

      const qr = await ensureOrderTokenService({
        orderId: order._id,
        createdBy: new Types.ObjectId(CUSTOMER_ID),
        usagePolicy: "multi-use",
      });

      console.log(
        `✔️ Past order: ${order._id.toString()} | ${ymd} ${shift} | amsId=${amsId.toString()} | QR=${qr.token}`
      );
    }

    // 2) One future "packing" order on next shift
    const nx = nextShift(new Date());
    const amsId = getAmsIdForKey(nx.ymd, nx.shift);
    const items = makeOrderItems(itemsPool);

    const futureOrder = await OrderModel.create({
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

    const qr = await ensureOrderTokenService({
      orderId: futureOrder._id,
      createdBy: new Types.ObjectId(CUSTOMER_ID),
      usagePolicy: "multi-use",
    });

    console.log(
      `✔️ Future order (packing): ${futureOrder._id.toString()} | ${nx.ymd} ${nx.shift} | amsId=${amsId.toString()} | QR=${qr.token}`
    );
    console.log("✅ Done seeding orders + QR.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    await disconnectDB();
  }
}

// -----------------------------
// Execute
// -----------------------------
seed().then(() => process.exit(0)).catch(() => process.exit(1));
