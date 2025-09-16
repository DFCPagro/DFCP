/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import {
  AvailableMarketStockModel,
  SHIFT_NAMES,
  ITEM_STATUSES,
  type ShiftName,
  type ItemStatus,
} from "../../../src/models/availableMarketStock.model";

// -------- Input DTOs (shape of JSON) --------
type SeedAvailableItemInput = {
  _id?: string;
  itemId: string;
  displayName: string;
  imageUrl?: string | null;
  category: string;
  pricePerUnit: number;
  currentAvailableQuantityKg: number;
  originalCommittedQuantityKg: number;
  farmerOrderId?: string | null;
  farmerID: string;
  farmerName: string;
  farmName: string;
  status?: string;
};

type SeedAvailableStockInput = {
  _id?: string;
  LCid: string;
  availableDate: string | Date;
  availableShift: string;
  createdById?: string | null;
  createdAt?: string | Date; // ignored
  items: SeedAvailableItemInput[];
};

// -------- Helpers / guards --------
const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

const isShift = (v: unknown): v is ShiftName =>
  typeof v === "string" && (SHIFT_NAMES as readonly string[]).includes(v);

const isStatus = (v: unknown): v is ItemStatus =>
  typeof v === "string" && (ITEM_STATUSES as readonly string[]).includes(v);

function normalizeAvailableDate(d: string | Date): Date {
  const obj = new Date(d);
  if (Number.isNaN(obj.getTime()))
    throw new Error(`availableDate "${d}" is invalid`);
  obj.setUTCHours(0, 0, 0, 0);
  return obj;
}

function normalizeItem(i: SeedAvailableItemInput, idx: number) {
  if (!isHex24(i.itemId))
    throw new Error(`items[${idx}].itemId must be 24-hex`);
  if (!isHex24(i.farmerID))
    throw new Error(`items[${idx}].farmerID must be 24-hex`);
  if (i._id !== undefined && !isHex24(i._id))
    throw new Error(`items[${idx}]._id must be 24-hex if provided`);
  if (
    i.farmerOrderId !== undefined &&
    i.farmerOrderId !== null &&
    !isHex24(i.farmerOrderId)
  )
    throw new Error(`items[${idx}].farmerOrderId must be 24-hex if provided`);

  const status: ItemStatus = isStatus(i.status)
    ? (i.status as ItemStatus)
    : "active";

  if (i.pricePerUnit < 0)
    throw new Error(`items[${idx}].pricePerUnit cannot be negative`);
  if (i.originalCommittedQuantityKg < 0)
    throw new Error(`items[${idx}].originalCommittedQuantityKg < 0`);
  if (i.currentAvailableQuantityKg < 0)
    throw new Error(`items[${idx}].currentAvailableQuantityKg < 0`);
  if (i.currentAvailableQuantityKg > i.originalCommittedQuantityKg) {
    throw new Error(
      `items[${idx}]: currentAvailableQuantityKg (${i.currentAvailableQuantityKg}) ` +
        `cannot exceed originalCommittedQuantityKg (${i.originalCommittedQuantityKg})`
    );
  }

  return {
    ...(i._id ? { _id: i._id } : {}),
    itemId: i.itemId,
    displayName: i.displayName,
    imageUrl: i.imageUrl ?? null,
    category: i.category, // let schema validate enum if you keep a category enum there
    pricePerUnit: i.pricePerUnit,
    currentAvailableQuantityKg: i.currentAvailableQuantityKg,
    originalCommittedQuantityKg: i.originalCommittedQuantityKg,
    farmerOrderId: i.farmerOrderId ?? null,
    farmerID: i.farmerID,
    farmerName: i.farmerName,
    farmName: i.farmName,
    status,
  };
}

function normalizeDoc(d: SeedAvailableStockInput) {
  if (d._id !== undefined && !isHex24(d._id)) {
    throw new Error(`_id "${d._id}" must be 24-hex`);
  }
  if (
    d.createdById !== undefined &&
    d.createdById !== null &&
    !isHex24(d.createdById)
  ) {
    throw new Error(
      `createdById "${d.createdById}" must be 24-hex if provided`
    );
  }
  if (!isShift(d.availableShift)) {
    throw new Error(
      `availableShift "${d.availableShift}" must be one of: ${SHIFT_NAMES.join(
        ", "
      )}`
    );
  }

  const items = (Array.isArray(d.items) ? d.items : []).map(normalizeItem);
  if (items.length === 0) throw new Error(`items must be a non-empty array`);

  return {
    ...(d._id ? { _id: d._id } : {}),
    LCid: String(d.LCid).trim(),
    availableDate: normalizeAvailableDate(d.availableDate),
    availableShift: d.availableShift as ShiftName,
    createdById: d.createdById ?? null,
    items,
  };
}

// -------- Data loader --------
const DEFAULT_DATA_FILE = path.join(__dirname, "../data/available-stock.data.json");


function loadStocks(filePath?: string) {
  const fp = filePath ? path.resolve(filePath) : DEFAULT_DATA_FILE;
  if (!fs.existsSync(fp)) {
    throw new Error(`Missing seed JSON at: ${fp}`);
  }
  const parsed = JSON.parse(fs.readFileSync(fp, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Seed file must be a JSON array (no wrapper).`);
  }
  return (parsed as SeedAvailableStockInput[]).map(normalizeDoc);
}

// -------- Public seeder (no connect/disconnect here) --------
export async function seedAvailableStock(options?: {
  clear?: boolean;
  file?: string;
}) {
  const shouldClear = options?.clear !== false;
  const docs = loadStocks(options?.file);

  console.log(`🌱 Seeding AvailableMarketStock (${docs.length} docs)…`);
  if (shouldClear) {
    await AvailableMarketStockModel.deleteMany({});
    console.log("🧹 Cleared AvailableMarketStock collection");
  }

  // Use create to run model validations/hooks
  await AvailableMarketStockModel.create(docs);
  console.log("✅ AvailableMarketStock seeded");
}

// -------- CLI shim (optional) --------
// Usage:
//   ts-node db/seeds/dev/seedAvailableStock.ts
//   ts-node db/seeds/dev/seedAvailableStock.ts --keep
//   ts-node db/seeds/dev/seedAvailableStock.ts --file ../data/here/available-stock.json
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const fileIdx = args.findIndex((a) => a === "--file");
  const file = fileIdx !== -1 ? args[fileIdx + 1] : undefined;

  seedAvailableStock({ clear: !keep, file }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedAvailableStock;
