import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import mongoose, { Types } from "mongoose";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import ItemPacking from "../../../src/models/ItemPacking";
import PackageSize from "../../../src/models/PackageSize";

const DATA = path.resolve(__dirname, "../data/item-packing.data.json");


const descriptor: SeederDescriptor = {
  name: "item-packing",
  collection: ItemPacking.collection.name,
  dependsOn: ["package-sizes"], // ensure 'Small' exists & vented true
  dataPaths: [DATA],
  upsertOn: ["_id"], // your file shows an _id for the doc
  hasStatic: true,
  hasFaker: false
};

async function seedStatic(ctx: SeedContext) {
  const raw = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  const docs = Array.isArray(raw) ? raw : [raw];

  // 🔧 Type the lean() result so TS knows `vented` exists
  type SmallPick = { _id: Types.ObjectId; vented?: boolean };
  const small = await PackageSize
    .findOne({ key: "Small" })
    .select({ _id: 1, vented: 1 })
    .lean<SmallPick>()
    .exec();

  if (!small) {
    console.warn(`[item-packing] PackageSize "Small" missing; creating one (vented=true).`);
    await PackageSize.updateOne(
      { key: "Small" },
      { $set: { key: "Small", name: "Small", vented: true } },
      { upsert: true }
    );
  } else if (!small.vented) {
    await PackageSize.updateOne({ key: "Small" }, { $set: { vented: true } });
  }

  const keys = descriptor.upsertOn!;
  return bulkUpsertModel(ItemPacking as any, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, ItemPacking as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
