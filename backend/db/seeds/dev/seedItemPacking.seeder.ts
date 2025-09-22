/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import { connectDB, disconnectDB } from "../../../src/db/connect"; // keep for CLI only
import { ItemPacking } from "../../../src/models/ItemPacking";

const STATIC_FILE = "../data/item-packing.data.json";

type Json = {
  items: Array<{
    itemId: string;
    type: string;
    variety: string;
    category: "fruit" | "vegetable";
    packing: {
      bulkDensityKgPerL: number;
      litersPerKg: number;
      fragility: "very_fragile" | "fragile" | "normal" | "sturdy";
      allowMixing: boolean;
      requiresVentedBox: boolean;
      minBoxType: "Small" | "Medium" | "Large";
      maxWeightPerBoxKg?: number;
      notes?: string | null;
    };
  }>;
  units?: { notes?: string | null };
};

function loadData(): Json {
  const p = path.join(__dirname, STATIC_FILE);
  if (!fs.existsSync(p)) throw new Error(`Missing ${STATIC_FILE} at ${p}`);
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  if (!raw || !Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error("item-packing.data.json: must include non-empty items[]");
  }
  raw.items = raw.items.map((it: any) => ({
    ...it,
    packing: {
      ...it.packing,
      bulkDensityKgPerL: Number(it.packing.bulkDensityKgPerL),
      litersPerKg: Number(it.packing.litersPerKg),
      maxWeightPerBoxKg:
        it.packing.maxWeightPerBoxKg != null ? Number(it.packing.maxWeightPerBoxKg) : undefined,
    },
  }));
  return raw as Json;
}

export async function seedItemPacking(options?: { clear?: boolean }) {
  const clear = options?.clear !== false; // default true
  const data = loadData();

  if (clear) {
    await ItemPacking.deleteMany({});
    console.log("🧹 Cleared ItemPacking collection");
  }

  // Single document that contains all items[] and a units block.
  const doc = await ItemPacking.create({
    items: data.items,
    units: data.units ?? { notes: null },
  });

  console.log(`✅ Seeded ItemPacking (${doc.id}) with ${data.items.length} items`);
}

// ---- CLI support (connect here only when run directly) ----
if (require.main === module) {
  const keep = process.argv.includes("--keep");
  (async () => {
    await connectDB();
    try {
      await seedItemPacking({ clear: !keep });
    } catch (err) {
      console.error("❌ ItemPacking seed failed:", err);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}

export default seedItemPacking;
