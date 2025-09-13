/* db/seeds/dev/deliverers.seed.ts */
import * as fs from "fs";
import * as path from "path";
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";

import { Deliverer } from "../../../src/models/deliverer.model";
import LogisticsCenter from "../../../src/models/logisticsCenter.model";
import User from "../../../src/models/user.model";
import ApiError from "../../../src/utils/ApiError"; // optional; only for consistent error messages if you want

type DelivererSeedInput = {
  // identify the user (ONE of these is required)
  userEmail?: string;
  userUid?: string;

  // deliverer core fields
  licenseType: string;
  driverLicenseNumber: string;

  // vehicle (all optional; we’ll pass through if provided)
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  vehicleYear?: number | null;
  vehicleRegistrationNumber?: string | null;
  vehicleInsurance?: boolean;

  vehicleCapacityKg?: number | null;
  vehicleCapacityLiters?: number | null;
  speedKmH?: number | null;

  // optional assignments: by LC id or name
  assignCenterIds?: string[];
  assignCentersByName?: string[];

  // optional explicit month/schedules (usually omit & let schema do it)
  currentMonth?: number;
  activeSchedule?: number[];
  nextSchedule?: number[];
};

const DATA_FILE = path.resolve(__dirname, "../data/deliverers.data.json");

/** small guard */
const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

/** resolve a User._id by email or uid */
async function resolveUserId(row: DelivererSeedInput) {
  const q: any = {};
  if (row.userEmail) q.email = String(row.userEmail).toLowerCase();
  if (row.userUid) q.uid = row.userUid;
  if (!Object.keys(q).length) {
    throw new Error(`Seed row must include "userEmail" or "userUid"`);
  }

  const user = await User.findOne(q).select({ _id: 1, role: 1 }).lean();
  if (!user?._id) {
    throw new Error(`User not found for query: ${JSON.stringify(q)}`);
  }
  return user._id as mongoose.Types.ObjectId;
}

/** resolve LC ids by ids or by names (names win if both provided) */
async function resolveCenterIds(row: DelivererSeedInput): Promise<mongoose.Types.ObjectId[]> {
  // Prefer names if present (safer in dev)
  if (Array.isArray(row.assignCentersByName) && row.assignCentersByName.length > 0) {
    const centers = await LogisticsCenter.find({
      logisticName: { $in: row.assignCentersByName },
    }).select({ _id: 1, logisticName: 1 }).lean();

    const foundNames = new Set(centers.map(c => c.logisticName));
    const missing = row.assignCentersByName.filter(n => !foundNames.has(n));
    if (missing.length) {
      console.warn(`⚠️ Missing centers by name: ${missing.join(", ")}`);
    }
    return centers.map(c => c._id as mongoose.Types.ObjectId);
  }

  // Otherwise use ids if provided
  if (Array.isArray(row.assignCenterIds) && row.assignCenterIds.length > 0) {
    const validIds = row.assignCenterIds.filter(isHex24).map(id => new mongoose.Types.ObjectId(id));
    if (validIds.length !== row.assignCenterIds.length) {
      console.warn("⚠️ Some assignCenterIds were not 24-hex and were skipped");
    }
    return validIds;
  }

  return [];
}

/** load JSON if present; return [] if file is missing so we can still do random-only seeding */
function tryLoadStatic(): DelivererSeedInput[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("deliverers.data.json must be a JSON array");
  }
  // light validation
  parsed.forEach((row: any, i: number) => {
    if (!row.licenseType || !row.driverLicenseNumber) {
      throw new Error(`Row ${i}: "licenseType" and "driverLicenseNumber" are required`);
    }
    if (!row.userEmail && !row.userUid) {
      throw new Error(`Row ${i}: must include "userEmail" or "userUid"`);
    }
  });
  return parsed as DelivererSeedInput[];
}

/** build a random deliverer for a given user id */
function buildRandomDelivererFor(userId: mongoose.Types.ObjectId): Partial<DelivererSeedInput> {
  const vehicleType = faker.helpers.arrayElement(["Sedan", "Hatchback", "Van", "Bike"]);
  const licenseType = vehicleType === "Van"
    ? faker.helpers.arrayElement(["C", "C1"])
    : "B";

  return {
    // user resolved upstream
    licenseType,
    driverLicenseNumber: faker.string.alphanumeric({ length: 10, casing: "upper" }),
    vehicleMake: faker.vehicle.manufacturer(),
    vehicleModel: faker.vehicle.model(),
    vehicleType,
    vehicleYear: faker.number.int({ min: 2005, max: 2024 }),
    vehicleRegistrationNumber: `${faker.number.int({ min: 10, max: 99 })}-${faker.number.int({ min: 100, max: 999 })}-${faker.number.int({ min: 10, max: 99 })}`,
    vehicleInsurance: true,
    vehicleCapacityKg: vehicleType === "Van" ? faker.number.int({ min: 600, max: 1500 }) : faker.number.int({ min: 50, max: 250 }),
    vehicleCapacityLiters: vehicleType === "Van" ? faker.number.int({ min: 3000, max: 9000 }) : faker.number.int({ min: 200, max: 700 }),
    speedKmH: faker.number.int({ min: 40, max: 90 }),
    // schedules omitted → model will auto-size and zero
  };
}

