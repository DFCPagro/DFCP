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

/** Helpers */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeHistory(
  startDateISO: string,
  days: number,
  perShiftKgPerM2: Partial<Record<HarvestShift, number>>,
  variability: number = 0
): HistoryPoint[] {
  const start = new Date(startDateISO + "T00:00:00Z");
  const out: HistoryPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    const date = ymd(d);

    for (const shift of SHIFTS) {
      const base = perShiftKgPerM2[shift] ?? 0;
      const wiggle = variability
        ? ((i * (shift.length + 5)) % 5) / 5 * variability * base
        : 0;
      const val = Math.max(0, base + wiggle);
      out.push({ date, shift, harvestedKgPerM2: Number(val.toFixed(3)) });
    }
  }
  return out;
}

/** Anchor date */
const TODAY = "2025-09-23";

/** Fake dataset */
export const FAKE_FARMER_SECTION_HARVEST: FarmerSectionHarvestRecord[] = [
  // Tomatoes
  {
    id: "H-S1-TOM",
    sectionId: "S1",
    itemId: "item_tomato",
    itemName: "Tomato",
    areaM2: 420,
    history: makeHistory(TODAY, 14, {
      morning: 0.5,
      afternoon: 0.2,
      evening: 0.1,
      night: 0,
    }),
    farmerId: "FAR-01",
    logisticCenterId: "LC-west",
  },
  {
    id: "H-S2-TOM",
    sectionId: "S2",
    itemId: "item_tomato",
    itemName: "Tomato",
    areaM2: 260,
    history: makeHistory(TODAY, 14, {
      morning: 0.25,
      afternoon: 0.3,
      evening: 0.12,
      night: 0,
    }),
    farmerId: "FAR-02",
    logisticCenterId: "LC-west",
  },

  // Cucumbers
  {
    id: "H-S3-CUC",
    sectionId: "S3",
    itemId: "item_cucumber",
    itemName: "Cucumber",
    areaM2: 300,
    history: makeHistory(TODAY, 14, {
      morning: 0.15,
      afternoon: 0.15,
      evening: 0.12,
      night: 0.05,
    }),
    farmerId: "FAR-03",
    logisticCenterId: "LC-north",
  },
  {
    id: "H-S4-CUC",
    sectionId: "S4",
    itemId: "item_cucumber",
    itemName: "Cucumber",
    areaM2: 180,
    history: makeHistory(TODAY, 14, {
      morning: 0.1,
      afternoon: 0.12,
      evening: 0.08,
      night: 0.03,
    }),
    farmerId: "FAR-04",
    logisticCenterId: "LC-north",
  },

  // Peppers
  {
    id: "H-S5-PEP",
    sectionId: "S5",
    itemId: "item_pepper",
    itemName: "Pepper",
    areaM2: 200,
    history: makeHistory(TODAY, 14, {
      morning: 0.18,
      afternoon: 0.22,
      evening: 0.14,
      night: 0,
    }),
    farmerId: "FAR-05",
    logisticCenterId: "LC-east",
  },
  {
    id: "H-S6-PEP",
    sectionId: "S6",
    itemId: "item_pepper",
    itemName: "Pepper",
    areaM2: 150,
    history: makeHistory(TODAY, 14, {
      morning: 0.12,
      afternoon: 0.15,
      evening: 0.09,
      night: 0,
    }),
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
