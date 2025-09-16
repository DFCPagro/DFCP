import * as fs from "fs";
import * as path from "path";
import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import LogisticsCenter from "../../../src/models/logisticsCenter.model";

// ---- Types for JSON input (support legacy + new) ----
type GeoPointJSON = {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
};

type DeliveryHistoryEntryJSON =
  | string
  | { message: string; at?: string | Date; by?: string | null };

type LCSeedJSON = {
  _id?: string; // 24-hex ObjectId
  logisticName: string;

  // Legacy: location as string
  location?: string;

  // New: merged location object
  locationObj?: {
    name: string;
    geo?: GeoPointJSON;
  };

  // Legacy (will be ignored/converted): activeOrders
  activeOrders?: string[];

  // Employee ids (as strings)
  employeeIds?: string[];

  // Legacy/new: delivery history
  deliveryHistory?: DeliveryHistoryEntryJSON[];
};

const DATA_FILE = path.resolve(
  __dirname,
  "../data/logistics-centers.data.json"
);

// ---- Helpers ----
const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

const toObjectId = (s: string) => new mongoose.Types.ObjectId(s);

function isGeoPointJSON(g: any): g is GeoPointJSON {
  return (
    g &&
    g.type === "Point" &&
    Array.isArray(g.coordinates) &&
    g.coordinates.length === 2 &&
    Number.isFinite(g.coordinates[0]) &&
    Number.isFinite(g.coordinates[1])
  );
}

function toDeliveryHistory(entries?: DeliveryHistoryEntryJSON[]) {
  if (!entries || entries.length === 0) return [];
  return entries.map((e) => {
    if (typeof e === "string") {
      return { message: e, at: new Date() };
    }
    const at =
      e.at instanceof Date ? e.at : e.at ? new Date(e.at) : new Date();
    const by =
      e.by && isHex24(e.by) ? new mongoose.Types.ObjectId(e.by) : null;
    return { message: e.message, at, by };
  });
}

function loadStaticCenters(): LCSeedJSON[] {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing logistics-centers.data.json at: ${DATA_FILE}`);
  }
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error("logistics-centers.data.json must be a JSON array");
  }

  // quick validation of required fields & ids (support legacy/new)
  parsed.forEach((row: any, i: number) => {
    const hasLegacy = !!row?.location && typeof row.location === "string";
    const hasNew = !!row?.locationObj?.name;

    if (!row?.logisticName || (!hasLegacy && !hasNew)) {
      throw new Error(
        `Row ${i}: "logisticName" and either legacy "location" (string) or "locationObj.name" are required`
      );
    }

    (row.employeeIds ?? []).forEach((id: any, j: number) => {
      if (!isHex24(id))
        throw new Error(
          `Row ${i}.employeeIds[${j}] must be 24-hex ObjectId string`
        );
    });

    if (row.locationObj?.geo && !isGeoPointJSON(row.locationObj.geo)) {
      throw new Error(
        `Row ${i}: locationObj.geo must be { type:"Point", coordinates:[lng,lat] }`
      );
    }

    if (row._id && !isHex24(row._id)) {
      throw new Error(
        `Row ${i}: _id must be a 24-hex ObjectId string if provided`
      );
    }
  });

  return parsed as LCSeedJSON[];
}

function buildRandomCenter(): LCSeedJSON {
  const city = faker.location.city();
  const hasGeo = faker.datatype.boolean(); // randomly include geo for demo
  const lng = Number(faker.location.longitude());
  const lat = Number(faker.location.latitude());

  return {
    logisticName: `${city} Logistics Center`,
    locationObj: {
      name: city,
      geo: hasGeo
        ? {
            type: "Point",
            coordinates: [lng, lat],
          }
        : undefined,
    },
    employeeIds: [],
    deliveryHistory: [
      { message: "Center created by seeder", at: new Date().toISOString() },
    ],
  };
}

function normalizeForInsert(row: LCSeedJSON) {
  // Build the merged location object:
  const location =
    row.locationObj && row.locationObj.name
      ? {
          name: row.locationObj.name,
          ...(row.locationObj.geo && isGeoPointJSON(row.locationObj.geo)
            ? { geo: row.locationObj.geo }
            : {}),
        }
      : {
          // legacy fallback: string location
          name: row.location!,
        };

  return {
    ...(row._id && isHex24(row._id) ? { _id: toObjectId(row._id) } : {}),
    logisticName: row.logisticName,
    location, // merged shape expected by model
    // activeOrders omitted (virtual)
    employeeIds: (row.employeeIds ?? []).map(toObjectId),
    deliveryHistory: toDeliveryHistory(row.deliveryHistory),
  };
}

// ---- Main seeder ----
export async function seedLogisticsCenters(options?: {
  random?: number;
  clear?: boolean;
}) {
  const randomCount = Number.isFinite(options?.random)
    ? Number(options!.random)
    : 0;
  const shouldClear = options?.clear !== false; // default true

  const staticCenters = loadStaticCenters();

  // build faker rows
  const randomCenters: LCSeedJSON[] = [];
  for (let i = 0; i < randomCount; i++) {
    randomCenters.push(buildRandomCenter());
  }

  const toInsert = [...staticCenters, ...randomCenters].map(normalizeForInsert);

  console.log(
    `🌱 Seeding ${staticCenters.length} static center(s)${
      randomCount ? ` + ${randomCount} random` : ""
    }…`
  );

  if (shouldClear) {
    await LogisticsCenter.deleteMany({});
    console.log("🧹 Cleared existing logistics centers");
  }

  await LogisticsCenter.insertMany(toInsert);
  console.log("✅ Logistics centers seeded");
}

// ---- CLI ----
// Usage:
//   ts-node db/seeds/dev/logisticsCenters.seed.ts
//   ts-node db/seeds/dev/logisticsCenters.seed.ts --random 2
//   ts-node db/seeds/dev/logisticsCenters.seed.ts --keep
if (require.main === module) {
  const args = process.argv.slice(2);
  const randomIdx = args.findIndex((a) => a === "--random");
  const random =
    randomIdx !== -1 && args[randomIdx + 1]
      ? Number(args[randomIdx + 1])
      : 0;
  const keep = args.includes("--keep");

  seedLogisticsCenters({ random, clear: !keep }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedLogisticsCenters;
