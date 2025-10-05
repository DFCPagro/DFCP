/**
 * Seed: next TWO AMS docs (empty), then for each shift:
 *   - pick 5 items
 *   - create 5 farmer orders for Farmer 1 (one per item) AND the same 5 for Farmer 2
 *   - random committed kg per farmer order
 *   - set farmerStatus="ok" and add to AMS with unitMode + estimates
 *
 * Run (PowerShell):
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:ams
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";

import { connectDB, disconnectDB } from "../../../src/db/connect";
import { listItems } from "../../../src/services/items.service";
import {
  addItemToAvailableMarketStock,
  getAvailableMarketStockByKey,
} from "../../../src/services/availableMarketStock.service";
import { AvailableMarketStockModel } from "../../../src/models/availableMarketStock.model";
import { FarmerOrder } from "../../../src/models/farmerOrder.model";
import { Item } from "../../../src/models/Item.model";
import { getContactInfoByIdService } from "../../../src/services/user.service";
import { buildAmsItemFromItem } from "../../../src/services/amsLine.builder";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const STATIC_LC_ID = "66e007000000000000000001";            // LC _id (hex string)
const FARMER_MANAGER_ID = "66f2aa000000000000000005";        // createdBy/updatedBy

// static *user* IDs for two farmers (assumed == Farmer._id)
const Farmer1_ID = "66f2aa000000000000000008";
const Farmer2_ID = "66f2aa00000000000000002a";

const SHIFT_CONFIG = [
  { name: "morning" as const,   startMin:  60, endMin:  420 },
  { name: "afternoon" as const, startMin: 420, endMin:  780 },
  { name: "evening" as const,   startMin: 780, endMin: 1140 },
  { name: "night" as const,     startMin: 1140, endMin:   60 }, // crosses midnight
];

const ITEMS_PER_SHIFT = 5;

// -----------------------------
// Utilities
// -----------------------------
function fmtYMD(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(date); // "YYYY-MM-DD"
}
function getLocalHM(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}
function minuteOfDay(date: Date, timeZone: string) {
  const { year, month, day, hour, minute } = getLocalHM(date, timeZone);
  const d = new Date(Date.UTC(year, month - 1, day));
  const ymd = fmtYMD(d, "UTC");
  return { ymd, minute: hour * 60 + minute };
}
function nextTwoShifts(now = new Date()) {
  const { minute } = minuteOfDay(now, TZ);
  function enumerateNext(n: number) {
    const out: Array<{ ymd: string; name: "morning" | "afternoon" | "evening" | "night" }> = [];
    const { year, month, day } = getLocalHM(now, TZ);
    const todayUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const candidates: Array<{ dayOffset: number; name: typeof SHIFT_CONFIG[number]["name"]; startMin: number }> = [];
    for (let d = 0; d < 3; d++) for (const s of SHIFT_CONFIG) candidates.push({ dayOffset: d, name: s.name, startMin: s.startMin });
    const filtered = candidates
      .filter(c => (c.dayOffset > 0 ? true : c.startMin > minute))
      .sort((a, b) => (a.dayOffset - b.dayOffset) || (a.startMin - b.startMin));
    for (let i = 0; i < Math.min(n, filtered.length); i++) {
      const c = filtered[i];
      const dateLocal = new Date(todayUTC + c.dayOffset * 24 * 60 * 60 * 1000);
      out.push({ ymd: fmtYMD(dateLocal, TZ), name: c.name });
    }
    return out;
  }
  return enumerateNext(2);
}
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function isEggs(item: any): boolean {
  const t = String(item?.type || "").toLowerCase();
  const v = String(item?.variety || "").toLowerCase();
  const c = String(item?.category || "").toLowerCase();
  return t.includes("egg") || v.includes("egg") || c.includes("egg");
}

// -----------------------------
// AMS helpers
// -----------------------------
async function ensureEmptyAMS(LCid: string, dateYMD: string, shift: "morning" | "afternoon" | "evening" | "night") {
  let doc = await getAvailableMarketStockByKey({ LCid, date: dateYMD, shift });
  if (!doc) {
    doc = await AvailableMarketStockModel.create({
      LCid: new Types.ObjectId(LCid),
      availableDate: new Date(`${dateYMD}T00:00:00.000Z`),
      availableShift: shift,
      items: [],
    });
    return doc._id.toString();
  }
  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    doc._id, { $set: { items: [] } }, { new: true }
  );
  return updated!._id.toString();
}
async function ensureAMSId(LCid: string, dateYMD: string, shift: "morning" | "afternoon" | "evening" | "night") {
  const existing = await getAvailableMarketStockByKey({ LCid, date: dateYMD, shift });
  if (existing) return String(existing._id);
  const created = await AvailableMarketStockModel.create({
    LCid: new Types.ObjectId(LCid),
    availableDate: new Date(`${dateYMD}T00:00:00.000Z`),
    availableShift: shift,
    items: [],
  });
  return String(created._id);
}

// -----------------------------
// Items pool
// -----------------------------
async function pickRandomItems(n: number) {
  const pool = await listItems({}, { limit: 200, page: 1, sort: "-updatedAt", lean: true });
  const arr = pool.items || [];
  if (arr.length < n) throw new Error(`Not enough items in DB to sample ${n}. Found: ${arr.length}`);
  const chosen: any[] = [];
  const used = new Set<number>();
  while (chosen.length < n) {
    const idx = randInt(0, arr.length - 1);
    if (!used.has(idx)) { used.add(idx); chosen.push(arr[idx]); }
  }
  return chosen;
}

// -----------------------------
// Seed
// -----------------------------
async function seed() {
  const conn = await connectDB();
  console.log(`🔌 Connected to ${conn.name}`);

  try {
    // fetch farmer display data once (by *user* id)
    const f1 = await getContactInfoByIdService(Farmer1_ID);
    const f2 = await getContactInfoByIdService(Farmer2_ID);

    // For FarmerOrder.farmerId we assume Farmer _id == User _id; adjust if different.
    const FARMERS = [
      { farmerUserId: Farmer1_ID, farmerId: new Types.ObjectId(Farmer1_ID), farmerName: f1.name, farmName: f1.farmName || "freshy fresh", farmLogo: f1.farmLogo ?? null },
      { farmerUserId: Farmer2_ID, farmerId: new Types.ObjectId(Farmer2_ID), farmerName: f2.name, farmName: f2.farmName || "freshy fresh", farmLogo: f2.farmLogo ?? null },
    ];

    // 1) Next 2 shifts
    const next2 = nextTwoShifts(new Date());
    console.log("[Shifts] Next two:", next2);

    // 2) Ensure EMPTY AMS docs
    for (const s of next2) {
      await ensureEmptyAMS(STATIC_LC_ID, s.ymd, s.name);
    }

    // 3) Pick 5 random items
    const items = await pickRandomItems(ITEMS_PER_SHIFT);
    console.log("[Items] Selected:", items.map((it: any) => ({ id: String(it._id), type: it.type, variety: it.variety })));


    // 4) For each shift: for each item, create an FO for Farmer1 AND for Farmer2
    for (const s of next2) {
      const key = `${s.ymd} ${s.name}`;
      console.log(`[Shift] ${key}: creating farmer orders & AMS lines…`);

      const amsId = await ensureAMSId(STATIC_LC_ID, s.ymd, s.name);

      for (const item of items) {
        // Enrich from Item collection for AMS line + price
        const itemDoc: any = await Item.findById(item._id).lean();
        if (!itemDoc) {
          console.warn(`[WARN] Item not found: ${String(item._id)} — skipping`);
          continue;
        }

        // price per KG (your AMS uses pricePerUnit as per-KG)
        const pricePerKg = Number(itemDoc?.price?.a ?? itemDoc?.priceA ?? itemDoc?.price?.kg ?? NaN);
        if (!Number.isFinite(pricePerKg) || pricePerKg < 0) {
          console.warn(`[WARN] Missing/invalid pricePerKg for item ${String(item._id)} — skipping`);
          continue;
        }

        // both farmers get this item (2 orders per item)
        for (const farmer of FARMERS) {
          const committedKg = isEggs(item) ? 80 : randInt(50, 80);

          // Create FarmerOrder (aligned with model: ObjectId fields)
          const created = await FarmerOrder.create({
            createdBy: new Types.ObjectId(FARMER_MANAGER_ID),
            updatedBy: new Types.ObjectId(FARMER_MANAGER_ID),

            itemId: new Types.ObjectId(item._id),
            type: String(itemDoc.type || "Unknown"),
            variety: String(itemDoc.variety || ""),
            pictureUrl: String(itemDoc?.imageUrl ?? "https://example.com/placeholder.jpg"),

            farmerId: farmer.farmerId,
            farmerName: farmer.farmerName,
            farmName: farmer.farmName,

            shift: s.name,
            pickUpDate: s.ymd,
            logisticCenterId: new Types.ObjectId(STATIC_LC_ID),

            farmerStatus: "ok",

            sumOrderedQuantityKg: 0,
            forcastedQuantityKg: committedKg,

            orders: [],
            containers: [],

            historyAuditTrail: [],
          });

          // Build AMS item using your builder (returns schema-aligned shape)
          const amsLine = buildAmsItemFromItem({
            item: itemDoc,
            farmer: {
              id: created.farmerId,
              name: created.farmerName,
              farmName: created.farmName,
              farmLogo: farmer.farmLogo ?? undefined,
            },
            committedKg,
            unitConfig: { zScore: 1.28, shrinkagePct: 0.02 }, // optional tuning
          });

          // Attach FarmerOrder link
          (amsLine as any).farmerOrderId = created._id;

          // Ensure per-KG price is set under pricePerUnit (builder already does; keep defensively)
          (amsLine as any).pricePerUnit = pricePerKg;

          // Push to AMS via service
          // NOTE: If your service interface expects strings for some fields, coerce below
          await addItemToAvailableMarketStock({
            docId: amsId,
            item: {
              // string coercions for maximal TS compatibility with service signature
              itemId: String((amsLine as any).itemId),
              displayName: (amsLine as any).displayName,
              imageUrl: (amsLine as any).imageUrl ?? null,
              category: (amsLine as any).category,
              pricePerUnit: Number((amsLine as any).pricePerUnit),

              originalCommittedQuantityKg: Number((amsLine as any).originalCommittedQuantityKg),
              currentAvailableQuantityKg: Number((amsLine as any).currentAvailableQuantityKg),

              farmerOrderId: String((amsLine as any).farmerOrderId),
              farmerID: String((amsLine as any).farmerID),
              farmerName: (amsLine as any).farmerName,
              farmName: (amsLine as any).farmName,
              farmLogo: (amsLine as any).farmLogo ?? null,

              unitMode: (amsLine as any).unitMode,     // "kg" | "unit" | "mixed"
              estimates: (amsLine as any).estimates,   // { avgWeightPerUnitKg?, stdDevKg?, availableUnitsEstimate? }

              status: (amsLine as any).status ?? "active",
            } as any, // <-- cast in case the service's TS type hasn't been widened yet
          });
        }
      }

      // Verify AMS items count (should be 10 per shift: 5 items × 2 farmers)
      const d = await getAvailableMarketStockByKey({ LCid: STATIC_LC_ID, date: s.ymd, shift: s.name });
      console.log(`[VERIFY] ${key}: AMS ${d?._id?.toString()} items=${d?.items?.length ?? 0}`);
    }

    console.log("✅ Done.");
  } finally {
    await disconnectDB().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

// Execute if run directly
if (require.main === module) {
  seed().catch(async (err) => {
    console.error("❌ Seed failed:", err);
    try { await disconnectDB(); } catch {}
    process.exit(1);
  });
}

export default seed;
