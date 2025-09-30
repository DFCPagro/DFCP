// db/seeds/modules/farmers.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import FarmerModel from "../../../src/models/farmer.model";
import UserModel from "../../../src/models/user.model";
import { faker } from "@faker-js/faker";
import mongoose from "mongoose";

const DATA = path.resolve(__dirname, "../data/farmers.data.json");

const descriptor: SeederDescriptor = {
  name: "farmers",
  collection: FarmerModel.collection.name,
  dependsOn: ["users"],                 // users must exist
  dataPaths: [DATA],
  upsertOn: ["_id"],                   // one Farmer per User
  hasStatic: true,
  hasFaker: true,
};

// ---------- helpers ----------
function toObjectIdOrThrow(id: any, label = "id") {
  const s = String(id ?? "").trim();
  if (!mongoose.isValidObjectId(s)) throw new Error(`farmers.seeder: invalid ${label}: ${id}`);
  return new mongoose.Types.ObjectId(s);
}

async function resolveFarmerUser(userLike: any) {
  const userId = toObjectIdOrThrow(userLike, "user");
  const u = await UserModel.findById(userId).select("_id role email").lean();
  if (!u) throw new Error(`farmers.seeder: user not found: ${userId}`);
  if (u.role !== "farmer") throw new Error(`farmers.seeder: user ${u.email} does not have role "farmer"`);
  return userId;
}

function normalizeLandsOrThrow(input: any): mongoose.Types.ObjectId[] {
  const raw: any[] = Array.isArray(input) ? input : [];
  const ids = raw
    .filter((v) => typeof v === "string" && mongoose.isValidObjectId(v))
    .map((v) => new mongoose.Types.ObjectId(v));

  if (ids.length === 0) {
    throw new Error(
      "farmers.seeder: `lands` must be a non-empty array of valid FarmerLand ObjectId strings (Farmer model validator requires at least one)."
    );
  }
  return ids;
}

function ensureDefaults(d: any) {
  const out = { ...d };
  if (typeof out.agriculturalInsurance !== "boolean") out.agriculturalInsurance = false;
  if (typeof out.agreementPercentage !== "number") out.agreementPercentage = 60;
  if (!out.farmerInfo) {
    out.farmerInfo =
      "Family-run, climate-smart farm prioritizing soil health, water efficiency, and biodiversity. We use drip irrigation, cover crops, and minimal tillage.";
  }
  if (!out.farmLogo) out.farmLogo = `https://picsum.photos/seed/${faker.string.alphanumeric(8)}/512/512`;
  if (!out.createdAt) out.createdAt = new Date();
  out.updatedAt = new Date();
  return out;
}

async function prepareFarmers(docs: any[]) {
  const out: any[] = [];
  for (const d of docs) {
    const userId = await resolveFarmerUser(d.user);
    const lands = normalizeLandsOrThrow(d.lands);
    const base = ensureDefaults(d);

    // derive farmName from user's name if missing
    let farmName = base.farmName;
    if (!farmName) {
      const u = await UserModel.findById(userId).select("name").lean();
      const first = (u?.name || "Green").split(" ")[0];
      farmName = `${first} Family Farm`;
    }

    out.push({
        _id: userId,
      user: userId,
      farmName,
      agriculturalInsurance: base.agriculturalInsurance,
      farmLogo: base.farmLogo,
      farmerInfo: base.farmerInfo,
      agreementPercentage: base.agreementPercentage,
      lands,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    });
  }
  return out;
}

// ---------- seeding ----------
async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];
  const prepped = await prepareFarmers(docs);
  return bulkUpsertModel(FarmerModel as any, prepped, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);
}

async function seedFaker(ctx: SeedContext, _count: number) {
  // Not providing faker mode because we need real land ids to satisfy validator
  return { inserted: 0, upserted: 0, matched: 0 };
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, FarmerModel as any);
}

const seeder: SeederModule = { descriptor, seedStatic, seedFaker, clear };
export default seeder;
