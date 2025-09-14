/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import mongoose, { Types } from "mongoose";
import { faker } from "@faker-js/faker";

import OrderModel, { ORDER_STATUSES, OrderStatus } from "../../../src/models/order.model";
import ItemModel from "../../../src/models/Item.model";
import UserModel from "../../../src/models/user.model";

/* --------------------------------- Types --------------------------------- */
// You can reference users in static JSON by any of these:
type UserRef = {
  customerId?: string;                // 24-hex
  customerEmail?: string;             // user email
  customerUid?: string;               // your stable uid (e.g., "CNS-1")
  assignedDelivererId?: string | null;
  assignedDelivererEmail?: string;
  assignedDelivererUid?: string;
};

type AddressJSON = {
  // Flexible input — we normalize to { address, alt, lnt }
  address?: string;
  alt?: number;
  lnt?: number;
  line1?: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type ItemRowJSON = {
  itemId: string; // Item._id (string)
  name: string;
  imageUrl?: string | null;
  pricePerUnit: number;
  quantity: number;
  category?: string | null;
  sourceFarmerName: string;
  sourceFarmName: string;
  farmerOrderId: string; // 24-hex
};

type AuditRowJSON =
  | string
  | {
      message?: string;
      at?: string | Date;
      by?: string | null;  // userId string (optional; we’ll default to customer)
      action?: string;
      note?: string;
      meta?: any;
    };

type OrderRowJSON = UserRef & {
  _id?: string;                     // optional fixed id for Order
  deliveryAddress: AddressJSON;
  items: ItemRowJSON[];
  status?: OrderStatus;
  customerDeliveryId?: string | null;
  historyAuditTrail?: AuditRowJSON[];
};

/* --------------------------------- Config -------------------------------- */
const DEFAULT_DATA_FILE = path.resolve(__dirname, "../data/orders.data.json");

/* ------------------------------- Utilities ------------------------------- */
const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

function requireArrayJSON<T = any>(p: string): T[] {
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf-8");
  const val = JSON.parse(raw);
  if (!Array.isArray(val)) throw new Error(`${p} must be a JSON array`);
  return val as T[];
}

function cents(n: number) { return Math.round(n * 100) / 100; }

function normalizeAddress(src: AddressJSON): any {
  const address =
    src.address ||
    src.line1 ||
    [src.line1, src.city, src.country].filter(Boolean).join(", ") ||
    "Unknown";
  const alt = typeof src.alt === "number" ? src.alt : Number(faker.location.latitude());
  const lnt = typeof src.lnt === "number" ? src.lnt : Number(faker.location.longitude());
  return {
    address, alt, lnt,
    line1: src.line1 ?? null,
    line2: src.line2 ?? null,
    city: src.city ?? null,
    state: src.state ?? null,
    postalCode: src.postalCode ?? null,
    country: src.country ?? null,
  };
}

function toAudit(entries: AuditRowJSON[] | undefined, defaultUserId: Types.ObjectId) {
  if (!entries || !entries.length) {
    return [{ userId: defaultUserId, action: "note", note: "Seeded order", meta: {}, timestamp: new Date() }];
  }
  return entries.map((e) => {
    if (typeof e === "string") {
      return { userId: defaultUserId, action: "note", note: e, meta: {}, timestamp: new Date() };
    }
    const at = e.at instanceof Date ? e.at : e.at ? new Date(e.at) : new Date();
    const by = e.by && isHex24(e.by) ? new mongoose.Types.ObjectId(e.by) : defaultUserId;
    return {
      userId: by,
      action: e.action || "note",
      note: e.note || e.message || "",
      meta: e.meta ?? {},
      timestamp: at,
    };
  });
}

/* ------------------------ DB lookups (STRICT) ---------------------------- */
async function findUserIdOrThrow(query: any, purpose: string): Promise<Types.ObjectId> {
  const user = await UserModel.findOne(query).select({ _id: 1 }).lean();
  if (!user?._id) throw new Error(`No User found for ${purpose}: ${JSON.stringify(query)}`);
  return user._id as Types.ObjectId;
}

async function resolveCustomer(row: UserRef): Promise<Types.ObjectId> {
  if (row.customerId) {
    if (!isHex24(row.customerId)) throw new Error(`customerId must be 24-hex, got: ${row.customerId}`);
    const exists = await UserModel.exists({ _id: new Types.ObjectId(row.customerId), role: "customer" });
    if (!exists) throw new Error(`customerId does not reference an existing customer: ${row.customerId}`);
    return new Types.ObjectId(row.customerId);
  }
  if (row.customerEmail) {
    return findUserIdOrThrow({ email: String(row.customerEmail).toLowerCase(), role: "customer" }, "customerEmail");
  }
  if (row.customerUid) {
    return findUserIdOrThrow({ uid: row.customerUid, role: "customer" }, "customerUid");
  }
  throw new Error("Static order missing customer reference (need customerId | customerEmail | customerUid).");
}

async function resolveDeliverer(row: UserRef, required: boolean): Promise<Types.ObjectId | null> {
  // If provided explicitly, validate it
  if (row.assignedDelivererId) {
    if (!isHex24(row.assignedDelivererId))
      throw new Error(`assignedDelivererId must be 24-hex, got: ${row.assignedDelivererId}`);
    const exists = await UserModel.exists({
      _id: new Types.ObjectId(row.assignedDelivererId),
      role: { $in: ["deliverer", "industrialDeliverer"] },
    });
    if (!exists) throw new Error(`assignedDelivererId is not an existing deliverer: ${row.assignedDelivererId}`);
    return new Types.ObjectId(row.assignedDelivererId);
  }
  if (row.assignedDelivererEmail) {
    return findUserIdOrThrow(
      { email: String(row.assignedDelivererEmail).toLowerCase(), role: { $in: ["deliverer", "industrialDeliverer"] } },
      "assignedDelivererEmail"
    );
  }
  if (row.assignedDelivererUid) {
    return findUserIdOrThrow(
      { uid: row.assignedDelivererUid, role: { $in: ["deliverer", "industrialDeliverer"] } },
      "assignedDelivererUid"
    );
  }
  if (required) throw new Error("Order status requires a deliverer but none was provided/resolvable.");
  return null;
}

/* ------------------------ Random item/order builders ---------------------- */
async function buildRandomOrderItem(): Promise<ItemRowJSON> {
  const count = await ItemModel.countDocuments();
  let itemDoc: any = null;
  if (count > 0) {
    const skip = Math.floor(Math.random() * count);
    itemDoc = await ItemModel.findOne().skip(skip).lean();
  }
  if (!itemDoc) {
    const type = faker.helpers.arrayElement(["Apple","Banana","Orange","Tomato","Cucumber","Lettuce","Spinach","Strawberry","Grapes","Carrot"]);
    const variety = faker.helpers.arrayElement([null,"Fuji","Cavendish","Navel","Cherry","Persian","Romaine","Baby","Albion","Nantes","Red Globe",""]);
    const name = [type, variety].filter(Boolean).join(" ").trim();
    return {
      itemId: faker.string.alphanumeric(12).toLowerCase(),
      name: name || type,
      imageUrl: null,
      pricePerUnit: cents(faker.number.float({ min: 1, max: 20 })),
      quantity: cents(faker.number.float({ min: 0.3, max: 3.5 })),
      category: faker.helpers.arrayElement(["fruit","vegetable"]),
      sourceFarmerName: faker.person.firstName(),
      sourceFarmName: `${faker.word.adjective()} ${faker.word.noun()}`.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase()),
      farmerOrderId: new Types.ObjectId().toHexString(),
    };
  }
  const itemName = itemDoc.name ?? [itemDoc.type, itemDoc.variety].filter(Boolean).join(" ").trim();
  const price = itemDoc.price?.a ?? itemDoc.price?.b ?? itemDoc.price?.c ?? faker.number.float({ min: 1, max: 20 });
  return {
    itemId: String(itemDoc._id),
    name: itemName || itemDoc.type,
    imageUrl: itemDoc.imageUrl ?? null,
    pricePerUnit: cents(price),
    quantity: cents(faker.number.float({ min: 0.3, max: 3.5 })),
    category: itemDoc.category ?? null,
    sourceFarmerName: faker.person.firstName(),
    sourceFarmName: `${faker.word.adjective()} ${faker.word.noun()}`.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase()),
    farmerOrderId: new Types.ObjectId().toHexString(),
  };
}

