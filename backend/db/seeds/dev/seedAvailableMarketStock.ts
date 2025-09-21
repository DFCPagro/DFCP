/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import mongoose, { Types } from "mongoose";
import AvailableMarketStockModel, {
  SHIFT_NAMES,
  ITEM_STATUSES,
} from "../../../src/models/availableMarketStock.model";
import LogisticsCenter from "../../../src/models/logisticsCenter.model";

/* ---------------- Types & utils ---------------- */

const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

const toObjectId = (s: string) => new Types.ObjectId(s);

type ItemInput = {
  _id?: string;
  itemId: string; // 24-hex
  displayName: string;
  imageUrl?: string | null;
  category: string;
  pricePerUnit: number;
  originalCommittedQuantityKg: number;
  currentAvailableQuantityKg: number;
  farmerOrderId?: string | null;
  farmerID: string; // 24-hex
  farmerName: string;
  farmName: string;
  status?: (typeof ITEM_STATUSES)[number];
};

type StockInput = {
  _id?: string;
  LCid: string; // 24-hex or "LC-<n>" or a name we can match
  availableDate: string | Date;
  availableShift: (typeof SHIFT_NAMES)[number];
  createdById?: string | null;
  createdAt?: string | Date; // ignored by timestamps
  items?: ItemInput[];
};

type StockInputLoose = Partial<StockInput> & {
  // common aliases people sometimes use
  shift?: string;
  name?: string; // sometimes used instead of availableShift
  logisticCenterId?: string; // sometimes used instead of LCid
};

type StockToInsert = {
  _id?: Types.ObjectId;
  LCid: Types.ObjectId;
  availableDate: Date;
  availableShift: (typeof SHIFT_NAMES)[number];
  createdById?: Types.ObjectId | null;
  items: Array<
    Omit<ItemInput, "_id" | "itemId" | "farmerOrderId" | "farmerID"> & {
      _id?: Types.ObjectId;
      itemId: Types.ObjectId;
      farmerOrderId?: Types.ObjectId | null;
      farmerID: Types.ObjectId;
      status: (typeof ITEM_STATUSES)[number];
    }
  >;
};

/* ---------------- Config ---------------- */

// ✅ match your actual file name
const FIXED_JSON_PATH = path.resolve(__dirname, "../data/available-stock.data.json");

// Map LC codes to your seeded center _ids (from logistics-centers.data.json)
const LC_CODE_TO_ID: Record<string, string> = {
  "LC-1": "66e007000000000000000001", // Zarzir Logistics Center
  "LC-2": "66e007000000000000000002", // Jerusalem Logistics Center
  "LC-3": "66e007000000000000000003", // Haifa Logistics Center
};

// Fallback fields to try when LCid is a name (rare)
const LC_CODE_FIELDS_TO_TRY = ["logisticName", "location.name"] as const;

/* ---------------- Helpers ---------------- */

function assertEnum<T extends readonly string[]>(
  value: string,
  allowed: T,
  label: string
): asserts value is T[number] {
  if (!allowed.includes(value as any)) {
    throw new Error(`${label} "${value}" must be one of: ${allowed.join(", ")}`);
  }
}

function normalizeDateToUtcMidnight(d: string | Date): Date {
  if (typeof d === "string" && d.toLowerCase() === "today") {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  const date = new Date(d);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${d}`);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}


function loadJsonArrayFixed(): StockInputLoose[] {
  if (!fs.existsSync(FIXED_JSON_PATH)) {
    throw new Error(`Missing JSON at: ${FIXED_JSON_PATH}\nCreate it as a plain JSON array.`);
  }
  console.log("📄 Using stock JSON at:", FIXED_JSON_PATH);
  const raw = fs.readFileSync(FIXED_JSON_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("File must be a JSON array (no wrapper object).");

  // sanity check to avoid accidentally pointing at logistics centers file
  const first = parsed[0];
  if (first && first.logisticName && !first.LCid && !first.availableShift) {
    throw new Error(
      `You're loading logistics-centers.data.json into the stock seeder. ` +
      `Point it at available-stock.data.json instead.`
    );
  }

  return parsed as StockInputLoose[];
}

