// db/seeds/auto/deliverers.seeder.ts
import path from "path";
import type { SeederModule, SeederDescriptor, SeedContext } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";

import { Types } from "mongoose";

// models
import User from "../../../src/models/user.model";
import LogisticCenter from "../../../src/models/logisticsCenter.model";
import Deliverer from "../../../src/models/deliverer.model";

const DATA = path.resolve(__dirname, "../data/deliverers.data.json");

const descriptor: SeederDescriptor = {
  name: "deliverers",
  collection: Deliverer.collection.name,
  dependsOn: ["users", "logistics-centers"],
  dataPaths: [DATA],
  upsertOn: ["user", "driverLicenseNumber"],
  hasStatic: true,
  hasFaker: false,
};

// ───────────────── helpers ─────────────────
const isHex24 = (v: any): v is string =>
  typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

const toObjectIdMaybe = (v: any): Types.ObjectId | null => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  if (isHex24(v)) return new Types.ObjectId(v);
  return null;
};

function coerceNumber(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** If JSON has vehicleCargoCM as object, use it; otherwise derive from liters. */
function resolveCargoCM(raw: any): { height: number; length: number; width: number } {
  const cm = raw?.vehicleCargoCM;
  const h = coerceNumber(cm?.height);
  const l = coerceNumber(cm?.length);
  const w = coerceNumber(cm?.width);
  if (h != null && l != null && w != null) {
    return {
      height: Math.max(1, Math.round(h)),
      length: Math.max(1, Math.round(l)),
      width: Math.max(1, Math.round(w)),
    };
  }

  // Derive from liters → cm^3
  const liters = coerceNumber(raw?.vehicleCapacityLiters);
  // Default to a small valid crate if no liters provided
  const volume = Math.max(1, Math.round((liters ?? 50) * 1000)); // e.g., 50L default
  // Shape it like a shallow trunk: L : W : H ≈ 100 : 60 : 40 (arbitrary but plausible)
  // Solve k so that 100k * 60k * 40k ≈ volume → k ≈ cbrt(volume / 240_000)
  const base = 100 * 60 * 40; // 240,000
  const k = Math.cbrt(volume / base);
  const length = Math.max(1, Math.round(100 * k));
  const width  = Math.max(1, Math.round(60 * k));
  const height = Math.max(1, Math.round(40 * k));
  return { height, length, width };
}

async function ensureUserFromRaw(raw: any): Promise<Types.ObjectId | null> {
  const email = raw?.userEmail ?? raw?.email;
  if (typeof email === "string" && email.includes("@")) {
    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing?._id) return existing._id as any;

    const u = await User.create({
      email,
      name: raw?.name ?? "Deliverer",
      uid: raw?.userUid ?? undefined,
      role: "deliverer",
      password: "Temp#1234",
      isEmailVerified: true,
    });
    return (u as any)._id;
  }

  const uid = raw?.userUid ?? raw?.uid;
  if (typeof uid === "string" && uid.trim()) {
    const existing = await User.findOne({ uid }).select("_id").lean();
    if (existing?._id) return existing._id as any;

    const synthEmail = `${uid.toLowerCase()}@deliverers.local`;
    const u = await User.create({
      email: synthEmail,
      name: raw?.name ?? uid,
      uid,
      role: "deliverer",
      password: "Temp#1234",
      isEmailVerified: true,
    });
    return (u as any)._id;
  }
  return null;
}

async function resolveUserId(raw: any, ctx: SeedContext): Promise<Types.ObjectId | null> {
  const byMap = typeof raw?.user === "string" ? ctx.idMap.get("users", raw.user) : undefined;
  const direct =
    toObjectIdMaybe(byMap) ??
    toObjectIdMaybe(raw?.user) ??
    toObjectIdMaybe(raw?.userId) ??
    toObjectIdMaybe(raw?._user) ??
    null;
  if (direct) return direct;
  return ensureUserFromRaw(raw);
}

async function resolveLogisticCenterIdByNameOrId(v: any): Promise<Types.ObjectId | null> {
  const id = toObjectIdMaybe(v);
  if (id) return id;
  if (typeof v === "string" && v.trim()) {
    const lc = await LogisticCenter.findOne({ logisticName: v.trim() }).select("_id").lean();
    if (lc?._id) return lc._id as any;
  }
  return null;
}

async function mapLogisticCenters(raw: any): Promise<Types.ObjectId[] | undefined> {
  const inputs: any[] = Array.isArray(raw?.assignCenterIds) ? raw.assignCenterIds : [];
  if (inputs.length === 0) return undefined;

  const out: Types.ObjectId[] = [];
  for (const v of inputs) {
    const id = await resolveLogisticCenterIdByNameOrId(v);
    if (id) out.push(id);
  }
  return out.length ? out : undefined;
}

// ───────────────── seeding ─────────────────
async function seedStatic(ctx: SeedContext) {
  let rows: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(rows)) rows = [rows];

  const docs: any[] = [];

  for (const raw of rows) {
    try {
      const user = await resolveUserId(raw, ctx);
      if (!user) throw new Error("Could not resolve user id from row");

      const logisticCenterIds = await mapLogisticCenters(raw);
      const vehicleCargoCM = resolveCargoCM(raw);

      const doc: any = {
        user,
        // required driver fields
        driverLicenseNumber: raw.driverLicenseNumber ?? raw.license ?? undefined,
        licenseType: raw.licenseType ?? "B",

        // vehicle
        vehicleMake: raw.vehicleMake ?? null,
        vehicleModel: raw.vehicleModel ?? null,
        vehicleType: raw.vehicleType ?? raw.vehicle ?? null,
        vehicleYear: coerceNumber(raw.vehicleYear) ?? null,
        vehicleRegistrationNumber:
          raw.vehicleRegistrationNumber ?? raw.plateNumber ?? raw.plate ?? null,
        vehicleInsurance: !!raw.vehicleInsurance,

        // capacities & speed
        vehicleCapacityKg: coerceNumber(raw.vehicleCapacityKg) ?? null,
        vehicleCapacityLiters: coerceNumber(raw.vehicleCapacityLiters) ?? null,
        vehicleCargoCM, // <-- embedded object {height,length,width}
        speedKmH: coerceNumber(raw.speedKmH) ?? null,

        // relations
        logisticCenterIds: logisticCenterIds ?? [],

        // misc (optional)
        // phone, notes, status if your schema has these – not defined in your model,
        // so omit to avoid Mongoose strict errors.
      };

      docs.push(doc);
    } catch (e: any) {
      ctx.log(`[deliverers] skipping invalid row: ${e?.message || e}`);
    }
  }

  if (docs.length === 0) {
    ctx.log("[deliverers] no valid rows after normalization.");
    return { inserted: 0, upserted: 0 };
  }

  const keys = ctx.upsertOn[descriptor.name] ?? descriptor.upsertOn ?? ["user"];
  return bulkUpsertModel(Deliverer as any, docs, keys, ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, Deliverer as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