async function buildRandomOrderRow(): Promise<OrderRowJSON> {
  const itemsCount = faker.number.int({ min: 1, max: 5 });
  const items: ItemRowJSON[] = [];
  for (let i = 0; i < itemsCount; i++) items.push(await buildRandomOrderItem());

  const status: OrderStatus = faker.helpers.arrayElement(ORDER_STATUSES as unknown as OrderStatus[]);
  return {
    // NOTE: random mode no longer invents customer ids; it requires an existing customer (we pick below)
    deliveryAddress: { line1: faker.location.streetAddress(), city: faker.location.city(), country: faker.location.countryCode() },
    items,
    status,
    historyAuditTrail: [{ action: "create", message: "Order created" }, ...(status !== "pending" ? [{ action: "status_change", message: `Moved to ${status}` }] : [])],
  };
}

/* ----------------------------- Main seeder ----------------------------- */
export async function seedOrders(options?: {
  random?: number;         // how many random orders to create
  clear?: boolean;         // default true
  file?: string;           // path to static orders json
  dry?: boolean;           // don’t insert, just validate
}) {
  const randomCount = Number.isFinite(options?.random) ? Number(options!.random) : 0;
  const shouldClear = options?.clear !== false;
  const filePath = options?.file || DEFAULT_DATA_FILE;
  const dryRun = !!options?.dry;

  // Pools (strict): fetch real users by role
  const customers = await UserModel.find({ role: "customer" }).select("_id email uid").lean();
  const couriers = await UserModel.find({ role: { $in: ["deliverer","industrialDeliverer"] } }).select("_id email uid").lean();

  if (!customers.length) throw new Error("No customers in DB. Seed users first.");
  // couriers can be empty; only required when status needs one

  // Load static rows
  const staticRows = requireArrayJSON<OrderRowJSON>(filePath);
  console.log(`📄 Loaded static orders: ${staticRows.length}`);

  // Build random rows (without users yet; we’ll attach below)
  const randomRows: OrderRowJSON[] = [];
  for (let i = 0; i < randomCount; i++) randomRows.push(await buildRandomOrderRow());

  // Helper to randomly pick a real user
  const pickCustomerId = () => (customers[Math.floor(Math.random() * customers.length)]._id as Types.ObjectId);
  const pickCourierId = () =>
    couriers.length ? (couriers[Math.floor(Math.random() * couriers.length)]._id as Types.ObjectId) : null;

  // Normalize & resolve users STRICTLY
  const toInsert = [] as any[];

  // 1) Static rows — must resolve to real users
  for (const row of staticRows) {
    const status: OrderStatus =
      row.status && (ORDER_STATUSES as readonly string[]).includes(row.status) ? row.status : "pending";

    const customerId = await resolveCustomer(row); // throws if not resolvable/real

    const needsDeliverer = ["ready","out_for_delivery","delivered"].includes(status);
    const assignedDelivererId = await resolveDeliverer(row, needsDeliverer); // throws if needed & missing

    const deliveryAddress = normalizeAddress(row.deliveryAddress || {});
    const items = (row.items || []).map((it) => ({
      itemId: it.itemId,
      name: it.name,
      imageUrl: it.imageUrl ?? "",
      pricePerUnit: Number(it.pricePerUnit) || 0,
      quantity: Number(it.quantity) || 0,
      category: it.category ?? "",
      sourceFarmerName: it.sourceFarmerName,
      sourceFarmName: it.sourceFarmName,
      farmerOrderId: new Types.ObjectId(isHex24(it.farmerOrderId) ? it.farmerOrderId : undefined),
    }));

    if (!items.length) throw new Error("Static order must include at least one item.");

    const doc = {
      ...(row._id && isHex24(row._id) ? { _id: new Types.ObjectId(row._id) } : {}),
      customerId,
      deliveryAddress,
      items,
      status,
      assignedDelivererId,
      customerDeliveryId: row.customerDeliveryId && isHex24(row.customerDeliveryId) ? new Types.ObjectId(row.customerDeliveryId) : null,
      historyAuditTrail: toAudit(row.historyAuditTrail, customerId),
    };
    toInsert.push(doc);
  }

  // 2) Random rows — attach real users from pools
  for (const row of randomRows) {
    const status: OrderStatus =
      row.status && (ORDER_STATUSES as readonly string[]).includes(row.status) ? row.status : "pending";
    const customerId = pickCustomerId();

    const needsDeliverer = ["ready","out_for_delivery","delivered"].includes(status);
    const assignedDelivererId = needsDeliverer ? pickCourierId() : null;
    if (needsDeliverer && !assignedDelivererId) {
      // If you require a deliverer for these statuses, throw; otherwise, allow null:
      // throw new Error("Random order requires deliverer but no couriers exist.");
      console.warn("ℹ️ Random order status needs deliverer but none exist; leaving unassigned.");
    }

    const deliveryAddress = normalizeAddress(row.deliveryAddress || {});

    const items = (row.items || []).map((it) => ({
      itemId: it.itemId,
      name: it.name,
      imageUrl: it.imageUrl ?? "",
      pricePerUnit: Number(it.pricePerUnit) || 0,
      quantity: Number(it.quantity) || 0,
      category: it.category ?? "",
      sourceFarmerName: it.sourceFarmerName,
      sourceFarmName: it.sourceFarmName,
      farmerOrderId: new Types.ObjectId(isHex24(it.farmerOrderId) ? it.farmerOrderId : undefined),
    }));

    const doc = {
      customerId,
      deliveryAddress,
      items,
      status,
      assignedDelivererId,
      customerDeliveryId: null,
      historyAuditTrail: toAudit(row.historyAuditTrail, customerId),
    };
    toInsert.push(doc);
  }

  if (!toInsert.length) {
    console.warn("⚠ No orders to insert (static empty & random=0).");
    return;
  }

  // Pre-validate to surface schema issues (also runs recalcTotals)
  const validDocs: any[] = [];
  const errors: { i: number; err: any }[] = [];
  for (let i = 0; i < toInsert.length; i++) {
    try {
      const doc = new OrderModel(toInsert[i]);
      await doc.validate();
      validDocs.push(doc.toObject());
    } catch (err) {
      errors.push({ i, err });
    }
  }

  console.log(`🧪 Pre-validated ${toInsert.length} order(s). Valid: ${validDocs.length}, Invalid: ${errors.length}`);
  if (errors.length) {
    for (const { i, err } of errors.slice(0, 20)) {
      console.error(`❌ Doc #${i} validation error:`, (err as any)?.message || err);
    }
    if (errors.length > 20) console.error(`…and ${errors.length - 20} more errors`);
  }

  if (dryRun) {
    console.log("💧 --dry mode (not inserting). Example doc:");
    console.dir(validDocs[0], { depth: 6 });
    return;
  }
  if (!validDocs.length) {
    console.warn("⚠ No valid orders to insert. Aborting.");
    return;
  }

  if (shouldClear) {
    await OrderModel.deleteMany({});
    console.log("🧹 Cleared existing orders");
  }

  const result = await OrderModel.insertMany(validDocs, { ordered: false });
  console.log(`✅ Inserted ${result.length} order(s)`);
}