/** Accept aliases (shift/name → availableShift, logisticCenterId → LCid) and validate basics */
function normalizeStockInput(raw: StockInputLoose, idx: number): StockInput {
  const availableShift =
    (raw.availableShift as any) ??
    (raw.shift as any) ??
    (raw.name as any);

  const LCid =
    raw.LCid ??
    raw.logisticCenterId;

  if (!availableShift) {
    throw new Error(`Row ${idx}: missing "availableShift" (also checked "shift", "name").`);
  }
  if (!LCid) {
    throw new Error(`Row ${idx}: missing "LCid" (also checked "logisticCenterId").`);
  }
  if (!raw.availableDate) {
    throw new Error(`Row ${idx}: missing "availableDate".`);
  }

  const shiftClean = String(availableShift).trim().toLowerCase() as any;

  return {
    _id: raw._id,
    LCid,
    availableDate: raw.availableDate,
    availableShift: shiftClean,
    createdById: raw.createdById,
    createdAt: raw.createdAt,
    items: raw.items ?? [],
  };
}

/* ---------------- LC resolver ---------------- */

let LC_LIST_CACHE: { _id: Types.ObjectId }[] | null = null;

async function resolveLCid(value: string): Promise<Types.ObjectId> {
  if (isHex24(value)) return toObjectId(value);

  const mapped = LC_CODE_TO_ID[value];
  if (mapped) {
    if (!isHex24(mapped)) throw new Error(`LC_CODE_TO_ID["${value}"] must be 24-hex`);
    return toObjectId(mapped);
  }

  const m = /^LC-(\d+)$/.exec(value);
  if (m) {
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx < 1) throw new Error(`Invalid LC code "${value}"`);
    if (!LC_LIST_CACHE) {
      LC_LIST_CACHE = await LogisticsCenter.find({}, { _id: 1 })
        .sort({ _id: 1 })
        .lean<{ _id: Types.ObjectId }[]>()
        .exec();
    }
    const picked = LC_LIST_CACHE[idx - 1];
    if (picked?._id) return new Types.ObjectId(String(picked._id));
    throw new Error(`LC code "${value}" points to index ${idx}, but only ${LC_LIST_CACHE.length} centers exist`);
  }

  // name matches
  type LCMinimal = { _id: mongoose.Types.ObjectId | string };
  for (const field of LC_CODE_FIELDS_TO_TRY) {
    const q: any = {};
    q[field] = value;
    const doc = await LogisticsCenter.findOne(q).select("_id").lean<LCMinimal | null>().exec();
    if (doc?._id) return toObjectId(String(doc._id));
  }

  throw new Error(
    `Unable to resolve LCid "${value}" → ObjectId. Use a 24-hex id, add LC_CODE_TO_ID mapping, ` +
    `or ensure a center exists matching (${LC_CODE_FIELDS_TO_TRY.join(" | ")})`
  );
}

/* ---------------- Converters ---------------- */

