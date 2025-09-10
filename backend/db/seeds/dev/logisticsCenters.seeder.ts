import * as fs from "fs";
import * as path from "path";
import { faker } from "@faker-js/faker";
import mongoose from "mongoose";
import LogisticsCenter from "../../../src/models/logisticsCenter.model";

// ---- Types for JSON input (strings for refs) ----
type LCSeedJSON = {
  _id?: string;                  // 24-hex ObjectId string (optional)
  logisticName: string;
  location: string;
  activeOrders?: string[];       // ObjectId strings
  employeeIds?: string[];        // ObjectId strings
  deliveryHistory?: string[];
};

const DATA_FILE = path.resolve(__dirname, "../data/logistics-centers.data.json");

// ---- Helpers ----
const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

const toObjectId = (s: string) => new mongoose.Types.ObjectId(s);

function loadStaticCenters(): LCSeedJSON[] {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`Missing logistics-centers.data.json at: ${DATA_FILE}`);
  }
  const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error("logistics-centers.data.json must be a JSON array");
  }

  // quick validation of required fields & ids
  parsed.forEach((row: any, i: number) => {
    if (!row?.logisticName || !row?.location) {
      throw new Error(`Row ${i}: "logisticName" and "location" are required`);
    }
    (row.activeOrders ?? []).forEach((id: any, j: number) => {
      if (!isHex24(id)) throw new Error(`Row ${i}.activeOrders[${j}] must be 24-hex ObjectId`);
    });
    (row.employeeIds ?? []).forEach((id: any, j: number) => {
      if (!isHex24(id)) throw new Error(`Row ${i}.employeeIds[${j}] must be 24-hex ObjectId`);
    });
    if (row._id && !isHex24(row._id)) {
      throw new Error(`Row ${i}: _id must be a 24-hex ObjectId string if provided`);
    }
  });

  return parsed as LCSeedJSON[];
}

function buildRandomCenter(): LCSeedJSON {
  const city = faker.location.city();
  return {
    logisticName: `${city} Logistics Center`,
    location: city,
    activeOrders: [],
    employeeIds: [],
    deliveryHistory: [],
  };
}

function normalizeForInsert(row: LCSeedJSON) {
  return {
    ...(row._id && isHex24(row._id) ? { _id: toObjectId(row._id) } : {}),
    logisticName: row.logisticName,
    location: row.location,
    activeOrders: (row.activeOrders ?? []).map(toObjectId),
    employeeIds: (row.employeeIds ?? []).map(toObjectId),
    deliveryHistory: row.deliveryHistory ?? [],
  };
}

// ---- Main seeder ----
export async function seedLogisticsCenters(options?: { random?: number; clear?: boolean }) {
  const randomCount = Number.isFinite(options?.random) ? Number(options!.random) : 0;
  const shouldClear = options?.clear !== false; // default true

  const staticCenters = loadStaticCenters();

  // build faker rows
  const randomCenters: LCSeedJSON[] = [];
  for (let i = 0; i < randomCount; i++) {
    randomCenters.push(buildRandomCenter());
  }

  const toInsert = [...staticCenters, ...randomCenters].map(normalizeForInsert);

  console.log(`🌱 Seeding ${staticCenters.length} static center(s)${randomCount ? ` + ${randomCount} random` : ""}…`);

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
  const randomIdx = args.findIndex(a => a === "--random");
  const random = randomIdx !== -1 && args[randomIdx + 1] ? Number(args[randomIdx + 1]) : 0;
  const keep = args.includes("--keep");

  seedLogisticsCenters({ random, clear: !keep }).catch(err => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedLogisticsCenters;
