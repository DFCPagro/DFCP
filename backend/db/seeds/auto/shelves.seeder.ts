// db/seeds/modules/shelves.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import Shelf from "../../../src/models/Shelf.model";
import mongoose from "mongoose";

const DATA = path.resolve(__dirname, "../data/shelves.data.json");

const descriptor: SeederDescriptor = {
  name: "shelves",
  collection: Shelf.collection.name,
  dependsOn: ["logistics-centers"], // if you have a separate LC seeder
  dataPaths: [DATA],
  upsertOn: ["logisticCenterId", "shelfId"],
  hasStatic: true,
  hasFaker: false,
};

// normalize ObjectId fields
function asId(v: any) {
  if (!v) return v;
  return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v;
}

async function prepareShelves(docs: any[]) {
  return docs.map((d) => {
    const out = { ...d };
    out.logisticCenterId = asId(out.logisticCenterId);
    // slots may come with only capacity/slotId; defaults handled by schema
    out.createdAt = out.createdAt ?? new Date();
    out.updatedAt = new Date();
    return out;
  });
}

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  const prepped = await prepareShelves(docs);
  return bulkUpsertModel(Shelf as any, prepped, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, Shelf as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
