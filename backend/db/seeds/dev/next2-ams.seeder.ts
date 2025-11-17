/**
 * Seed: next TWO AMS docs (empty), then for each shift:
 *   - pick 5 items (full Item docs)
 *   - create 5 farmer orders for Farmer 1 (one per item) AND the same 5 for Farmer 2
 *   - random committed kg per farmer order
 *   - set farmerStatus="ok" and add to AMS (service derives unitMode + estimates)
 *
 * Run (PowerShell):
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:ams
 */

import "dotenv/config";
import { Types } from "mongoose";

import { connectDB, disconnectDB } from "../../../src/db/connect";
import {
  addItemToAvailableMarketStock,
  getAvailableMarketStockByKey,
} from "../../../src/services/availableMarketStock.service";
import { AvailableMarketStockModel } from "../../../src/models/availableMarketStock.model";
import FarmerOrder from "../../../src/models/farmerOrder.model";
import ItemModel from "../../../src/models/Item.model";
import { getContactInfoByIdService } from "../../../src/services/user.service";
import { buildAmsItemFromItem } from "../../../src/services/amsLine.builder";
import ContainerOps from "../../../src/models/ContainerOps.model";
import {getUserAddresses} from "../../../src/services/user.service";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const STATIC_LC_ID = "66e007000000000000000001"; // LC _id (hex string)
const FARMER_MANAGER_ID = "66f2aa000000000000000005"; // createdBy/updatedBy

// two *user* IDs for farmers (assuming == Farmer._id; change if needed)
const Farmer1_ID = "66f2aa000000000000000008";
const Farmer2_ID = "66f2aa00000000000000002a";
const CONTAINERA = "FO123_01";
const CONTAINERB = "FO123_02";

const SHIFT_CONFIG = [
  { name: "morning" as const, startMin: 60, endMin: 420 },
  { name: "afternoon" as const, startMin: 420, endMin: 780 },
  { name: "evening" as const, startMin: 780, endMin: 1140 },
  { name: "night" as const, startMin: 1140, endMin: 60 }, // crosses midnight
];

const ITEMS_PER_SHIFT = 5;

// -----------------------------
// Helpers
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
function getLocalHM(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
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
    const out: Array<{
      ymd: string;
      name: "morning" | "afternoon" | "evening" | "night";
    }> = [];
    const { year, month, day } = getLocalHM(now, TZ);
    const todayUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    const candidates: Array<{
      dayOffset: number;
      name: (typeof SHIFT_CONFIG)[number]["name"];
      startMin: number;
    }> = [];
    for (let d = 0; d < 3; d++)
      for (const s of SHIFT_CONFIG)
        candidates.push({ dayOffset: d, name: s.name, startMin: s.startMin });
    const filtered = candidates
      .filter((c) => (c.dayOffset > 0 ? true : c.startMin > minute))
      .sort((a, b) => a.dayOffset - b.dayOffset || a.startMin - b.startMin);
    for (let i = 0; i < Math.min(n, filtered.length); i++) {
      const c = filtered[i];
      const dateLocal = new Date(todayUTC + c.dayOffset * 24 * 60 * 60 * 1000);
      out.push({ ymd: fmtYMD(dateLocal, TZ), name: c.name });
    }
    return out;
  }
  return enumerateNext(2);
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isEggs(item: any): boolean {
  const t = String(item?.type || "").toLowerCase();
  const v = String(item?.variety || "").toLowerCase();
  const c = String(item?.category || "").toLowerCase();
  return t.includes("egg") || v.includes("egg") || c.includes("egg");
}

// Deterministic QR URL builder for containers (stub; swap to your real endpoint/token logic)
function makeQrUrlForContainer(
  farmerOrderId: Types.ObjectId,
  containerId: string
) {
  return `https://your.app/qr/fo/${farmerOrderId.toString()}/${encodeURIComponent(
    containerId
  )}`;
}

// AMS doc helpers
async function ensureEmptyAMS(
  LCid: string,
  dateYMD: string,
  shift: "morning" | "afternoon" | "evening" | "night"
) {
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
    doc._id,
    { $set: { items: [] } },
    { new: true }
  );
  return updated!._id.toString();
}
async function ensureAMSId(
  LCid: string,
  dateYMD: string,
  shift: "morning" | "afternoon" | "evening" | "night"
) {
  const existing = await getAvailableMarketStockByKey({
    LCid,
    date: dateYMD,
    shift,
  });
  if (existing) return String(existing._id);
  const created = await AvailableMarketStockModel.create({
    LCid: new Types.ObjectId(LCid),
    availableDate: new Date(`${dateYMD}T00:00:00.000Z`),
    availableShift: shift,
    items: [],
  });
  return String(created._id);
}

