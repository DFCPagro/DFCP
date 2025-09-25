// src/api/fakes/farmerOrders.fake.ts
import type {
  FarmerOrderDTO,
  FarmerOrderStatus,
  Shift,
} from "@/types/farmerOrders";

/** ------------------------------
 * Config
 * ----------------------------- */
const LATENCY_MS = 400; // average latency
const ERROR_RATE = 0.04; // 4% random error to test rollbacks

/** ------------------------------
 * Small helpers (module-local only)
 * ----------------------------- */
const rng = mulberry32(0x5a17cafe); // deterministic seed for reproducible fixtures

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function chance(p: number) {
  return rng() < p;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function delay(base = LATENCY_MS) {
  const jitter = Math.floor((rng() - 0.5) * 200); // ±100ms
  return new Promise((res) => setTimeout(res, Math.max(50, base + jitter)));
}

function maybeFail() {
  if (chance(ERROR_RATE)) {
    throw new Error("Network error (simulated)");
  }
}

function fmtLocalYYYYMMDD(d: Date) {
  // format as local "YYYY-MM-DD"
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function makeId() {
  // short, URL-safe id
  return (
    Math.floor(rng() * 36 ** 6)
      .toString(36)
      .padStart(6, "0") + Math.floor(rng() * 36 ** 4).toString(36).padStart(4, "0")
  );
}

/** ------------------------------
 * Seed data
 * ----------------------------- */
const SHIFTS: Shift[] = ["morning", "afternoon", "evening", "night"];

const ITEMS = [
  { itemId: "ITM-APL", type: "Apple", variety: "Gala" },
  { itemId: "ITM-APL2", type: "Apple", variety: "Granny Smith" },
  { itemId: "ITM-TMT", type: "Tomato", variety: "Cherry" },
  { itemId: "ITM-CUC", type: "Cucumber", variety: "Slicer" },
  { itemId: "ITM-ORN", type: "Orange", variety: "Navel" },
  { itemId: "ITM-BAN", type: "Banana", variety: "Cavendish" },
];

type InternalOrder = FarmerOrderDTO & {
  _notes?: { at: string; note: string }[]; // for reject audit (not displayed in dashboard)
};

const store: {
  byId: Map<string, InternalOrder>;
} = {
  byId: new Map(),
};

function seedOnce() {
  if (store.byId.size > 0) return;

  const today = new Date();
  // Pending: a few orders in the next 1–3 days, varied shifts
  for (let i = 0; i < 7; i++) {
    const item = pick(ITEMS);
    const shift = pick(SHIFTS);
    const date = fmtLocalYYYYMMDD(addDays(today, 1 + Math.floor(rng() * 3)));
    const forcastedQuantityKg = Math.max(5, Math.round(rng() * 80)); // 5..80
    const id = makeId();

    const row: InternalOrder = {
      id,
      itemId: item.itemId,
      type: item.type,
      variety: item.variety,
      pictureUrl: null,
      farmerStatus: "pending",
      forcastedQuantityKg, // exact spelling as requested
      finalQuantityKg: null,
      pickUpDate: date,
      shift,
    };
    store.byId.set(id, row);
  }

  // Accepted (ok): some groups across the next 1–5 days
  for (let i = 0; i < 10; i++) {
    const item = pick(ITEMS);
    const shift = pick(SHIFTS);
    const date = fmtLocalYYYYMMDD(addDays(today, 1 + Math.floor(rng() * 5)));
    const hasFinal = chance(0.6);
    const base = Math.max(5, Math.round(rng() * 60));
    const finalQuantityKg = hasFinal ? base : null;
    const forcastedQuantityKg = hasFinal ? Math.max(4, base + (chance(0.5) ? -3 : 3)) : base;

    const id = makeId();
    const row: InternalOrder = {
      id,
      itemId: item.itemId,
      type: item.type,
      variety: item.variety,
      pictureUrl: null,
      farmerStatus: "ok",
      forcastedQuantityKg,
      finalQuantityKg,
      pickUpDate: date,
      shift,
    };
    store.byId.set(id, row);
  }
}

seedOnce();

/** ------------------------------
 * Public API (mirrors the facade contract)
 * ----------------------------- */

export type ListFarmerOrdersParams = {
  farmerStatus?: Extract<FarmerOrderStatus, "pending" | "ok">;
  from?: string; // "YYYY-MM-DD"
  to?: string;   // "YYYY-MM-DD"
};

export async function listFarmerOrders(
  params?: ListFarmerOrdersParams
): Promise<FarmerOrderDTO[]> {
  await delay();
  maybeFail();

  const { farmerStatus, from, to } = params ?? {};
  const result: FarmerOrderDTO[] = [];

  store.byId.forEach((row) => {
    if (farmerStatus && row.farmerStatus !== farmerStatus) return;

    if (from && row.pickUpDate < from) return;
    if (to && row.pickUpDate > to) return;

    result.push({ ...row });
  });

  // Sort by date asc, then shift order
  const shiftIndex = new Map<Shift, number>([
    ["morning", 0],
    ["afternoon", 1],
    ["evening", 2],
    ["night", 3],
  ]);

  result.sort((a, b) => {
    if (a.pickUpDate !== b.pickUpDate) return a.pickUpDate < b.pickUpDate ? -1 : 1;
    return (shiftIndex.get(a.shift) ?? 0) - (shiftIndex.get(b.shift) ?? 0);
  });

  return result;
}

export async function acceptFarmerOrder(orderId: string): Promise<void> {
  if (!orderId) throw new Error("orderId is required");
  await delay();
  maybeFail();

  const row = store.byId.get(orderId);
  if (!row) throw new Error("Order not found");
  if (row.farmerStatus !== "pending") {
    // idempotent-ish behavior: if already ok, just return
    if (row.farmerStatus === "ok") return;
    throw new Error(`Cannot accept order with status "${row.farmerStatus}"`);
  }

  row.farmerStatus = "ok";
  // Keep quantities/dates/shifts as-is; final may still be null (to be set later downstream)
  store.byId.set(orderId, { ...row });
}

export async function rejectFarmerOrder(orderId: string, note: string): Promise<void> {
  if (!orderId) throw new Error("orderId is required");
  if (!note?.trim()) throw new Error("A non-empty note is required for rejection");

  await delay();
  maybeFail();

  const row = store.byId.get(orderId);
  if (!row) throw new Error("Order not found");
  if (row.farmerStatus !== "pending") {
    // if already problem, treat as idempotent; otherwise block
    if (row.farmerStatus === "problem") return;
    throw new Error(`Cannot reject order with status "${row.farmerStatus}"`);
  }

  const now = new Date();
  const at = `${fmtLocalYYYYMMDD(now)} ${now.toTimeString().slice(0, 8)}`;
  const updated: InternalOrder = {
    ...row,
    farmerStatus: "problem",
    _notes: [...(row._notes ?? []), { at, note: note.trim() }],
  };

  // In the dashboard we don't show "problem" orders; they stop appearing in "pending"
  store.byId.set(orderId, updated);
}
