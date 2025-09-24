import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";

// 👇 Use YOUR real model. Adjust the import path/name to match your repo.
import Item from "../../../src/models/Item.model";

const DATA = path.resolve(__dirname, "../data/items.data.json");


const descriptor: SeederDescriptor = {
  name: "items",
  collection: Item.collection.name,
  dependsOn: [], // add deps if items depend on something else
  dataPaths: [DATA],
  // Pick a unique key or keys that make sense for your model.
  // If your items have unique "uid" or "sku", use that; otherwise fall back to "_id".
  upsertOn: ["_id"],
  hasStatic: true,
  hasFaker: false,
};

async function seedStatic(ctx: SeedContext) {
  const docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  const keys = ctx.upsertOn[descriptor.name] ?? descriptor.upsertOn ?? ["_id"];
  return bulkUpsertModel(Item, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, Item);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