// items pool — full documents (lean)
async function pickRandomItemDocs(n: number) {
  const arr = await ItemModel.find({}, null, {
    sort: { updatedAt: -1 },
    lean: true,
  });
  if (arr.length < n)
    throw new Error(
      `Not enough items in DB to sample ${n}. Found: ${arr.length}`
    );

  const chosen: any[] = [];
  const used = new Set<number>();
  while (chosen.length < n) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!used.has(idx)) {
      used.add(idx);
      chosen.push(arr[idx]);
    }
  }
  return chosen; // full docs
}

// summary typing helpers
const UNIT_MODES = ["kg", "unit", "mixed"] as const;
type UnitMode = (typeof UNIT_MODES)[number];
const isUnitMode = (v: any): v is UnitMode =>
  v === "kg" || v === "unit" || v === "mixed";

// ---------- Pricing helpers (fix) ----------
function getDerivedPerUnit(item: any): number | 0.5 {
  const category = String(item?.category || "").toLowerCase();
  const byUnit = !!item?.sellModes?.byUnit;
  if (!byUnit) return 0.5;

  // eggs/dairy: use override
  if (category === "egg_dairy") {
    return typeof item?.pricePerUnitOverride === "number"
      ? item.pricePerUnitOverride
      : 0.5;
  }

  // non-egg: override wins
  if (typeof item?.pricePerUnitOverride === "number") return item.pricePerUnitOverride;

  // else derive from price.a and avgWeightPerUnitGr
  const a = Number(item?.price?.a);
  const wGr = Number(item?.avgWeightPerUnitGr);
  if (Number.isFinite(a) && Number.isFinite(wGr) && wGr > 0) {
    return a * (wGr / 1000);
  }
  return 0.5;
}

function getSafePerKg(item: any): number | 0.5 {
  const category = String(item?.category || "").toLowerCase();

  // usual case
  const a = Number(item?.price?.a);
  if (category !== "egg_dairy" && Number.isFinite(a) && a > 0) return a;

  // egg/dairy: synthesize per-kg from unit override and avg weight
  if (category === "egg_dairy") {
    const perUnit = getDerivedPerUnit(item); // expects override
    const wGr = Number(item?.avgWeightPerUnitGr);
    if (Number.isFinite(perUnit) && Number.isFinite(wGr) && wGr > 0) {
      return perUnit / (wGr / 1000); // €/kg = €/unit ÷ kg/unit
    }
  }
  return 0.5;
}

