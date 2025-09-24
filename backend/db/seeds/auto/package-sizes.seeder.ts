import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import PackageSize from "../../../src/models/PackageSize";

const DATA = path.resolve(__dirname, "../data/package-sizes.data.json");


const descriptor: SeederDescriptor = {
  name: "package-sizes",
  collection: PackageSize.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["key"], // key is the stable identity
  hasStatic: true,
  hasFaker: false,
};

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  // Ensure "Small" exists and is vented=true (to satisfy ItemPacking validators)
  const hasSmall = docs.some(d => (d.key ?? d.name) === "Small");
  if (!hasSmall) {
    docs.push({ key: "Small", name: "Small", vented: true, liters: 0, notes: "Auto-added for packing validators" });
  } else {
    docs = docs.map(d =>
      (d.key ?? d.name) === "Small" ? { ...d, key: "Small", name: d.name ?? "Small", vented: true } : d
    );
  }

  // Normalize: prefer `key` field; keep `name`
  docs = docs.map(d => ({ ...d, key: d.key ?? d.name }));

  const keys = ["key"];
  return bulkUpsertModel(PackageSize as any, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, PackageSize as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
