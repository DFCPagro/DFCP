// seeds/auto/available-stock.seeder.ts
import path from "path";
import type { SeederModule, SeederDescriptor, SeedContext } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import { Types } from "mongoose";

// Models (adjust paths if yours differ)
import Item from "../../../src/models/Item.model";
import LogisticCenter from "../../../src/models/logisticsCenter.model";
import AvailableMarketStock from "../../../src/models/availableMarketStock.model";

const DATA = path.resolve(__dirname, "../data/available-stock.data.json");


const descriptor: SeederDescriptor = {
  name: "available-stock",
  collection: AvailableMarketStock.collection.name,
  dependsOn: ["items", "logistics-centers"],
  dataPaths: [DATA],
  // parent uniqueness (per your schema's unique index):
  upsertOn: ["LCid", "availableDate", "availableShift"],
  hasStatic: true,
  hasFaker: false,
};

// ───────────────── helpers ─────────────────
const isHex24 = (v: any): v is string => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);
const k = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

function parseDateLoose(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v !== "string") return null;

  const s = v.trim().toLowerCase();
  const d0 = new Date(new Date().toDateString());
  if (s === "today") return d0;
  if (s === "yesterday") { const d = new Date(d0); d.setDate(d.getDate() - 1); return d; }
  if (s === "tomorrow")  { const d = new Date(d0); d.setDate(d.getDate() + 1); return d; }

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function buildItemIndex() {
  // Use lean<any> so TS doesn’t complain about optional fields we may inspect
  const items = await Item.find({}, { _id: 1, type: 1, variety: 1 }).lean<any>();
  const byId = new Map<string, Types.ObjectId>();
  const byTypeVar = new Map<string, Types.ObjectId>();

  for (const it of items) {
    const id = it._id as Types.ObjectId;
    byId.set(String(it._id), id);
    if (it.type && it.variety) byTypeVar.set(`${k(it.type)}|${k(it.variety)}`, id);
  }
  return { byId, byTypeVar };
}

async function buildLCIndex() {
  const lcs = await LogisticCenter
    .find({}, { _id: 1, logisticName: 1, "locationObj.name": 1 })
    .sort({ _id: 1 })
    .lean<any>();

  const byId = new Map<string, Types.ObjectId>();
  const byLogName = new Map<string, Types.ObjectId>();
  const byLocName = new Map<string, Types.ObjectId>();
  const ordinal: Types.ObjectId[] = [];

  for (const lc of lcs) {
    const id = lc._id as Types.ObjectId;
    ordinal.push(id);
    byId.set(String(lc._id), id);
    if (lc.logisticName) byLogName.set(k(lc.logisticName), id);
    if (lc?.locationObj?.name) byLocName.set(k(lc.locationObj.name), id);
  }
  return { byId, byLogName, byLocName, ordinal };
}

function resolveLC(rawLC: any, idx: Awaited<ReturnType<typeof buildLCIndex>>): Types.ObjectId | null {
  if (!rawLC) return null;
  if (isHex24(rawLC)) return idx.byId.get(rawLC) ?? null;
  if (typeof rawLC === "string") {
    const s = rawLC.trim();
    // Support "LC-1", "LC-2", ...
    const m = /^LC-(\d+)$/i.exec(s);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= idx.ordinal.length) return idx.ordinal[n - 1];
    }
    return idx.byLogName.get(k(s)) ?? idx.byLocName.get(k(s)) ?? null;
  }
  return null;
}

function coerceNum(n: any): number | null {
  if (typeof n === "number") return Number.isFinite(n) && n >= 0 ? n : null;
  if (typeof n === "string" && n.trim() !== "") {
    const parsed = Number(n);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

// ───────────────── seeding ─────────────────
async function seedStatic(ctx: SeedContext) {
  const arr = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  const rows: any[] = Array.isArray(arr) ? arr : [arr];

  const itemsIdx = await buildItemIndex();
  const lcsIdx = await buildLCIndex();

  const normalizedParents: any[] = [];

  for (const row of rows) {
    // Resolve LC
    const LCid = resolveLC(row.LCid ?? row.center ?? row.centerId ?? row.centerName, lcsIdx);
    if (!LCid) {
      console.warn(`[available-stock] skipping invalid row: Could not resolve LC id from value: ${row.LCid ?? row.center ?? row.centerId ?? row.centerName ?? "undefined"}`);
      continue;
    }

    // Date & shift
    const availableDate = parseDateLoose(row.availableDate ?? row.date ?? "today");
    if (!availableDate) {
      console.warn(`[available-stock] skipping invalid row: Invalid date: ${row.availableDate ?? row.date}`);
      continue;
    }
    const availableShift: string = String(row.availableShift ?? row.shift ?? "morning").toLowerCase();

    // Items array (embedded)
    const itemsIn = Array.isArray(row.items) ? row.items : [];
    const itemsOut: any[] = [];

    for (const it of itemsIn) {
      // itemId resolution
      let itemId: Types.ObjectId | null = null;
      const rawItem = it.itemId ?? it.item ?? it.itemName;

      if (isHex24(rawItem)) itemId = itemsIdx.byId.get(rawItem) ?? null;
      if (!itemId && (it.type || it.variety)) {
        const key = `${k(it.type)}|${k(it.variety)}`;
        itemId = itemsIdx.byTypeVar.get(key) ?? null;
      }
      if (!itemId) {
        console.warn(`[available-stock] skipping invalid row: Invalid itemId: ${rawItem ?? "undefined"}`);
        continue;
      }

      // Numeric fields
      const pricePerUnit = coerceNum(it.pricePerUnit);
      const origKg = coerceNum(it.originalCommittedQuantityKg);
      const currKg = coerceNum(it.currentAvailableQuantityKg);

      if (pricePerUnit == null || origKg == null || currKg == null) {
        console.warn("[available-stock] skipping item with invalid numeric fields");
        continue;
      }

      itemsOut.push({
        _id: isHex24(it._id) ? new Types.ObjectId(it._id) : undefined,
        itemId,
        displayName: (it.displayName ?? `${it.type ?? ""} ${it.variety ?? ""}`.trim()) || "Item",
        imageUrl: it.imageUrl ?? null,
        category: it.category ?? "fruit",
        pricePerUnit,
        originalCommittedQuantityKg: origKg,
        currentAvailableQuantityKg: currKg,
        farmerOrderId: isHex24(it.farmerOrderId) ? new Types.ObjectId(it.farmerOrderId) : null,
        farmerID: isHex24(it.farmerID) ? new Types.ObjectId(it.farmerID) : new Types.ObjectId("66f32ca35f0a4c1a8e2a9bdd"), // fallback dummy if needed
        farmerName: it.farmerName ?? "Farmer",
        farmName: it.farmName ?? "Farm",
        status: it.status ?? "active",
      });
    }

    const parent: any = {
      _id: isHex24(row._id) ? new Types.ObjectId(row._id) : undefined,
      LCid,
      availableDate,
      availableShift,
      createdById: isHex24(row.createdById) ? new Types.ObjectId(row.createdById) : null,
      items: itemsOut,
    };

    normalizedParents.push(parent);
  }

  if (normalizedParents.length === 0) {
    console.warn("[available-stock] no valid rows after normalization.");
    return { inserted: 0, upserted: 0 };
  }

  // Upsert via model so validators/middleware run.
  // Use uniqueness per LCid+availableDate+availableShift
  const res = await bulkUpsertModel(
    AvailableMarketStock as any,
    normalizedParents,
    descriptor.upsertOn!,
    ctx.batchSize,
    ctx.dryRun
  );

  return res;
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, AvailableMarketStock as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