// -----------------------------
// Seed
// -----------------------------
async function seed() {
  const conn = await connectDB();
  console.log(`🔌 Connected to ${conn.name}`);

  // ------- summary trackers -------
  const summary = {
    byShift: new Map<
      string,
      { amsDocId: string; lines: number; byMode: Record<UnitMode, number> }
    >(),
    farmerOrders: { total: 0, byFarmer: new Map<string, number>() },
  };

  try {
    // fetch farmer display data once (by *user* id)
        // fetch farmer display data once (by *user* id)
    const f1 = await getContactInfoByIdService(Farmer1_ID);
    const f2 = await getContactInfoByIdService(Farmer2_ID);

    // NEW: fetch farmer addresses from User.addresses
    const f1Addresses = await getUserAddresses(Farmer1_ID);
    const f2Addresses = await getUserAddresses(Farmer2_ID);

    const pickFirstAddress = (arr: any[]): any | null =>
      Array.isArray(arr) && arr.length ? arr[0] : null;

    const FARMERS = [
      {
        farmerUserId: Farmer1_ID,
        farmerId: new Types.ObjectId(Farmer1_ID),
        farmerName: f1.name,
        farmName: f1.farmName || "freshy fresh",
        farmLogo: f1.farmLogo ?? null,
        // assume User.addresses uses same Address schema as pickupAddress
        pickupAddress: pickFirstAddress(f1Addresses),
      },
      {
        farmerUserId: Farmer2_ID,
        farmerId: new Types.ObjectId(Farmer2_ID),
        farmerName: f2.name,
        farmName: f2.farmName || "freshy fresh",
        farmLogo: f2.farmLogo ?? null,
        pickupAddress: pickFirstAddress(f2Addresses),
      },
    ];


    // 1) Next 2 shifts
    const next2 = nextTwoShifts(new Date());
    console.log("[Shifts] Next two:", next2);

    // 2) Ensure EMPTY AMS docs
    for (const s of next2) {
      await ensureEmptyAMS(STATIC_LC_ID, s.ymd, s.name);
    }

    // 3) Pick 5 random items (full docs)
    const items = await pickRandomItemDocs(ITEMS_PER_SHIFT);
    console.log(
      "[Items] Selected:",
      items.map((it: any) => ({
        id: String(it._id),
        type: it.type,
        variety: it.variety,
        category: it.category,
      }))
    );

    // 4) For each shift: for each item, create an FO for Farmer1 AND for Farmer2
    for (const s of next2) {
      const key = `${s.ymd} ${s.name}`;
      console.log(`\n[Shift] ${key}: creating farmer orders & AMS lines…`);

      const amsId = await ensureAMSId(STATIC_LC_ID, s.ymd, s.name);

      for (const itemDoc of items) {
        // ---- FIX: compute prices robustly ----
        const pricePerKg = getSafePerKg(itemDoc);
        if (!Number.isFinite(pricePerKg) || (pricePerKg as number) <= 0) {
          console.warn(
            `[WARN] Unable to determine pricePerKg for item ${String(
              itemDoc._id
            )} (${itemDoc.type} ${itemDoc.variety ?? ""}) — skipping AMS line`
          );
          continue; // do not attempt AMS for this item
        }

        const derivedPerUnit = getDerivedPerUnit(itemDoc);
        const category = String(itemDoc?.category || "").toLowerCase();

        for (const farmer of FARMERS) {
          const committedKg = category === "egg_dairy" ? 80 : randInt(50, 80);

          // ---------- FarmerOrder (authoritative containers are refs) ----------
                    const createdFO = await FarmerOrder.create({
            createdBy: new Types.ObjectId(FARMER_MANAGER_ID),
            updatedBy: new Types.ObjectId(FARMER_MANAGER_ID),

            itemId: new Types.ObjectId(itemDoc._id),
            type: String(itemDoc.type || "Unknown"),
            variety: String(itemDoc.variety || ""),
            pictureUrl: String(
              itemDoc?.imageUrl ?? "https://example.com/placeholder.jpg"
            ),

            farmerId: farmer.farmerId,
            farmerName: farmer.farmerName,
            farmName: farmer.farmName,

            // 🔹 NEW: pickupAddress for planning / trips
            pickupAddress:
              farmer.pickupAddress ?? {
                lnt: 35.0,
                alt: 32.0,
                address: `${farmer.farmName} (seeded default)`,
                logisticCenterId: STATIC_LC_ID,
                note: "Seeded default pickup address",
              },

            shift: s.name,
            pickUpDate: s.ymd,
            logisticCenterId: new Types.ObjectId(STATIC_LC_ID),

            farmerStatus: "ok",

            sumOrderedQuantityKg: 0,
            forcastedQuantityKg: committedKg,

            orders: [],
            containers: [], // IMPORTANT: will set to ContainerOps IDs after creating them
            containerSnapshots: [], // (optional tiny UI-only)
            historyAuditTrail: [],
          });

          // ---------- Create ContainerOps docs (A & B) ----------
          const baseContainer = {
            farmerOrderId: createdFO._id,
            itemId: new Types.ObjectId(itemDoc._id),
            logisticCenterId: new Types.ObjectId(STATIC_LC_ID),
            state: "arrived",
            location: { area: "intake", zone: null, shelfId: null, slotId: null },
            intendedWeightKg: 0,
            totalWeightKg: 0,
            weightHistory: [],
            distributedWeights: [],
            cleaning: {},
            sorting: {},
            auditTrail: [],
          };

          const containerOpsA = await ContainerOps.create({
            ...baseContainer,
            containerId: CONTAINERA,
          });
          const containerOpsB = await ContainerOps.create({
            ...baseContainer,
            containerId: CONTAINERB,
          });

          // ---------- Link FO.containers to ContainerOps IDs ----------
          await FarmerOrder.updateOne(
            { _id: createdFO._id },
            {
              $set: {
                containers: [containerOpsA._id, containerOpsB._id],
                // OPTIONAL: tiny non-authoritative snapshots for UI lists
                containerSnapshots: [
                  {
                    containerOpsId: containerOpsA._id,
                    containerId: containerOpsA.containerId,
                    itemId: containerOpsA.itemId,
                    state: containerOpsA.state,
                    totalWeightKg: containerOpsA.totalWeightKg ?? 0,
                    locationArea: containerOpsA.location?.area ?? "intake",
                    capturedAt: new Date(),
                  },
                  {
                    containerOpsId: containerOpsB._id,
                    containerId: containerOpsB.containerId,
                    itemId: containerOpsB.itemId,
                    state: containerOpsB.state,
                    totalWeightKg: containerOpsB.totalWeightKg ?? 0,
                    locationArea: containerOpsB.location?.area ?? "intake",
                    capturedAt: new Date(),
                  },
                ],
              },
            }
          );

          // --- Build AMS item using your builder ---
          const amsLine = buildAmsItemFromItem({
            item: itemDoc,
            farmer: {
              id: createdFO.farmerId,
              name: createdFO.farmerName,
              farmName: createdFO.farmName,
              farmLogo: farmer.farmLogo ?? undefined,
            },
            committedKg,
            unitConfig: { zScore: 1.28, shrinkagePct: 0.02 },
          });

          // Ensure links & mode
          (amsLine as any).farmerOrderId = createdFO._id;
          const unitMode: UnitMode =
            (amsLine as any).unitMode === "unit" ||
            (amsLine as any).unitMode === "mixed"
              ? (amsLine as any).unitMode
              : "kg";

          // Map estimates with safe defaults
          const rawEst = (amsLine as any).estimates ?? {};
          const estimates = {
            avgWeightPerUnitKg:
              typeof rawEst.avgWeightPerUnitKg === "number"
                ? rawEst.avgWeightPerUnitKg
                : typeof rawEst.avgWeightPerUnit === "number"
                ? rawEst.avgWeightPerUnit
                : 0.5,
            sdKg: typeof rawEst.sdKg === "number" ? rawEst.sdKg : 0.02,
            availableUnitsEstimate:
              typeof rawEst.availableUnitsEstimate === "number"
                ? rawEst.availableUnitsEstimate
                : 0,
            unitBundleSize:
              typeof rawEst.unitBundleSize === "number" &&
              rawEst.unitBundleSize >= 1
                ? rawEst.unitBundleSize
                : 1,
            zScore: typeof rawEst.zScore === "number" ? rawEst.zScore : 1.28,
            shrinkagePct:
              typeof rawEst.shrinkagePct === "number"
                ? rawEst.shrinkagePct
                : 0.02,
          };

          // ---------- AMS add (include price.a) ----------
          await addItemToAvailableMarketStock({
            docId: amsId,
            item: {
              itemId: String((amsLine as any).itemId),
              displayName: (amsLine as any).displayName,
              imageUrl: (amsLine as any).imageUrl ?? null,
              category: (amsLine as any).category,

              price: { a: pricePerKg, b: null, c: null },
              pricePerKg: pricePerKg,

              pricePerUnit:
                unitMode === "unit" || unitMode === "mixed"
                  ? derivedPerUnit
                  : null,

              originalCommittedQuantityKg: committedKg,
              currentAvailableQuantityKg: committedKg,

              farmerOrderId: String(createdFO._id),
              farmerID: String(farmer.farmerId),
              farmerName: farmer.farmerName,
              farmName: farmer.farmName,
              farmLogo: farmer.farmLogo ?? null,

              unitMode,
              estimates,

              status: (amsLine as any).status ?? "active",
            } as any,
          });
        } // end FARMERS
      } // end items

      // summary snapshot for this shift
      const doc = await getAvailableMarketStockByKey({
        LCid: STATIC_LC_ID,
        date: s.ymd,
        shift: s.name,
      });
      const byMode: Record<UnitMode, number> = { kg: 0, unit: 0, mixed: 0 };
      for (const it of doc?.items ?? []) {
        const m = (it as any).unitMode;
        if (isUnitMode(m)) byMode[m] += 1;
      }
      summary.byShift.set(key, {
        amsDocId: String(doc?._id ?? ""),
        lines: doc?.items?.length ?? 0,
        byMode,
      });
    } // end shifts

    // -------- summary output --------
    console.log("\n===== SEED SUMMARY =====");
    for (const [shiftKey, info] of summary.byShift) {
      console.log(
        `• ${shiftKey} | AMS: ${info.amsDocId} | lines: ${info.lines} | modes => kg:${info.byMode.kg} unit:${info.byMode.unit} mixed:${info.byMode.mixed}`
      );
    }
    console.log(`FarmerOrders created: ${summary.farmerOrders.total}`);
    for (const [farmerName, count] of summary.farmerOrders.byFarmer) {
      console.log(`  - ${farmerName}: ${count}`);
    }
    console.log("Farmer status set to 'ok' for all created FarmerOrders.");
    console.log("✅ Done.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    await disconnectDB().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

// Execute if run directly
if (require.main === module) {
  seed().catch(() => process.exit(1));
}

export default seed;