function toItem(doc: ItemInput): StockToInsert["items"][number] {
  if (!isHex24(doc.itemId)) throw new Error(`itemId "${doc.itemId}" must be 24-hex`);
  if (!isHex24(doc.farmerID)) throw new Error(`farmerID "${doc.farmerID}" must be 24-hex`);

  const status = (doc.status ?? "active") as (typeof ITEM_STATUSES)[number];
  assertEnum(status, ITEM_STATUSES, "status");

  if (doc.currentAvailableQuantityKg > doc.originalCommittedQuantityKg) {
    throw new Error(
      `currentAvailableQuantityKg (${doc.currentAvailableQuantityKg}) cannot exceed originalCommittedQuantityKg (${doc.originalCommittedQuantityKg}) for "${doc.displayName}"`
    );
  }

  const out: StockToInsert["items"][number] = {
    displayName: doc.displayName,
    imageUrl: doc.imageUrl ?? null,
    category: doc.category,
    pricePerUnit: doc.pricePerUnit,
    originalCommittedQuantityKg: doc.originalCommittedQuantityKg,
    currentAvailableQuantityKg: doc.currentAvailableQuantityKg,
    farmerName: doc.farmerName,
    farmName: doc.farmName,
    status,
    itemId: toObjectId(doc.itemId),
    farmerID: toObjectId(doc.farmerID),
  };

  if (doc._id) {
    if (!isHex24(doc._id)) throw new Error(`items._id "${doc._id}" must be 24-hex if provided`);
    out._id = toObjectId(doc._id);
  }

  if (doc.farmerOrderId) {
    if (!isHex24(doc.farmerOrderId))
      throw new Error(`farmerOrderId "${doc.farmerOrderId}" must be 24-hex if provided`);
    out.farmerOrderId = toObjectId(doc.farmerOrderId);
  } else {
    out.farmerOrderId = null;
  }

  return out;
}

async function toStock(doc: StockInput): Promise<StockToInsert> {
  assertEnum(doc.availableShift, SHIFT_NAMES, "availableShift");

  const out: StockToInsert = {
    LCid: await resolveLCid(doc.LCid),
    availableDate: normalizeDateToUtcMidnight(doc.availableDate),
    availableShift: doc.availableShift,
    items: Array.isArray(doc.items) ? doc.items.map(toItem) : [],
  };

  if (doc._id) {
    if (!isHex24(doc._id)) throw new Error(`_id "${doc._id}" must be 24-hex if provided`);
    out._id = toObjectId(doc._id);
  }

  if (doc.createdById) {
    if (!isHex24(doc.createdById)) throw new Error(`createdById "${doc.createdById}" must be 24-hex if provided`);
    out.createdById = toObjectId(doc.createdById);
  } else {
    out.createdById = null;
  }

  return out;
}

/* ---------------- Public API ---------------- */

export async function seedAvailableMarketStock(options?: {
  clear?: boolean; // default true
}) {
  const shouldClear = options?.clear !== false;

  const sourceLoose = loadJsonArrayFixed();

  console.log(`🌱 Seeding AvailableMarketStock…`);

  // Normalize and validate first (fail-fast with row numbers)
  const normalizedRows: StockInput[] = [];
  for (let i = 0; i < sourceLoose.length; i++) {
    const raw = sourceLoose[i];
    try {
      normalizedRows.push(normalizeStockInput(raw, i));
    } catch (e: any) {
      console.error("❌ Bad row at index", i, "->", JSON.stringify(raw, null, 2));
      throw e;
    }
  }

  const docs: StockToInsert[] = [];
  for (let i = 0; i < normalizedRows.length; i++) {
    try {
      docs.push(await toStock(normalizedRows[i]));
    } catch (e: any) {
      console.error("❌ Failed to convert row at index", i, "->", JSON.stringify(normalizedRows[i], null, 2));
      throw e;
    }
  }

  if (shouldClear) {
    await AvailableMarketStockModel.deleteMany({});
    console.log("🧹 Cleared existing AvailableMarketStock");
  }

  if (docs.length) {
    await AvailableMarketStockModel.create(docs); // array form keeps hooks
  }

  console.log(`✅ Seeded ${docs.length} AvailableMarketStock document(s)`);
}

/* ---------------- CLI ---------------- */
//   ts-node db/seeds/dev/seedAvailableMarketStock.ts
//   ts-node db/seeds/dev/seedAvailableMarketStock.ts --keep  (to merge w/o clearing)
if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  seedAvailableMarketStock({ clear: !keep }).catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}

export default seedAvailableMarketStock;
