// seeds/auto/demand-statistics.seeder.ts
// Model-first seeder for DemandStatics (supports both "slotKey" docs and raw dynamic-key docs)
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel } from "../utils/run";

// 🔧 adjust import path if your models root differs
import DemandStaticsModel from "../../../src/models/DemandStatics.model";

const SLOT_NAME =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)-(morning|afternoon|night)$/i;

const DATA = path.resolve(__dirname, "../data/demand-statistics.json");


const descriptor: SeederDescriptor = {
  name: "demand-statistics",
  collection: DemandStaticsModel.collection.name,
  dependsOn: ["items"], // optional but makes sense
  dataPaths: [DATA],
  upsertOn: ["slotKey"], // unique per your schema
  hasStatic: true,
  hasFaker: false,
};

function looksLikeRawDynamic(obj: any): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj).filter((k) => k !== "_id");
  if (keys.length !== 1) return false;
  return SLOT_NAME.test(keys[0]);
}

function normalize(doc: any) {
  // case A: already a { slotKey, items } document
  if (typeof doc?.slotKey === "string") {
    const slotKey = doc.slotKey.toLowerCase();
    const innerItems = Array.isArray(doc.items) ? doc.items : [];

    const items = innerItems.map((it: any) => ({
      itemId: it?.itemId, // model will cast to ObjectId
      itemDisplayName: it?.itemDisplayName ?? null,
      averageDemandQuantityKg: Number(it?.averageDemandQuantityKg ?? 0),
    }));

    return { slotKey, items };
  }

  // case B: a raw dynamic-key object: { "monday-afternoon": { items: [...] } }
  if (looksLikeRawDynamic(doc)) {
    return DemandStaticsModel.fromRaw(doc);
  }

  // Unknown shape -> let validation fail with a clear message
  return doc;
}

async function seedStatic(ctx: SeedContext) {
  const dataPath = descriptor.dataPaths![0];
  const rows: any[] = await loadJSON(dataPath, { strict: ctx.flags.strict });

  const valid: any[] = [];
  for (const raw of rows) {
    const n = normalize(raw);
    try {
      const m = new DemandStaticsModel(n);
      await m.validate(); // run full schema validation (slotKey unique format, items casting, etc.)
      valid.push(n);
    } catch (e: any) {
      console.warn(`[demand-statistics] skipping invalid row: ${e?.message || e}`);
    }
  }

  if (valid.length === 0) {
    console.warn("[demand-statistics] nothing valid to upsert (0 docs after normalization).");
    return { inserted: 0, upserted: 0 };
  }

  const keys = ctx.upsertOn[descriptor.name] ?? descriptor.upsertOn ?? ["slotKey"];
  return bulkUpsertModel(DemandStaticsModel, valid, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  if (ctx.dryRun) {
    console.log(`[dry] Would clear "${DemandStaticsModel.collection.name}"`);
    return;
  }
  const res = await DemandStaticsModel.deleteMany({});
  console.log(`🧹 Cleared "${DemandStaticsModel.collection.name}" (deleted ${res.deletedCount ?? 0})`);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
