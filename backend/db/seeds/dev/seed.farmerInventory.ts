/**
 * Dev Seeder – FarmerInventory
 *
 * - LogisticsCenterId: 66e007000000000000000001
 * - Farmers: 6 total
 *    • 2 provided: 66f2aa00000000000000002a, 66f2aa000000000000000008
 *    • 4 fake ObjectIds
 * - Each farmer: 4 inventory rows
 * - agreementAmountKg: 100–200
 * - currentAvailableAmountKg: 50–min(150, agreement)
 *
 * Run:
 *   $env:MONGO_URI="mongodb+srv://user:pass@cluster/mydb"
 *   npm run seed:farmerInventory
 */

import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { connectDB, disconnectDB } from "../../../src/db/connect";
import ItemModel from "../../../src/models/Item.model";
import FarmerInventoryModel from "../../../src/models/farmerInventory.model";

const LC_ID = "66e007000000000000000001";
const PROVIDED_FARMER_IDS = [
  "66f2aa00000000000000002a",
  "66f2aa000000000000000008",
  "66f2aa000000000000000041",
  "66f2aa000000000000000040",
   "66f2aa00000000000000003f"

];
const FAKE_FARMERS_COUNT = 0;
const INVENTORIES_PER_FARMER = 5;

const AGREEMENT_MIN = 100;
const AGREEMENT_MAX = 200;
const AVAILABLE_MIN = 50;
const AVAILABLE_MAX = 150;

/** Random int in [min, max] */
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
/** Pick n distinct items from array */
function pickDistinct<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr];
  const picked: T[] = [];
  const seen = new Set<number>();
  while (picked.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (!seen.has(i)) {
      seen.add(i);
      picked.push(arr[i]);
    }
  }
  return picked;
}

/** Detects whether the model uses 'farmerId' or 'farmerUserId' */
function detectFarmerFieldName(): "farmerId" | "farmerUserId" {
  const hasFarmerId = !!(FarmerInventoryModel.schema.path("farmerId") as any);
  const hasFarmerUserId = !!(FarmerInventoryModel.schema.path("farmerUserId") as any);

  if (hasFarmerId && hasFarmerUserId) {
    // prefer the required one if any
    const p1 = FarmerInventoryModel.schema.path("farmerId") as any;
    const p2 = FarmerInventoryModel.schema.path("farmerUserId") as any;
    if (p1?.isRequired && !p2?.isRequired) return "farmerId";
    if (p2?.isRequired && !p1?.isRequired) return "farmerUserId";
    return "farmerId";
  }
  if (hasFarmerId) return "farmerId";
  if (hasFarmerUserId) return "farmerUserId";
  return "farmerId";
}

async function seed() {
  const conn = await connectDB();
  console.log(`🔌 Connected to DB: ${conn.name}`);

  try {
    const items = await ItemModel.find({}, { _id: 1 }).lean();
    if (!items.length) {
      throw new Error("No items found. Seed items first.");
    }

    const fakeIds = Array.from({ length: FAKE_FARMERS_COUNT }, () =>
      new Types.ObjectId().toString()
    );
    const farmerIds = [...PROVIDED_FARMER_IDS, ...fakeIds];
    const farmerField = detectFarmerFieldName();

    const docs: any[] = [];

    for (const farmerId of farmerIds) {
      const chosen = pickDistinct(items, Math.min(INVENTORIES_PER_FARMER, items.length));
      for (const it of chosen) {
        const agreement = randInt(AGREEMENT_MIN, AGREEMENT_MAX);
        const available = randInt(AVAILABLE_MIN, Math.min(AVAILABLE_MAX, agreement));

        const row: any = {
          itemId: (it as any)._id.toString(),
          logisticCenterId: LC_ID,
          agreementAmountKg: agreement,
          currentAvailableAmountKg: available,
        };
        //console.log("Row:", row);
        row[farmerField] = farmerId;

        docs.push(row);
      }
    }

    // Optional: wipe previous test data
    // await FarmerInventoryModel.deleteMany({ logisticCenterId: LC_ID });

    const inserted = await FarmerInventoryModel.insertMany(docs, { ordered: false });
    console.log(`✅ Inserted ${inserted.length} farmerInventory docs`);
    console.log(`📚 Using collection: ${(FarmerInventoryModel as any).collection.name}`);
    console.log("👩‍🌾 Farmers:", farmerIds);

  } catch (err) {
    console.error("❌ Seed failed:", err);
    throw err;
  } finally {
    await disconnectDB().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

if (require.main === module) {
  seed().catch(() => process.exit(1));
}
export default seed;
