// db/seeds/modules/farmer-lands.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import FarmerLandModel from "../../../src/models/farmerLand.model";
import UserModel from "../../../src/models/user.model";
import FarmerModel from "../../../src/models/farmer.model";
import mongoose from "mongoose";

const DATA = path.resolve(__dirname, "../data/farmer-lands.data.json");

const descriptor: SeederDescriptor = {
  name: "farmer-lands",
  collection: FarmerLandModel.collection.name,
  dependsOn: ["users", "farmers"],     // farmers must exist so we can resolve farmer id
  dataPaths: [DATA],
  upsertOn: ["_id"],                    // keep stable ids referenced by farmers
  hasStatic: true,
  hasFaker: false,
};

function toObjectIdOrThrow(id: any, label = "id") {
  const s = String(id ?? "").trim();
  if (!mongoose.isValidObjectId(s)) throw new Error(`farmer-lands.seeder: invalid ${label}: ${id}`);
  return new mongoose.Types.ObjectId(s);
}

async function resolveFarmerIdByUser(userLike: any) {
  const userId = toObjectIdOrThrow(userLike, "user");
  const u = await UserModel.findById(userId).select("_id").lean();
  if (!u) throw new Error(`farmer-lands.seeder: user not found: ${userId}`);
  const f = await FarmerModel.findOne({ user: u._id }).select("_id").lean();
  if (!f) throw new Error(`farmer-lands.seeder: farmer not found for user: ${userId}`);
  return f._id as mongoose.Types.ObjectId;
}

async function prepareLands(docs: any[]) {
  const out: any[] = [];
  for (const d of docs) {
    const _id = toObjectIdOrThrow(d._id, "_id");
    const farmerId =
      d.farmer && mongoose.isValidObjectId(d.farmer)
        ? toObjectIdOrThrow(d.farmer, "farmer")
        : await resolveFarmerIdByUser(d.user);

    out.push({
      _id,
      farmer: farmerId,
      name: d.name,
      ownership: d.ownership,          // "owned" | "rented"
      areaM2: d.areaM2,
      address: d.address,
      pickupAddress: d.pickupAddress ?? null,
      measurements: d.measurements,
      sections: Array.isArray(d.sections) ? d.sections : [],
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
      updatedAt: new Date(),
    });
  }
  return out;
}

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];
  const prepped = await prepareLands(docs);
  return bulkUpsertModel(FarmerLandModel as any, prepped, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, FarmerLandModel as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