/** upsert a single deliverer; keep LC.employeeIds in sync */
async function upsertDeliverer(
  userId: mongoose.Types.ObjectId,
  payload: Omit<DelivererSeedInput, "userEmail" | "userUid" | "assignCenterIds" | "assignCentersByName">,
  centerIds: mongoose.Types.ObjectId[],
  session?: mongoose.ClientSession
) {
  // compose update set
  const $set: any = {
    ...payload,
    user: userId,
    logisticCenterIds: centerIds,
  };

  // if schedules are omitted, we avoid setting them so the model hooks apply defaults on insert
  if (!payload.activeSchedule) delete $set.activeSchedule;
  if (!payload.nextSchedule) delete $set.nextSchedule;
  if (!payload.currentMonth) delete $set.currentMonth;

  const doc = await Deliverer.findOneAndUpdate(
    { user: userId },
    { $set },
    { new: true, upsert: true, runValidators: true, session, setDefaultsOnInsert: true }
  );

  // Keep LC.employeeIds in sync with USER id (not deliverer id)
  if (centerIds.length) {
    await LogisticsCenter.updateMany(
      { _id: { $in: centerIds } },
      { $addToSet: { employeeIds: userId } },
      { session }
    );
  }

  // Also remove from centers that are no longer assigned (when merging)
  const currentCenterIds = new Set(centerIds.map(String));
  const staleCenters = await LogisticsCenter.find({
    _id: { $nin: centerIds },
    employeeIds: userId,
  }).select({ _id: 1 }).lean();

  if (staleCenters.length) {
    const staleIds = staleCenters.map(c => c._id);
    await LogisticsCenter.updateMany(
      { _id: { $in: staleIds } },
      { $pull: { employeeIds: userId } },
      { session }
    );
  }

  return doc;
}

/** main seeder */
export async function seedDeliverers(options?: { clear?: boolean; random?: number }) {
  const shouldClear = options?.clear !== false; // default true
  const randomCount = Number.isFinite(options?.random) ? Number(options!.random) : 0;

  // Load static rows (if file exists)
  const staticRows = tryLoadStatic();

  console.log(
    `🌱 Deliverers seed: ${staticRows.length} static${randomCount ? ` + ${randomCount} random` : ""} (${shouldClear ? "replace" : "merge"})`
  );

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (shouldClear) {
        // 1) When clearing deliverers, also clean employeeIds references to deliverer users
        const delivererUsers = await Deliverer.find().select({ user: 1 }).lean();
        const delivererUserIds = delivererUsers.map(d => d.user).filter(Boolean);
        await Deliverer.deleteMany({});
        console.log("🧹 Cleared Deliverer collection");
        if (delivererUserIds.length) {
          await LogisticsCenter.updateMany(
            { employeeIds: { $in: delivererUserIds } },
            { $pull: { employeeIds: { $in: delivererUserIds } } }
          );
          console.log("🧽 Cleaned employeeIds references in LogisticsCenter");
        }
      }

      // 2) Seed static deliverers
      for (const row of staticRows) {
        const userId = await resolveUserId(row);
        const centerIds = await resolveCenterIds(row);

        const payload: any = {
          licenseType: row.licenseType,
          driverLicenseNumber: row.driverLicenseNumber,
          vehicleMake: row.vehicleMake ?? null,
          vehicleModel: row.vehicleModel ?? null,
          vehicleType: row.vehicleType ?? null,
          vehicleYear: row.vehicleYear ?? null,
          vehicleRegistrationNumber: row.vehicleRegistrationNumber ?? null,
          vehicleInsurance: !!row.vehicleInsurance,
          vehicleCapacityKg: row.vehicleCapacityKg ?? null,
          vehicleCapacityLiters: row.vehicleCapacityLiters ?? null,
          speedKmH: row.speedKmH ?? null,
        };

        // optional explicit month/schedules
        if (typeof row.currentMonth === "number") payload.currentMonth = row.currentMonth;
        if (Array.isArray(row.activeSchedule)) payload.activeSchedule = row.activeSchedule;
        if (Array.isArray(row.nextSchedule)) payload.nextSchedule = row.nextSchedule;

        await upsertDeliverer(userId, payload, centerIds, session);
      }

      // 3) Random deliverers: attach to any users with role deliverer/industrialDeliverer that don’t have a Deliverer doc yet
      if (randomCount > 0) {
        // pick candidate users
        const candidates = await User.find({
          role: { $in: ["deliverer", "industrialDeliverer"] },
          _id: { $nin: (await Deliverer.find().select({ user: 1 })).map(d => d.user) }
        }).select({ _id: 1 }).limit(randomCount).lean();

        const allCenters = await LogisticsCenter.find().select({ _id: 1 }).lean();
        for (const u of candidates) {
          const userId = u._id as mongoose.Types.ObjectId;
          const randPayload = buildRandomDelivererFor(userId) as DelivererSeedInput;

          // randomly assign 0–2 centers
          const assignCount = faker.number.int({ min: 0, max: Math.min(2, allCenters.length) });
          const centerIds = faker.helpers.arrayElements(
            allCenters.map(c => c._id as mongoose.Types.ObjectId),
            assignCount
          );

          await upsertDeliverer(userId, randPayload as any, centerIds, session);
        }
      }
    });

    console.log("✅ Deliverers seeded successfully");
  } catch (err) {
    console.error("❌ Deliverers seeding failed:", err);
    process.exit(1);
  } finally {
    session.endSession();
  }
}

// ---- CLI ----
// Usage:
//   ts-node db/seeds/dev/deliverers.seed.ts
//   ts-node db/seeds/dev/deliverers.seed.ts --keep       (merge/upsert, don’t clear)
//   ts-node db/seeds/dev/deliverers.seed.ts --random 5   (adds up to 5 random deliverers)
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep") || args.includes("--merge");
  const randomIdx = args.findIndex((a) => a === "--random");
  const random =
    randomIdx !== -1 && args[randomIdx + 1] ? Number(args[randomIdx + 1]) : 0;

  seedDeliverers({ clear: !keep, random }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedDeliverers;
