// src/mocks/pickerData.ts

// ── Types ─────────────────────────────────────────────────────────────────────
export type ReadyOrder = {
  id: string;
  orderId: string;
  items: number;
  readyForMin: number;
  zone: string;
  priority: "normal" | "rush";
  xpReward: number;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  coins: number;
  orders: number;
  rank: number;
};

export type Quest = {
  id: string;
  scope: "day" | "week";
  title: string;
  description: string;
  targetOrders: number;
  timeLimitMin: number;
  rewardCoins: number;
  active: boolean;
  progress: number;
};

export type InventoryLocation = {
  locationCode: string;      // e.g. "A1A1-S2-B05"
  zone: string;              // e.g. "A1A1"
  shelf: string;             // e.g. "S2"
  bin: string;               // e.g. "B05"
  coords: { x: number; y: number }; // for routing
  congestion: number;        // active pickers there
};

export type PackagePlan = {
  packageId: string;
  sizeCode: "XS" | "S" | "M" | "L" | "XL";
  targetUse: "ambient" | "chilled" | "frozen";
  maxWeightKg: number;
  volumeL: number;
  barcode: string;           // container barcode
};

export type PickItem = {
  id: string;
  name: string;
  imageUrl: string;
  packageId: string;
  status: "pending" | "at_location" | "scanned" | "substituted" | "missing" | "damaged";

  // legacy UI fields
  zone: string;
  shelf: string;
  unitsRequired: number;

  // verification + routing
  allowedLocations: string[];     // list of valid shelves
  barcodeItem: string;            // item barcode
  barcodeLocation: string;        // expected shelf/bin barcode
  required: { uom: "unit" | "kg"; qty?: number; weightKg?: number };
  picked?: { qty?: number; weightKg?: number };
};

export type PickTask = {
  id: string;
  orderId: string;
  priority: "normal" | "rush";
  packages: PackagePlan[];
  items: PickItem[];
  deliveryShelf: { row: string; bay: string };

  route: { itemId: string; locationCode: string }[];
  routeIndex: number;
  currentLocation?: string;
};

export type PickerProfile = {
  id: string;
  userId: string;
  lcId: string;
  allowedZones: string[];
  maxCartVolumeL: number;
  maxCartWeightKg: number;
  xp: number;
  level: number;
  coins: number;
  streakDays: number;
};

// ── Seed: inventory + presence ────────────────────────────────────────────────
export const inventoryLocations: InventoryLocation[] = [
  { locationCode: "A1A1-S2-B05", zone: "A1A1", shelf: "S2", bin: "B05", coords: { x: 1, y: 2 }, congestion: 1 },
  { locationCode: "A1A1-S1-B02", zone: "A1A1", shelf: "S1", bin: "B02", coords: { x: 1, y: 1 }, congestion: 0 },
  { locationCode: "2B4-S1-B03",  zone: "2B4",  shelf: "S1", bin: "B03", coords: { x: 6, y: 4 }, congestion: 2 },
  { locationCode: "A3A2-S1-B01", zone: "A3A2", shelf: "S1", bin: "B01", coords: { x: 2, y: 3 }, congestion: 0 },
  { locationCode: "C2C1-S4-B03", zone: "C2C1", shelf: "S4", bin: "B03", coords: { x: 9, y: 2 }, congestion: 1 },
  { locationCode: "B2B3-S3-B06", zone: "B2B3", shelf: "S3", bin: "B06", coords: { x: 4, y: 5 }, congestion: 0 },
];

// ── Seed: users, leaderboard, quests ─────────────────────────────────────────
export const pickers: PickerProfile[] = [
  { id: "P1", userId: "U1", lcId: "LC-01", allowedZones: ["A1A1","2B4","A3A2","B2B3","C2C1"], maxCartVolumeL: 120, maxCartWeightKg: 80, xp: 1240, level: 6, coins: 240, streakDays: 5 },
];

export const leaderboard: LeaderboardEntry[] = [
  { id: "P9", name: "Hugo",  coins: 520, orders: 182, rank: 1 },
  { id: "P1", name: "You",   coins: 260, orders: 96,  rank: 2 },
  { id: "P2", name: "Ava",   coins: 210, orders: 81,  rank: 3 },
];

export const quests: Quest[] = [
  { id: "q-day-1", scope: "day",  title: "Quest of the Day",  description: "Finish 10 orders in 20 min to win extra 10 MD coins", targetOrders: 10, timeLimitMin: 20, rewardCoins: 10,  active: false, progress: 0 },
  { id: "q-week-1", scope: "week", title: "Quest of the Week", description: "Complete 120 orders this week for +120 MD coins",       targetOrders: 120, timeLimitMin: 60*24*7, rewardCoins: 120, active: false, progress: 0 },
];

