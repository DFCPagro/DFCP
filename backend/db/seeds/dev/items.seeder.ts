// db/seeds/dev/items.seed.ts
import * as fs from "fs";
import * as path from "path";
import Item, { IItem } from "../../../src/models/Item.model";

const STATIC_ITEMS_PATH = path.resolve(__dirname, "../data/items.data.json");

function loadItems(): IItem[] {
  if (!fs.existsSync(STATIC_ITEMS_PATH)) {
    throw new Error(`Missing items.data.json at: ${STATIC_ITEMS_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(STATIC_ITEMS_PATH, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error("items.data.json must be a JSON array");
  }
  return parsed as IItem[];
}

export async function seedItems(options?: { clear?: boolean }) {
  const shouldClear = options?.clear !== false; // default true
  const items = loadItems();

  console.log(`🌱 Seeding ${items.length} items…`);

  if (shouldClear) {
    await Item.deleteMany({});
    console.log("🧹 Cleared existing items");
  }

  await Item.insertMany(items);

  console.log("✅ Items seeded");
}

// ---- CLI support ----
// Usage examples:
//   ts-node db/seeds/dev/items.seed.ts
//   ts-node db/seeds/dev/items.seed.ts --keep
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");

  seedItems({ clear: !keep }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedItems;
