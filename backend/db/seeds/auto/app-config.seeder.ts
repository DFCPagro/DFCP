import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import AppConfig from "../../../src/models/appConfig.model"; // adjust if your file name differs


const DATA = path.resolve(__dirname, "../data/app-config.data.json");

const descriptor: SeederDescriptor = {
  name: "app-config",
  collection: AppConfig.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["key"], 
  hasStatic: true,
  hasFaker: false
};

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  // Normalize: ensure `key` exists (fallback to name)
  docs = docs.map(d => ({ ...d, key: d.key ?? d.name }));

  const keys = ["key"];
  return bulkUpsertModel(AppConfig as any, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, AppConfig as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
