import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import ShiftConfig from "../../../src/models/shiftConfig.model"; // adjust

const DATA = path.resolve(__dirname, "../data/shift-configs.data.json");


const descriptor: SeederDescriptor = {
  name: "shift-configs",
  collection: ShiftConfig.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["_id"], // or a logical unique key your model defines
  hasStatic: true,
  hasFaker: false,
};

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];
  const keys = descriptor.upsertOn!;
  return bulkUpsertModel(ShiftConfig as any, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, ShiftConfig as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
