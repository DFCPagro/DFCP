import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import ContainerOps from "../../../src/models/ContainerOps.model";
import mongoose, { Types } from "mongoose";

const DATA = path.resolve(__dirname, "../data/containerOps.data.json");

const descriptor: SeederDescriptor = {
  name: "containerOps",
  collection: (ContainerOps as any).collection?.name || "containerops",
  dependsOn: [], // you can add ["users","farmerOrders","items","logisticsCenters"] if you want ordering
  dataPaths: [DATA],
  upsertOn: ["containerId", "logisticCenterId"], // keep unique per LC+container
  hasStatic: true,
  hasFaker: false
};

function asObjectId(x: any): Types.ObjectId | undefined {
  if (!x) return undefined;
  try {
    return new Types.ObjectId(String(x));
  } catch {
    return undefined;
  }
}

/** Normalize & validate each row before upsert. */
async function prepare(docs: any[]) {
  const out: any[] = [];

  for (const d of docs) {
    const cleaned: any = { ...d };

    // Coerce ids to ObjectId (model requires ObjectId types)
    const farmerOrderId = asObjectId(d.farmerOrderId);
    const itemId = asObjectId(d.itemId);
    const logisticCenterId = asObjectId(d.logisticCenterId);
    const _id = d._id ? asObjectId(d._id) : undefined;

    if (!farmerOrderId) throw new Error(`Invalid farmerOrderId for containerId=${d.containerId}`);
    if (!itemId) throw new Error(`Invalid itemId for containerId=${d.containerId}`);
    if (!logisticCenterId) throw new Error(`Invalid logisticCenterId for containerId=${d.containerId}`);

    cleaned._id = _id ?? new Types.ObjectId();
    cleaned.farmerOrderId = farmerOrderId;
    cleaned.itemId = itemId;
    cleaned.logisticCenterId = logisticCenterId;

    // Defaults for a clean warehouse start
    cleaned.state = cleaned.state || "arrived";
    cleaned.weightHistory = cleaned.weightHistory || [];
    cleaned.cleaning = cleaned.cleaning || {};
    cleaned.sorting = cleaned.sorting || {};
    cleaned.location = cleaned.location || {
      area: "warehouse",
      zone: null,
      aisle: null,
      shelfId: null,
      slotId: null,
      updatedAt: new Date()
    };
    cleaned.auditTrail = cleaned.auditTrail || [];

    // Basic requireds
    if (!cleaned.containerId) throw new Error("Missing containerId");

    // timestamps for consistency
    cleaned.createdAt = cleaned.createdAt ? new Date(cleaned.createdAt) : new Date();
    cleaned.updatedAt = new Date();

    out.push(cleaned);
  }

  return out;
}

async function seedStatic(ctx: SeedContext) {
  let rows: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(rows)) rows = [rows];

  const prepared = await prepare(rows);

  // Upsert on compound key — ensure model has a unique index if you want hard enforcement
  const res = await bulkUpsertModel(
    ContainerOps as any,
    prepared,
    descriptor.upsertOn!,
    ctx.batchSize,
    ctx.dryRun
  );

  return res;
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, ContainerOps as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
