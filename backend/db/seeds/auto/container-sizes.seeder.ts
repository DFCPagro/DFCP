import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import ContainerSize from "../../../src/models/containerSize.model";

const DATA = path.resolve(__dirname, "../data/container-sizes.data.json");

const descriptor: SeederDescriptor = {
  name: "container-sizes",
  collection: ContainerSize.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["key"], // key is the stable identity (e.g. "CRATE_40x30x25")
  hasStatic: true,
  hasFaker: false,
};

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], {
    strict: ctx.flags.strict,
  });
  if (!Array.isArray(docs)) docs = [docs];

  // Normalize: prefer `key` field; keep `name`
  docs = docs.map((d) => ({ ...d, key: d.key ?? d.name }));

  const keys = ["key"];
  return bulkUpsertModel(
    ContainerSize as any,
    docs,
    keys,
    ctx.batchSize,
    ctx.dryRun
  );
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, ContainerSize as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
