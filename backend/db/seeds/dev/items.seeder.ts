// db/seeds/dev/items.seed.ts
import * as fs from "fs";
import * as path from "path";
import Item from "../../../src/models/Item.model";
import type { Item as ItemShape } from "../../../src/models/Item.model";

// Where the static JSON lives
const STATIC_ITEMS_PATH = path.resolve(__dirname, "../data/items.data.json");

// Minimal shape for seed input (stronger than "any", flexible enough for JSON)
type SeedItem = Partial<ItemShape> & {
  _id: string;            // you use string codes as ids (e.g., "FRT-001")
  category: ItemShape["category"];
  type: string;
};

function loadItems(): SeedItem[] {
  if (!fs.existsSync(STATIC_ITEMS_PATH)) {
    throw new Error(`Missing items.data.json at: ${STATIC_ITEMS_PATH}`);
  }
  const raw = fs.readFileSync(STATIC_ITEMS_PATH, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`items.data.json is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("items.data.json must be a JSON array");
  }
  // Lightweight sanity checks to catch obvious mistakes early
  const items = parsed as SeedItem[];
  items.forEach((it, idx) => {
    if (!it || typeof it !== "object") throw new Error(`Item at index ${idx} is not an object`);
    if (!("_id" in it) || typeof it._id !== "string" || !it._id.trim()) {
      throw new Error(`Item at index ${idx} is missing a non-empty string "_id"`);
    }
    if (!("category" in it) || typeof it.category !== "string") {
      throw new Error(`Item "${it._id}" missing "category"`);
    }
    if (!("type" in it) || typeof it.type !== "string" || !it.type.trim()) {
      throw new Error(`Item "${it._id}" missing "type"`);
    }
  });
  return items;
}

export async function seedItems(options?: { clear?: boolean }) {
  const shouldClear = options?.clear !== false; // default true
  const items = loadItems();

  console.log(`🌱 Seeding ${items.length} items… (mode: ${shouldClear ? "replace" : "merge"})`);

  try {
    if (shouldClear) {
      const res = await Item.deleteMany({});
      console.log(`🧹 Cleared existing items (deleted ${res.deletedCount ?? 0})`);
      // Simple insert when we know collection is empty
      const inserted = await Item.insertMany(items, { ordered: true });
      console.log(`✅ Inserted ${inserted.length} items`);
    } else {
      // Merge mode: upsert by _id so existing docs are updated, new ones are added
      const ops = items.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              ...doc,
              // ensure lastUpdated is refreshed on seed (your schema also updates this on save hooks)
              lastUpdated: new Date(),
            },
          },
          upsert: true,
        },
      }));
      const result = await Item.bulkWrite(ops, { ordered: false });
      const upserts = result.upsertedCount ?? 0;
      const mods =
        (result.modifiedCount ?? 0) ||
        // fallback for older versions
        // @ts-expect-error
        (result.nModified ?? 0);
      console.log(`✅ Merged items (upserted: ${upserts}, modified: ${mods})`);
    }
    console.log("🎉 Items seeded successfully");
  } catch (err: any) {
    // Helpful diagnostics for common errors
    const msg = String(err?.message || err);
    if (msg.includes("E11000")) {
      console.error("❌ Duplicate key error (E11000).");
      console.error(
        "   Tip: Run without --keep (default) to clear first, or keep mode already uses upserts."
      );
    } else if (err?.errors) {
      // Mongoose validation errors
      console.error("❌ Validation failed for one or more items:");
      Object.entries(err.errors).forEach(([path, e]: any) => {
        console.error(`   - ${path}: ${e?.message}`);
      });
    } else {
      console.error("❌ Seeding failed:", err);
    }
    process.exit(1);
  }
}

// ---- CLI support ----
// Usage examples:
//   ts-node db/seeds/dev/items.seed.ts
//   ts-node db/seeds/dev/items.seed.ts --keep     (merge/upsert by _id)
//   ts-node db/seeds/dev/items.seed.ts --merge    (alias of --keep)
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep") || args.includes("--merge");

  seedItems({ clear: !keep }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedItems;