// ── Seed: available orders (shown after Start picking) ───────────────────────
export const readyOrders: ReadyOrder[] = [
  { id: "rid-1001", orderId: "#23501", items: 7,  readyForMin: 12, zone: "A1A1", priority: "rush",   xpReward: 12 },
  { id: "rid-1002", orderId: "#23502", items: 5,  readyForMin: 18, zone: "2B4",  priority: "normal", xpReward: 8  },
  { id: "rid-1003", orderId: "#23503", items: 10, readyForMin: 25, zone: "C2C1", priority: "normal", xpReward: 9  },
];

// ── Catalog (subset) ─────────────────────────────────────────────────────────
const SKUS = {
  TOMATO: { name: "Tomato",  image: "https://images.unsplash.com/photo-1546470427-0fd5b7160c97?w=640", barcode: "729000001001" },
  APPLE:  { name: "Apple",   image: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=640", barcode: "729000001002" },
  BANANA: { name: "Banana",  image: "https://images.unsplash.com/photo-1571772805064-207c8435df79?w=640", barcode: "729000001003" },
  MILK:   { name: "Milk 1L", image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=640", barcode: "729000001004" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const loc = (code: string) => inventoryLocations.find(l => l.locationCode === code)!;
const L = (a: { x:number; y:number }, b:{ x:number; y:number }) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

function score(locationCode: string, fromCode: string) {
  const a = loc(fromCode).coords;
  const b = loc(locationCode).coords;
  const congestion = loc(locationCode).congestion;
  return L(a,b) + 1.2 * congestion; // α=1.2 congestion penalty
}

// ── Builder: PickTask with packages, items, route ────────────────────────────
export function buildPickTask(orderId: string): PickTask {
  const packages: PackagePlan[] = [
    { packageId: "P1", sizeCode: "M", targetUse: "ambient", maxWeightKg: 15, volumeL: 25, barcode: "PKG-P1-0001" },
    { packageId: "P2", sizeCode: "S", targetUse: "chilled", maxWeightKg: 8,  volumeL: 12, barcode: "PKG-P2-0002" },
  ];

  const items: PickItem[] = [
    {
      id: "L1",
      name: SKUS.TOMATO.name,
      imageUrl: SKUS.TOMATO.image,
      packageId: "P1",
      status: "pending",
      zone: "A1A1", shelf: "S2", unitsRequired: 4,
      allowedLocations: ["A1A1-S2-B05"],
      barcodeItem: SKUS.TOMATO.barcode,
      barcodeLocation: "A1A1-S2-B05",
      required: { uom: "unit", qty: 4 },
    },
    {
      id: "L2",
      name: SKUS.APPLE.name,
      imageUrl: SKUS.APPLE.image,
      packageId: "P1",
      status: "pending",
      zone: "A1A1", shelf: "S1", unitsRequired: 6,
      allowedLocations: ["A1A1-S1-B02"],
      barcodeItem: SKUS.APPLE.barcode,
      barcodeLocation: "A1A1-S1-B02",
      required: { uom: "unit", qty: 6 },
    },
    {
      id: "L3",
      name: SKUS.BANANA.name,
      imageUrl: SKUS.BANANA.image,
      packageId: "P1",
      status: "pending",
      zone: "2B4", shelf: "S1", unitsRequired: 0,
      allowedLocations: ["2B4-S1-B03"],
      barcodeItem: SKUS.BANANA.barcode,
      barcodeLocation: "2B4-S1-B03",
      required: { uom: "kg", weightKg: 1.2 }, // produce by weight
    },
    {
      id: "L4",
      name: SKUS.MILK.name,
      imageUrl: SKUS.MILK.image,
      packageId: "P2",
      status: "pending",
      zone: "C2C1", shelf: "S4", unitsRequired: 2,
      allowedLocations: ["C2C1-S4-B03"],
      barcodeItem: SKUS.MILK.barcode,
      barcodeLocation: "C2C1-S4-B03",
      required: { uom: "unit", qty: 2 },
    },
  ];

  // initial route: greedy by distance + congestion from first shelf
  const start = "A1A1-S2-B05";
  const pending = items.map(i => i.barcodeLocation);
  const route: string[] = [];
  let last = start;
  while (pending.length) {
    pending.sort((a,b) => score(a, last) - score(b, last));
    const next = pending.shift()!;
    route.push(next);
    last = next;
  }

  return {
    id: `t_${orderId.replace(/[^0-9]/g, "")}`,
    orderId,
    priority: readyOrders.find(r => r.orderId === orderId)?.priority ?? "normal",
    packages,
    items,
    deliveryShelf: { row: "B", bay: "12" },
    route: items.map(i => ({ itemId: i.id, locationCode: i.barcodeLocation })).sort((a,b) => route.indexOf(a.locationCode) - route.indexOf(b.locationCode)),
    routeIndex: 0,
    currentLocation: start,
  };
}
