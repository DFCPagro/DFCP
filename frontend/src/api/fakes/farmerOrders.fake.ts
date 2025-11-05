// src/api/fakes/farmerOrders.fake.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type ShiftFarmerOrderItem,
  type FarmerOrderStageKey,
  FARMER_ORDER_STAGES,
  FARMER_ORDER_STAGE_KEYS,
} from "@/types/farmerOrders";

// If you have this type exported on FE, use it. Otherwise, adjust the fields you need on the card.
export type ShiftName = "morning" | "afternoon" | "evening" | "night";

// Keep in sync with your screenshot type
export type ShiftRollup = {
  date?: string;
  shiftName?: ShiftName;
  count?: number;
  problemCount?: number;
  okFO?: number; // farmer orders ok
  pendingFO?: number;
  problemFO?: number;
  okFarmers?: number;
  pendingFarmers?: number;
  problemFarmers?: number;
};

/* --------------------------------- Helpers -------------------------------- */

const OID_CHARS = "abcdef0123456789";
function newId(seed = 0): string {
  // Not cryptographically random; deterministic enough for dev fakes.
  let s = "";
  for (let i = 0; i < 24; i++) {
    // simple LCG variation to keep deterministic variety
    seed = (seed * 1664525 + 1013904223) >>> 0;
    s += OID_CHARS[seed % OID_CHARS.length];
  }
  return s;
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Build a default stages array using FARMER_ORDER_STAGES and mark one stage current.
type StageStatus = "pending" | "ok" | "problem" | "current" | "done";

function buildStages(currentKey: FarmerOrderStageKey): {
  stageKey: FarmerOrderStageKey;
  stages: Array<{
    key: FarmerOrderStageKey;
    label: string;
    status: StageStatus;
    expectedAt: Date;
    startedAt: Date;
    completedAt: Date;
    timestamp: Date;
    note?: string;
  }>;
} {
  const now = new Date();

  const stages = FARMER_ORDER_STAGES.map((s) => {
    const isCurrent = s.key === currentKey;
    const isBefore =
      FARMER_ORDER_STAGE_KEYS.indexOf(s.key as any) <
      FARMER_ORDER_STAGE_KEYS.indexOf(currentKey as any);

    // Force literal-union typing for status (not a generic string)
    const status: StageStatus = isCurrent
      ? "current"
      : isBefore
        ? "done"
        : "pending";

    // The expected type requires Date (non-null). Use sensible placeholders.
    const expectedAt = now; // or derive per stage if you want
    const startedAt = isBefore || isCurrent ? now : now; // keep as Date
    const completedAt = isBefore ? now : now; // keep as Date
    const timestamp = now;

    return {
      key: s.key as FarmerOrderStageKey,
      label: s.label,
      status,
      expectedAt,
      startedAt,
      completedAt,
      timestamp,
      note: isCurrent
        ? "In progress"
        : isBefore
          ? "Auto-completed for fake"
          : "",
    };
  });

  return { stageKey: currentKey, stages };
}

/* ------------------------------- Canonical 12 ------------------------------ */

type SeedInput = {
  idx: number;
  date: string;
  shift: ShiftName;
};

function makeCanonicalOrder({
  idx,
  date,
  shift,
}: SeedInput): ShiftFarmerOrderItem {
  const seed = hashString(`${date}-${shift}-${idx}`);
  const itemCatalog = [
    {
      type: "Tomato",
      variety: "Cherry",
      pictureUrl: "/img/items/tomato-cherry.jpg",
    },
    {
      type: "Cucumber",
      variety: "Persian",
      pictureUrl: "/img/items/cucumber.jpg",
    },
    { type: "Pepper", variety: "Red", pictureUrl: "/img/items/pepper-red.jpg" },
    { type: "Potato", variety: "Golden", pictureUrl: "/img/items/potato.jpg" },
    { type: "Onion", variety: "Yellow", pictureUrl: "/img/items/onion.jpg" },
    { type: "Carrot", variety: "Nantes", pictureUrl: "/img/items/carrot.jpg" },
    { type: "Apple", variety: "Gala", pictureUrl: "/img/items/apple.jpg" },
    { type: "Orange", variety: "Navel", pictureUrl: "/img/items/orange.jpg" },
    {
      type: "Lettuce",
      variety: "Romaine",
      pictureUrl: "/img/items/lettuce.jpg",
    },
    {
      type: "Zucchini",
      variety: "Dark Green",
      pictureUrl: "/img/items/zucchini.jpg",
    },
    {
      type: "Eggplant",
      variety: "Classic",
      pictureUrl: "/img/items/eggplant.jpg",
    },
    {
      type: "Grapes",
      variety: "Red Seedless",
      pictureUrl: "/img/items/grapes.jpg",
    },
  ];

  const ic = itemCatalog[idx % itemCatalog.length];

  // Quantities
  const ordered = 200 + (seed % 400); // 200–599 kg
  const final = Math.round(ordered * 1.02 * 100) / 100; // +2%
  const orders = Array.from({ length: 4 }, (_v, i) => ({
    orderId: newId(seed + i * 13),
    allocatedQuantityKg:
      Math.round((ordered / 4 + ((seed >> (i + 1)) % 10)) * 100) / 100,
  }));

  // Choose a believable current stage a few steps in
  const stageIdx = Math.min(
    Math.max(2, (seed % FARMER_ORDER_STAGE_KEYS.length) - 1),
    FARMER_ORDER_STAGE_KEYS.length - 2
  );
  const currentKey = FARMER_ORDER_STAGE_KEYS[stageIdx] as FarmerOrderStageKey;
  const { stageKey, stages } = buildStages(currentKey);

  return {
    // Mongo-like identity
    _id: newId(seed),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // relations / identity
    itemId: newId(seed + 1),
    type: ic.type,
    variety: ic.variety,
    pictureUrl: ic.pictureUrl,

    farmerId: newId(seed + 2),
    farmerName: `Farmer ${String.fromCharCode(65 + (idx % 26))}`,
    farmName: `Farm ${(idx % 7) + 1}`,

    // logistics
    shift,
    pickUpDate: date,
    logisticCenterId: newId(seed + 3),

    // approval
    farmerStatus: "ok",

    // demand & quantities
    sumOrderedQuantityKg: ordered,
    orderedQuantityKg: ordered, // alias, if FE expects it
    forcastedQuantityKg: ordered, // keep original spelling from BE; alias on FE if needed
    forecastedQuantityKg: ordered, // friendly alias (many FE types expose this)
    finalQuantityKg: final,

    // linked customer orders
    orders,

    // containers (we keep empty in fake)
    containers: [],
    containerSnapshots: [],

    // stages
    stageKey,
    stages,

    // QS / inspection
    farmersQSreport: undefined,
    inspectionQSreport: undefined,
    visualInspection: { status: "ok" },
    inspectionStatus: "passed",

    // audit
    historyAuditTrail: [
      {
        userId: newId(seed + 4),
        action: "CREATE",
        note: "Fake seed create",
        meta: { source: "fake" },
        timestamp: new Date().toISOString(),
      },
      {
        userId: newId(seed + 5),
        action: "STAGE_SET_CURRENT",
        note: `Now at ${stageKey}`,
        meta: { key: stageKey },
        timestamp: new Date().toISOString(),
      },
    ],
  } as unknown as ShiftFarmerOrderItem;
}

// The canonical set of 12 — we materialize for a “reference” day/shift, but
// they’re generic and reusable across any day/shift selection logic.
export function getCanonicalFakeFarmerOrders(): ShiftFarmerOrderItem[] {
  // Reference date/shift only to create deterministic ids; they won’t be displayed from here.
  const refDate = "2025-01-01";
  const refShift: ShiftName = "morning";
  return Array.from({ length: 12 }, (_v, idx) =>
    makeCanonicalOrder({ idx, date: refDate, shift: refShift })
  );
}

/* -------------------------- Selection & Rollups --------------------------- */

/**
 * Deterministically pick N orders from the canonical 12 for a given (date, shiftName).
 * N is clamped to [8, 12].
 */
export function pickFakeOrders(
  date: string,
  shiftName: ShiftName,
  fakeNum = 12
): ShiftFarmerOrderItem[] {
  const N = Math.max(8, Math.min(12, Math.floor(fakeNum)));
  const base = getCanonicalFakeFarmerOrders();

  // Re-stamp date/shift on clones so they match the requested shift.
  const stamp = (o: ShiftFarmerOrderItem): ShiftFarmerOrderItem => ({
    ...o,
    pickUpDate: date,
    shift: shiftName,
  });

  // Deterministic shuffle by (date+shift)
  const h = hashString(`${date}|${shiftName}`);
  const shuffled = base
    .map((o, i) => ({ o, k: hashString(`${h}-${i}`) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map((x) => stamp(x.o));

  return shuffled.slice(0, N);
}

/**
 * Build a rollup compatible with your ShiftStatsCard-like row.
 * For now all are "ok" (as per your spec), but fields exist for later.
 */
export function buildShiftRollup(
  date: string,
  shiftName: ShiftName,
  orders: ShiftFarmerOrderItem[]
): ShiftRollup {
  const count = orders.length;
  const okFO = count; // all ok for the fake phase
  return {
    date,
    shiftName,
    count,
    okFO,
    pendingFO: 0,
    problemFO: 0,
    problemCount: 0,
    okFarmers: okFO, // simplistic: 1:1
    pendingFarmers: 0,
    problemFarmers: 0,
  };
}

/* ----------------------------- Convenience API ---------------------------- */

/**
 * High-level helper you can use immediately in the page or in a hook.
 * Returns both the orders and the summary for a single (date, shift).
 */
export function getFakeByShift(params: {
  date: string;
  shiftName: ShiftName;
  fakeNum?: number;
}): {
  date: string;
  shiftName: ShiftName;
  orders: ShiftFarmerOrderItem[];
  rollup: ShiftRollup;
} {
  const orders = pickFakeOrders(
    params.date,
    params.shiftName,
    params.fakeNum ?? 12
  );
  const rollup = buildShiftRollup(params.date, params.shiftName, orders);
  return { date: params.date, shiftName: params.shiftName, orders, rollup };
}
