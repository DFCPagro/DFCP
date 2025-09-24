// src/api/fake/farmerSectionHarvest.ts

export type HarvestShift = "morning" | "afternoon" | "evening" | "night";
export const SHIFTS: HarvestShift[] = ["morning", "afternoon", "evening", "night"];

/** One (date, shift) measurement recorded as kg/m² */
export type HistoryPoint = {
  date: string;                // ISO date yyyy-mm-dd
  shift: HarvestShift;
  harvestedKgPerM2: number;    // normalized to section area
};

export interface FarmerSectionHarvestRecord {
  id: string;
  sectionId: string;
  itemId: string;
  itemName: string;
  areaM2: number;
  history: HistoryPoint[];
  fallback?: {
    expectedHarvestKg?: number;
    plantedAmount?: number;
    expectedFruitingPerPlant?: number;
  };
  farmerId?: string;
  logisticCenterId?: string;
}

/* ---------------- helpers ---------------- */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** tiny deterministic PRNG (xorshift-like) so “randomness” is stable between reloads */
function seedHash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function prngFactory(seedStr: string) {
  let s = seedHash(seedStr) || 1;
  return () => {
    // xorshift32
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    // 0..1
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Trend shapes as multiplicative factors over [0..days-1].
 * All shapes are centered around 1.0 with +/- amplitude.
 */
type TrendPattern = "up" | "down" | "bow" | "hump" | "flat";
function trendFactor(pattern: TrendPattern, idx: number, n: number, amplitude = 0.18) {
  if (n <= 1) return 1;
  const t = idx / (n - 1); // 0..1
  switch (pattern) {
    case "up":   return 1 - amplitude/2 + amplitude * t;        // ~0.91 → ~1.09
    case "down": return 1 + amplitude/2 - amplitude * t;        // ~1.09 → ~0.91
    case "bow": {
      // U shape: max at ends, min in middle: 1 - A + 4A*(t-0.5)^2 (range ~0.82..1.18)
      const tt = t - 0.5;
      return 1 - amplitude + 4 * amplitude * (tt * tt);
    }
    case "hump": {
      // ∩ shape: min at ends, max in middle: 1 + A - 4A*(t-0.5)^2
      const tt = t - 0.5;
      return 1 + amplitude - 4 * amplitude * (tt * tt);
    }
    default:
    case "flat": return 1;
  }
}

/**
 * Weekly seasonality factor (Mon..Sun = 1..7): small sine wave around 1.0.
 */
function weeklySeasonalityFactor(dateISO: string, seasonalityPct = 0.05) {
  const d = new Date(dateISO + "T00:00:00Z");
  // JS getUTCDay(): 0=Sun..6=Sat → map to 1..7
  const dow = ((d.getUTCDay() + 6) % 7) + 1;
  const phase = (2 * Math.PI * dow) / 7;
  return 1 + seasonalityPct * Math.sin(phase);
}

/**
 * Build continuous daily history for N days back from `startDate` (inclusive),
 * filling four shifts per day. Adds a trend, weekly seasonality and seeded noise.
 *
 * - perShiftKgPerM2: base kg/m² per shift (object with some/all of the four shifts)
 * - options:
 *    pattern: "up" | "down" | "bow" | "hump" | "flat"
 *    noisePct: random noise amplitude (default 6%)
 *    seasonalityPct: weekly sine amplitude (default 4%)
 *    seed: unique seed for deterministic randomness
 */
function makeHistoryTrend(
  startDateISO: string,
  days: number,
  perShiftKgPerM2: Partial<Record<HarvestShift, number>>,
  options?: {
    pattern?: TrendPattern;
    noisePct?: number;
    seasonalityPct?: number;
    seed?: string;
    amplitude?: number; // strength of the trend curve (default 0.18)
  }
): HistoryPoint[] {
  const {
    pattern = "flat",
    noisePct = 0.06,
    seasonalityPct = 0.04,
    seed = "default-seed",
    amplitude = 0.18,
  } = options || {};

  const rand = prngFactory(`${seed}:${pattern}:${days}`);
  const start = new Date(startDateISO + "T00:00:00Z");
  const out: HistoryPoint[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    const date = ymd(d);

    const tFactor = trendFactor(pattern, i, days, amplitude);
    const sFactor = weeklySeasonalityFactor(date, seasonalityPct);

    for (const shift of SHIFTS) {
      const base = perShiftKgPerM2[shift] ?? 0;
      // noise in [-noisePct, +noisePct]
      const noise = (rand() * 2 - 1) * noisePct;
      const val = Math.max(0, base * tFactor * sFactor * (1 + noise));
      out.push({ date, shift, harvestedKgPerM2: Number(val.toFixed(3)) });
    }
  }
  return out;
}

/* ---------------- dataset ---------------- */

// Anchor date so demo looks fresh
const TODAY = "2025-09-23";

/**
 * FAKE DATASET
 * - 3 items with multiple sections
 * - Each record gets a different trend pattern so the forecast isn’t flat:
 *    Tomato S1:  up (ramping)
 *    Tomato S2:  hump (∩)
 *    Cucumber S3: down (cooling off)
 *    Cucumber S4: bow (U)
 *    Pepper S5:  flat (small variance + seasonality)
 *    Pepper S6:  up (milder)
 */
export const FAKE_FARMER_SECTION_HARVEST: FarmerSectionHarvestRecord[] = [
  // --- Tomatoes ---
  {
    id: "H-S1-TOM",
    sectionId: "S1",
    itemId: "item_tomato",
    itemName: "Tomato",
    areaM2: 420,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.5, afternoon: 0.2, evening: 0.1, night: 0 },
      { pattern: "up", noisePct: 0.05, seasonalityPct: 0.03, seed: "S1-TOM", amplitude: 0.22 }
    ),
    farmerId: "FAR-01",
    logisticCenterId: "LC-west",
  },
  {
    id: "H-S2-TOM",
    sectionId: "S2",
    itemId: "item_tomato",
    itemName: "Tomato",
    areaM2: 260,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.25, afternoon: 0.3, evening: 0.12, night: 0 },
      { pattern: "hump", noisePct: 0.06, seasonalityPct: 0.04, seed: "S2-TOM", amplitude: 0.20 }
    ),
    farmerId: "FAR-02",
    logisticCenterId: "LC-west",
  },

  // --- Cucumbers ---
  {
    id: "H-S3-CUC",
    sectionId: "S3",
    itemId: "item_cucumber",
    itemName: "Cucumber",
    areaM2: 300,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.15, afternoon: 0.15, evening: 0.12, night: 0.05 },
      { pattern: "down", noisePct: 0.05, seasonalityPct: 0.05, seed: "S3-CUC", amplitude: 0.18 }
    ),
    farmerId: "FAR-03",
    logisticCenterId: "LC-north",
  },
  {
    id: "H-S4-CUC",
    sectionId: "S4",
    itemId: "item_cucumber",
    itemName: "Cucumber",
    areaM2: 180,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.1, afternoon: 0.12, evening: 0.08, night: 0.03 },
      { pattern: "bow", noisePct: 0.05, seasonalityPct: 0.04, seed: "S4-CUC", amplitude: 0.22 }
    ),
    farmerId: "FAR-04",
    logisticCenterId: "LC-north",
  },

  // --- Peppers ---
  {
    id: "H-S5-PEP",
    sectionId: "S5",
    itemId: "item_pepper",
    itemName: "Pepper",
    areaM2: 200,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.18, afternoon: 0.22, evening: 0.14, night: 0 },
      { pattern: "flat", noisePct: 0.07, seasonalityPct: 0.05, seed: "S5-PEP", amplitude: 0.0 }
    ),
    farmerId: "FAR-05",
    logisticCenterId: "LC-east",
  },
  {
    id: "H-S6-PEP",
    sectionId: "S6",
    itemId: "item_pepper",
    itemName: "Pepper",
    areaM2: 150,
    history: makeHistoryTrend(
      TODAY,
      14,
      { morning: 0.12, afternoon: 0.15, evening: 0.09, night: 0 },
      { pattern: "up", noisePct: 0.06, seasonalityPct: 0.04, seed: "S6-PEP", amplitude: 0.14 }
    ),
    farmerId: "FAR-06",
    logisticCenterId: "LC-east",
  },
];

/** Item registry for filter UI */
export const FAKE_ITEMS = [
  { id: "item_tomato", name: "Tomato" },
  { id: "item_cucumber", name: "Cucumber" },
  { id: "item_pepper", name: "Pepper" },
];

/** Fake API fetcher */
export function fakeFetchFarmerSectionHarvest(): Promise<FarmerSectionHarvestRecord[]> {
  return Promise.resolve(FAKE_FARMER_SECTION_HARVEST);
}
