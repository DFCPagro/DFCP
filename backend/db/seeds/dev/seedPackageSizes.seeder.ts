// db/seeds/dev/packageSizes.seeder.ts  (or your current seeder file)
import * as fs from "fs";
import * as path from "path";
import mongoose from "mongoose";
import { PackageSize } from "../../../src/models/PackageSize";

const STATIC_FILE = "../data/package-sizes.data.json";

type SizeInput = {
  _id?: string; // optional stable id
  name: "Small" | "Medium" | "Large" | string;
  key: "Small" | "Medium" | "Large";
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct: number;
  maxSkusPerBox: number;
  maxWeightKg: number;
  mixingAllowed: boolean;
  tareWeightKg: number;
  usableLiters?: number;
  vented: boolean;
  values?: Record<string, number>;
};

function loadData(): SizeInput[] {
  const p = path.join(__dirname, STATIC_FILE);
  if (!fs.existsSync(p)) throw new Error(`Missing ${STATIC_FILE} at ${p}`);
  const data = JSON.parse(fs.readFileSync(p, "utf-8")) as SizeInput[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("package-sizes.data.json must be a non-empty array");
  }
  return data;
}

export async function seedPackageSizes(options?: { clear?: boolean }) {
  const clear = options?.clear !== false;
  const sizes = loadData();

  if (clear) {
    await PackageSize.deleteMany({});
    console.log("🧹 Cleared PackageSize collection");
  }

  const ops = sizes.map((s) => {
    const filter =
      s._id && mongoose.isValidObjectId(s._id)
        ? { _id: new mongoose.Types.ObjectId(s._id) }
        : { key: s.key, vented: s.vented };

    return {
      updateOne: {
        filter,
        update: { $set: s },
        upsert: true,
      },
    };
  });

  const res = await (PackageSize as any).bulkWrite(ops, { ordered: false });
  console.log(
    `✅ Seeded/updated ${sizes.length} package sizes (upserts: ${res.upsertedCount ?? 0}, modified: ${
      res.modifiedCount ?? res.nModified ?? 0
    })`
  );
}