/* ---------------------------------- CLI ---------------------------------- */
// Usage examples:
//   ts-node db/seeds/dev/orders.seed.ts
//   ts-node db/seeds/dev/orders.seed.ts --random 10
//   ts-node db/seeds/dev/orders.seed.ts --keep
//   ts-node db/seeds/dev/orders.seed.ts --dry
//   ts-node db/seeds/dev/orders.seed.ts --file ./db/seeds/data/orders.data.json
if (require.main === module) {
  (async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/dev";
        await mongoose.connect(uri);
        console.log("🔗 Connected to MongoDB");
      }
      const args = process.argv.slice(2);
      const randomIdx = args.indexOf("--random");
      const random = randomIdx !== -1 && args[randomIdx + 1] ? Number(args[randomIdx + 1]) : 0;
      const keep = args.includes("--keep");
      const dry = args.includes("--dry");
      const fileIdx = args.indexOf("--file");
      const file = fileIdx !== -1 && args[fileIdx + 1] ? path.resolve(process.cwd(), args[fileIdx + 1]) : undefined;

      await seedOrders({ random, clear: !keep, file, dry });

      await mongoose.disconnect();
      console.log("⚠  MongoDB disconnected");
      console.log("✅ All done");
      process.exit(0);
    } catch (err) {
      console.error("❌ Seeding orders failed:", err);
      try { await mongoose.disconnect(); } catch {}
      process.exit(1);
    }
  })();
}

export default seedOrders;
