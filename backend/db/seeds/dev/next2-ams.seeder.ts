/**
 * Dev Seeder – AMS + FarmerOrders
 *
 * Seed: next THREE AMS docs (empty), then for each shift:
 *   - for each farmer in PROVIDED_FARMER_IDS:
 *       - pick 4 distinct items (from the Item collection)
 *       - create 1 farmer order per item
 *       - random committed kg per farmer order (80 for egg_dairy, else 50–80)
 *       - set farmerStatus="ok" and add to AMS (service derives unitMode + estimates)
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
import { getContactInfoByIdService, getUserAddresses } from "../../../src/services/user.service";
import { buildAmsItemFromItem } from "../../../src/services/amsLine.builder";
import ContainerOps from "../../../src/models/ContainerOps.model";

// -----------------------------
// Config
// -----------------------------
const TZ = "Asia/Jerusalem";
const STATIC_LC_ID = "66e007000000000000000001"; // LC _id (hex string)
const FARMER_MANAGER_ID = "66f2aa000000000000000005"; // createdBy/updatedBy

// Provided farmer user IDs (should correspond to User / Farmer docs)
const PROVIDED_FARMER_IDS = [
  "66f2aa00000000000000002a",
  "66f2aa000000000000000008",
  "66f2aa000000000000000041",
  "66f2aa000000000000000040",
  "66f2aa00000000000000003f",
];

const CONTAINERA = "FO123_01";
const CONTAINERB = "FO123_02";

const SHIFT_CONFIG = [
  { name: "morning" as const, startMin: 60, endMin: 420 },
  { name: "afternoon" as const, startMin: 420, endMin: 780 },
  { name: "evening" as const, startMin: 780, endMin: 1140 },
  { name: "night" as const, startMin: 1140, endMin: 60 }, // crosses midnight
];

// how many items each farmer gets per shift
const ITEMS_PER_FARMER_PER_SHIFT = 4;

// -----------------------------
// Helpers – time / date
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

/**
 * Next N upcoming shifts (across today + next days), ignoring already-started ones.
 */
function nextNShifts(
  now = new Date(),
  count = 3
): Array<{ ymd: string; name: "morning" | "afternoon" | "evening" | "night" }> {
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

    for (let d = 0; d < 4; d++) {
      for (const s of SHIFT_CONFIG) {
        candidates.push({ dayOffset: d, name: s.name, startMin: s.startMin });
      }
    }

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

  return enumerateNext(count);
}

// -----------------------------
// Misc helpers
// -----------------------------
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isEggs(item: any): boolean {
  const t = String(item?.type || "").toLowerCase();
  const v = String(item?.variety || "").toLowerCase();
  const c = String(item?.category || "").toLowerCase();
  return t.includes("egg") || v.includes("egg") || c.includes("egg");
}

const pickFirstAddress = (arr: any[]): any | null =>
  Array.isArray(arr) && arr.length ? arr[0] : null;

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

// -----------------------------
// Item helpers
// -----------------------------
/**
 * Pick N distinct random items from a pre-loaded pool.
 */
function pickDistinctRandomItemsFromPool(all: any[], n: number): any[] {
  if (all.length < n) {
    throw new Error(
      `Not enough items in pool to sample ${n}. Found: ${all.length}`
    );
  }
  const chosen: any[] = [];
  const used = new Set<number>();
  while (chosen.length < n) {
    const idx = Math.floor(Math.random() * all.length);
    if (!used.has(idx)) {
      used.add(idx);
      chosen.push(all[idx]);
    }
  }
  return chosen;
}

// summary typing helpers
const UNIT_MODES = ["kg", "unit", "mixed"] as const;
type UnitMode = (typeof UNIT_MODES)[number];
const isUnitMode = (v: any): v is UnitMode =>
  v === "kg" || v === "unit" || v === "mixed";

