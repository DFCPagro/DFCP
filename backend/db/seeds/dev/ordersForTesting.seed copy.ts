/**
 * Seed 4 orders via createOrderForCustomer():
 *  - 3 past orders (days: -3, -2, -1) with random shifts → status "received"
 *  - 1 future order (next shift) → status "packing"
 *
 * Ensures an AMS exists per (ymd, shift) that matches your AMS schema:
 *  Required fields: LCid, availableDate, availableShift,
 *  items[].farmerID, originalCommittedQuantityKg, currentAvailableQuantityKg,
 *  pricePerKg, category, displayName
 *
 * And also includes fields your service uses (items._id, farmerOrderId, estimates, etc.).
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";

// --- adjust these imports to your project layout ---
import { connectDB, disconnectDB } from "../../../src/db/connect";
import { Order } from "../../../src/models/order.model";
import { Item } from "../../../src/models/Item.model";
import { createOrderForCustomer } from "../../../src/services/order.service";
import { AvailableMarketStockModel } from "../../../src/models/availableMarketStock.model";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const LC_ID = "66e007000000000000000001";       // LogisticsCenterId (string)
const CUSTOMER_ID = "66f2aa00000000000000001a";  // Existing customer id (string)
const MODE: "upsert" | "reuse" = "upsert";       // set "reuse" if you already have AMS docs

const SHIFT_CONFIG = [
  { name: "morning" as const,   startMin:  60,  endMin: 420  },
  { name: "afternoon" as const, startMin: 420,  endMin: 780  },
  { name: "evening" as const,   startMin: 780,  endMin: 1140 },
  { name: "night" as const,     startMin: 1140, endMin: 60   }, // wraps midnight
];
type ShiftName = typeof SHIFT_CONFIG[number]["name"];

// Realistic farmers
const FARMERS = [
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1e8"), farmerName: "Levy Cohen",     farmName: "Galilee Greens" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1e9"), farmerName: "Ayala Ben-David", farmName: "Sunrise Fields" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1ea"), farmerName: "Yousef Haddad",  farmName: "Valley Harvest" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1eb"), farmerName: "Maya Klein",     farmName: "Olive Ridge" },
  { farmerId: new Types.ObjectId("68960695a7850beaf8dac1ec"), farmerName: "Tomer Azulay",   farmName: "Coastal Farm" },
];

// -----------------------------
// Utils
// -----------------------------
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const id = (v: Types.ObjectId | string) => String(v);

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

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pickOne<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }

function pricePerKgFromItem(it: any) {
  const p = Number(it?.price?.a);
  return Number.isFinite(p) && p > 0 ? p : r2(rand(6, 24));
}
function avgUnitKgFromItem(it: any) {
  const gr = Number(it?.avgWeightPerUnitGr);
  if (Number.isFinite(gr) && gr > 0) return r3(gr / 1000);
  return null;
}
function makeDeliveryAddress(logisticCenterId: string) {
  return {
    lnt: 35.571, // longitude
    alt: 33.207, // latitude
    address: "123 Market St, Haifa, Israel",
    logisticCenterId,
  };
}

// -----------------------------
// AMS line (matches your schema & adds fields used by the service)
// -----------------------------
type AmsLine = {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;

  // REQUIRED by your AMS schema:
  farmerID: Types.ObjectId;                     // <— required
  originalCommittedQuantityKg: number;          // <— required
  currentAvailableQuantityKg: number;           // <— required
  pricePerKg: number;                           // <— required
  category: string;                             // <— required
  displayName: string;                          // <— required

  // Helpful for service / convenience:
  pricePerUnit?: number;                        // mirror pricePerKg
  currentAvailableUnits?: number;               // for unit reservations
  originalCommittedUnits?: number;
  farmerOrderId: Types.ObjectId;                // used by createOrderForCustomer lookup
  estimates?: { avgWeightPerUnitKg?: number | null; sdKg?: number | null };

  // Optional UI/meta:
  imageUrl?: string | null;
};

// -----------------------------
// Upsert/reuse AMS that satisfies your schema
// -----------------------------
async function upsertAMS(ymd: string, shift: ShiftName, lcId: string): Promise<{ amsId: Types.ObjectId, lines: AmsLine[] }> {
  // Try reuse first
  const existing = await AvailableMarketStockModel.findOne({ availableDate: new Date(`${ymd}T00:00:00.000Z`), availableShift: shift, LCid: lcId });
  if (existing && MODE === "reuse") {
    const raw = existing.toObject();
    return { amsId: existing._id, lines: (raw.items || []) as unknown as AmsLine[] };
  }

  const itemsPool = await Item.aggregate([{ $sample: { size: 12 } }]);
  if (!itemsPool.length) throw new Error("No items found for AMS seed.");

  const lcOID = new Types.ObjectId(lcId);

  const lines: AmsLine[] = itemsPool.map((it: any) => {
  const farmer = pickOne(FARMERS);
  const avgKg = avgUnitKgFromItem(it);
  const pricePerKg = pricePerKgFromItem(it);

  const committedKg = r3(rand(8, 60));
  const availableKg  = r3(Math.max(5, committedKg - rand(0, 5)));
  const committedUnits = avgKg ? randInt(12, 90) : 0;
  const availableUnits  = avgKg ? Math.max(6, Math.min(committedUnits, randInt(6, committedUnits))) : 0;

  const displayName =
    (it?.type && it?.variety) ? `${it.type} ${it.variety}` : (it?.type || it?.variety || "Fresh Produce");
  const category = typeof it?.category === "string" ? it.category : (it?.category?.name || "");

  // ✅ make sure these are plain strings (not undefined/null)
  const farmerName = String(farmer.farmerName || "Farmer");
  const farmName   = String(farmer.farmName   || "Farm");

  return {
    _id: new Types.ObjectId(),
    itemId: it._id,

    // REQUIRED by your AMS schema
    farmerID: farmer.farmerId,
    originalCommittedQuantityKg: committedKg,
    currentAvailableQuantityKg: availableKg,
    pricePerKg,
    category,
    displayName,

    // ✅ REQUIRED by your AMS schema (missing in your last run)
    farmerName,
    farmName,

    // helpful mirrors/extra fields
    pricePerUnit: pricePerKg,
    originalCommittedUnits: committedUnits,
    currentAvailableUnits: availableUnits,

    farmerOrderId: new Types.ObjectId(),
    estimates: avgKg ? { avgWeightPerUnitKg: avgKg, sdKg: Math.max(0.01, r3(avgKg * 0.15)) } : {},
    imageUrl: it?.imageUrl || null,
  };
});


  // Upsert doc — include BOTH required fields & what your service reads:
  const baseDoc = {
    LCid: lcOID,                                         // required by your schema
    availableDate: new Date(`${ymd}T00:00:00.000Z`),     // required by your schema
    availableShift: shift,                                // used by the service
    // keep any key your code might also use, e.g. ymd (harmless):
    ymd,
    items: lines,
  };

  const doc = existing
    ? await AvailableMarketStockModel.findByIdAndUpdate(existing._id, { $set: baseDoc }, { new: true })
    : await AvailableMarketStockModel.create(baseDoc);

  const raw = doc.toObject();
  return { amsId: doc._id, lines: (raw.items || []) as unknown as AmsLine[] };
}

// -----------------------------
// Build CreateOrderInput payload
//  - all IDs as strings
//  - includes legacy 'quantity' for typing
//  - includes modern unitMode/quantityKg/units for runtime normalizeItem()
// -----------------------------
function buildRandomPayloadFromAMS(opts: {
  amsId: Types.ObjectId;
  lines: AmsLine[];
  deliveryDate: Date;
  logisticsCenterId: string;
}) {
  const { amsId, lines, deliveryDate, logisticsCenterId } = opts;

  // choose 2–5 lines
  const chosen = [...lines].sort(() => Math.random() - 0.5).slice(0, Math.max(2, Math.min(5, lines.length)));

  const items = chosen.map((ln) => {
    // availability fields (schema names)
    const availKg = ln.currentAvailableQuantityKg || 0;
    const hasKg = availKg > 0;

    const avg = ln.estimates?.avgWeightPerUnitKg || 0;
    const availUnits = ln.currentAvailableUnits || 0;
    const hasUnits = (availUnits > 0) && (avg > 0);

    const pickMixed = hasKg && hasUnits && Math.random() < 0.6;
    const pickUnit = hasUnits && !pickMixed && Math.random() < 0.5;

    let unitMode: "kg" | "unit" | "mixed" = "kg";
    if (pickMixed) unitMode = "mixed";
    else if (pickUnit) unitMode = "unit";

    const quantityKg = unitMode !== "unit" && hasKg ? r2(Math.min(availKg, rand(0.35, 3.2))) : 0;
    const units = (unitMode !== "kg" && hasUnits) ? Math.max(1, Math.min(availUnits, randInt(1, 6))) : 0;

    const estimatedKg = r3((quantityKg || 0) + (units || 0) * (avg || 0));

    return {
      // legacy field required by your CreateOrderInput typing
      quantity: estimatedKg > 0 ? estimatedKg : (quantityKg || units || 1),

      // runtime fields used by normalizeItem(...)
      unitMode,
      quantityKg,
      units,

      // IDs & pricing & provenance
      itemId: id(ln.itemId),
      name: ln.displayName || "",
      imageUrl: ln.imageUrl || "",
      category: ln.category || "",
      pricePerUnit: ln.pricePerKg,                  // service treats as per-KG
      sourceFarmerName: FARMERS[0].farmerName,      // fallback if you don't store names on AMS
      sourceFarmName: FARMERS[0].farmName,
      farmerOrderId: id(ln.farmerOrderId),
    };
  });

  return {
    amsId: id(amsId),
    logisticsCenterId,
    deliveryDate,
    deliveryAddress: {
      ...makeDeliveryAddress(logisticsCenterId),
      logisticCenterId: logisticsCenterId,
    },
    items,
  };
}

// -----------------------------
// Main seeding routine
// -----------------------------
async function seedViaService() {
  const conn = await connectDB();
  console.log(`🔌 Connected to DB: ${conn.name}`);

  try {
    // 1) Three past "received" orders
    for (const daysAgo of [3, 2, 1]) {
      const when = addDays(new Date(), -daysAgo);
      const ymd = fmtYMD(when, TZ);
      const shift = chooseRandomShift();

      const { amsId, lines } = await upsertAMS(ymd, shift, LC_ID);
      const payload = buildRandomPayloadFromAMS({
        amsId,
        lines,
        deliveryDate: new Date(`${ymd}T00:00:00.000Z`),
        logisticsCenterId: LC_ID,
      });

      // Cast to bypass excess-property checks (we include runtime fields not in legacy type)
      const res = await createOrderForCustomer(CUSTOMER_ID, payload as any);
      await Order.findByIdAndUpdate(res.order._id, { status: "received" });

      console.log(`✔️ Past order via service: ${res.order._id} | ${ymd} ${shift} | amsId=${id(amsId)}`);
    }

    // 2) One future "packing" order
    const nx = nextShift(new Date());
    const { amsId, lines } = await upsertAMS(nx.ymd, nx.shift, LC_ID);

    const payload = buildRandomPayloadFromAMS({
      amsId,
      lines,
      deliveryDate: nx.date,
      logisticsCenterId: LC_ID,
    });

    const res = await createOrderForCustomer(CUSTOMER_ID, payload as any);
    await Order.findByIdAndUpdate(res.order._id, { status: "packing" });

    console.log(`✔️ Future order via service: ${res.order._id} | ${nx.ymd} ${nx.shift} | amsId=${id(amsId)}`);
    console.log("✅ Done seeding orders via service.");
  } catch (err) {
    console.error("❌ Seed (service) failed:", err);
    throw err;
  } finally {
    // tolerate disconnect errors
    try { await disconnectDB(); } catch { console.warn("⚠  MongoDB disconnected"); }
    console.log("🔌 Disconnected");
  }
}

// -----------------------------
// Run
// -----------------------------
if (require.main === module) {
  seedViaService().catch(() => process.exit(1));
}

export default seedViaService;
