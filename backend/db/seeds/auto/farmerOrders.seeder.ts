// db/seeds/auto/farmerOrders.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import mongoose from "mongoose";

// ⬇️ Adjust if your model path/casing differs
import FarmerOrderModel from "../../../src/models/farmerOrder.model";

const descriptor: SeederDescriptor = {
  name: "farmerOrders",
  collection: FarmerOrderModel.collection.name,
  dependsOn: ["users", "items", "farmers"], // referenced ids should exist first
  // IMPORTANT: point to the EXACT file your planner saw in the logs
  dataPaths: [path.resolve(__dirname, "../data/farmerOrders.data.json")],
  upsertOn: ["_id"], // (or switch to ["pickUpDate","shift","farmerId","itemId"] if you prefer a natural key)
  hasStatic: true,
  hasFaker: false,
};

/* ------------------------------- helpers ------------------------------- */

function toObjectIdOrThrow(id: any, label = "id") {
  const s = String(id ?? "").trim();
  if (!mongoose.isValidObjectId(s)) {
    throw new Error(`farmerOrders.seeder: invalid ${label}: ${id}`);
  }
  return new mongoose.Types.ObjectId(s);
}

function normalizeOne(raw: any) {
  const out = { ...raw };

  // Validate required ObjectIds
  out._id = toObjectIdOrThrow(out._id, "_id");
  out.createdBy = toObjectIdOrThrow(out.createdBy, "createdBy");
  out.updatedBy = toObjectIdOrThrow(out.updatedBy, "updatedBy");
  out.itemId = toObjectIdOrThrow(out.itemId, "itemId");
  out.farmerId = toObjectIdOrThrow(out.farmerId, "farmerId");
  out.logisticCenterId = toObjectIdOrThrow(
    out.logisticCenterId,
    "logisticCenterId"
  );

  // Orders
  if (Array.isArray(out.orders)) {
    out.orders = out.orders.map((o: any, i: number) => ({
      ...o,
      orderId: toObjectIdOrThrow(o?.orderId, `orders[${i}].orderId`),
    }));
  } else {
    out.orders = [];
  }

  // Totals (fill if missing)
  const sum = Array.isArray(out.orders)
    ? out.orders.reduce(
        (acc: number, o: any) => acc + (Number(o?.allocatedQuantityKg) || 0),
        0
      )
    : 0;
  if (typeof out.sumOrderedQuantityKg !== "number")
    out.sumOrderedQuantityKg = sum;
  if (typeof out.forcastedQuantityKg !== "number")
    out.forcastedQuantityKg = out.sumOrderedQuantityKg;
  if (typeof out.finalQuantityKg !== "number") {
    out.finalQuantityKg =
      Math.round(out.forcastedQuantityKg * 1.02 * 100) / 100;
  }

  // Stages: ensure exactly one "current"
  if (!Array.isArray(out.stages) || out.stages.length === 0) {
    throw new Error("farmerOrders.seeder: stages must be a non-empty array");
  }
  const currentCount = out.stages.filter(
    (s: any) => s?.status === "current"
  ).length;
  if (currentCount !== 1) {
    // try to force the last stage current if inconsistent
    out.stages = out.stages.map((s: any, i: number) => ({
      ...s,
      status:
        i === out.stages.length - 1
          ? "current"
          : s?.status === "current"
          ? "done"
          : s?.status ?? "done",
    }));
  }

  // Timestamps
  if (!out.createdAt) out.createdAt = new Date();
  out.updatedAt = out.updatedAt ? new Date(out.updatedAt) : new Date();

  return out;
}

/* -------------------------------- seeder ------------------------------- */

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], {
    strict: ctx.flags.strict,
  });
  if (!Array.isArray(docs)) docs = [docs];
  const prepped = docs.map(normalizeOne);

  const upsertKeys = ctx.upsertOn[descriptor.name] ??
    descriptor.upsertOn ?? ["_id"];
  return bulkUpsertModel(
    FarmerOrderModel as any,
    prepped,
    upsertKeys,
    ctx.batchSize,
    ctx.dryRun
  );
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, FarmerOrderModel as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
