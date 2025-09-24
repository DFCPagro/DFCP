import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import LogisticCenter from "../../../src/models/logisticsCenter.model";
import mongoose from "mongoose";

const DATA = path.resolve(__dirname, "../data/logistics-centers.data.json");


const descriptor: SeederDescriptor = {
  name: "logistics-centers",
  collection: LogisticCenter.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["_id"], // your data has _id strings
  hasStatic: true,
  hasFaker: false,
};

function normalizeRow(row: any) {
  const out: any = { ...row };

  // location: accept locationObj then rename to location (model-required)
  if (!out.location && out.locationObj) {
    const loc = out.locationObj;
    out.location = {
      name: loc.name ?? null,
      geo: loc.geo ?? undefined, // let schema handle if optional
    };
    delete out.locationObj;
  }

  // deliveryHistory: strings -> objects { message, at }
  if (Array.isArray(out.deliveryHistory)) {
    out.deliveryHistory = out.deliveryHistory.map((v: any) => {
      if (typeof v === "string") return { message: v, at: new Date() };
      // if already an object, keep as-is (let validators ensure shape)
      return v;
    });
  }

  // employeeIds: cast to ObjectId[]
  if (Array.isArray(out.employeeIds)) {
    out.employeeIds = out.employeeIds.map((id: any) =>
      typeof id === "string" && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id
    );
  }

  return out;
}

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  const normalized: any[] = [];
  for (const row of docs) {
    try {
      normalized.push(normalizeRow(row));
    } catch (err) {
      console.warn(`[logistics-centers] skipping invalid row (won't abort): ${(err as Error).message}`);
    }
  }

  if (normalized.length === 0) {
    console.warn("[logistics-centers] nothing valid to upsert (0 docs after normalization).");
    return { inserted: 0, upserted: 0 };
  }

  const keys = ["_id"];
  return bulkUpsertModel(LogisticCenter as any, normalized, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, LogisticCenter as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