// ---------- Pricing helpers ----------
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
  if (typeof item?.pricePerUnitOverride === "number")
    return item.pricePerUnitOverride;

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

  // summary trackers
  const summary = {
    byShift: new Map<
      string,
      { amsDocId: string; lines: number; byMode: Record<UnitMode, number> }
    >(),
    farmerOrders: { total: 0, byFarmer: new Map<string, number>() },
  };

  try {
    // 1) Resolve FARMERS from PROVIDED_FARMER_IDS
    const FARMERS: {
      farmerUserId: string;
      farmerId: Types.ObjectId;
      farmerName: string;
      farmName: string;
      farmLogo: string | null;
      pickupAddress: any | null;
    }[] = [];

    for (const farmerUserId of PROVIDED_FARMER_IDS) {
      const info = await getContactInfoByIdService(farmerUserId);
      if (!info) {
        console.warn(
          `[WARN] No contact info for farmer user ${farmerUserId}, skipping`
        );
        continue;
      }

      const addresses = await getUserAddresses(farmerUserId);

      FARMERS.push({
        farmerUserId,
        farmerId: new Types.ObjectId(farmerUserId),
        farmerName: info.name,
        farmName: info.farmName || "freshy fresh",
        farmLogo: info.farmLogo ?? null,
        pickupAddress: pickFirstAddress(addresses),
      });
    }

    if (!FARMERS.length) {
      throw new Error(
        "No farmers resolved from PROVIDED_FARMER_IDS – seeder cannot continue."
      );
    }

    console.log(
      `[Farmers] Resolved ${FARMERS.length} farmers from PROVIDED_FARMER_IDS`
    );

    // 2) Next 3 upcoming shifts
    const next3 = nextNShifts(new Date(), 3);
    console.log("[Shifts] Next three:", next3);

    // 3) Ensure EMPTY AMS docs for each shift
    for (const s of next3) {
      await ensureEmptyAMS(STATIC_LC_ID, s.ymd, s.name);
    }

    // 4) Load all items once; we will sample from this pool
    const allItems = await ItemModel.find({}, null, {
      sort: { updatedAt: -1 },
      lean: true,
    });

    if (allItems.length < ITEMS_PER_FARMER_PER_SHIFT) {
      throw new Error(
        `Need at least ${ITEMS_PER_FARMER_PER_SHIFT} items in DB; found only ${allItems.length}`
      );
    }

    console.log(`[Items] Total in pool: ${allItems.length}`);

    // 5) For each shift: for each farmer, pick 4 items and create FO + AMS lines
    for (const s of next3) {
      const key = `${s.ymd} ${s.name}`;
      console.log(`\n[Shift] ${key}: creating farmer orders & AMS lines…`);

      const amsId = await ensureAMSId(STATIC_LC_ID, s.ymd, s.name);

      for (const farmer of FARMERS) {
        // 4 distinct random items for THIS farmer and THIS shift
        const farmerItems = pickDistinctRandomItemsFromPool(
          allItems,
          ITEMS_PER_FARMER_PER_SHIFT
        );

        for (const itemDoc of farmerItems) {
          // compute prices robustly
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
          const committedKg = category === "egg_dairy" ? 80 : randInt(50, 80);

          // ---------- FarmerOrder ----------
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
            containers: [],
            containerSnapshots: [],
            historyAuditTrail: [],
          });

          // update summary counters
          summary.farmerOrders.total += 1;
          summary.farmerOrders.byFarmer.set(
            farmer.farmerName,
            (summary.farmerOrders.byFarmer.get(farmer.farmerName) ?? 0) + 1
          );

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

          await FarmerOrder.updateOne(
            { _id: createdFO._id },
            {
              $set: {
                containers: [containerOpsA._id, containerOpsB._id],
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

          (amsLine as any).farmerOrderId = createdFO._id;

          const unitMode: UnitMode =
            (amsLine as any).unitMode === "unit" ||
            (amsLine as any).unitMode === "mixed"
              ? (amsLine as any).unitMode
              : "kg";

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
        } // end items for this farmer
      } // end FARMERS loop

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
