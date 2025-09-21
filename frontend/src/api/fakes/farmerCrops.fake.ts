// /src/api/fakes/farmerCrops.fake.ts
// Temporary fake backend for Farmer → Lands → Sections → Crops.
// - Promise-based, with artificial delay
// - In-memory store (resets on page reload)
// - Returns deep clones to avoid accidental mutation in UI
// - Denormalizes cropName/imageUrl from the catalog so the table is simple

/* =========================
 * Types (kept local to avoid coupling; you can later move these to /src/types/agri.ts)
 * ======================= */

export type CropStatus = "planting" | "growing" | "readyForHarvest" | "clearing" | "problem";

export interface CatalogItemDTO {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export interface SectionCropDTO {
  itemId: string;
  cropName?: string; // denormalized for UI
  plantedAmountGrams: number;
  plantedOnDate: string | null;           // "YYYY-MM-DD"
  status: CropStatus;
  statusPercentage?: number | null;       // 0..100
  avgRatePerUnit?: number | null;         // grams per plant
  expectedFruitingPerPlant?: number | null;
  expectedHarvestDate?: string | null;    // "YYYY-MM-DD"
  expectedHarvestKg?: number | null;
  imageUrl?: string | null;               // from catalog
}

export interface SectionDTO {
  id: string;
  landId: string;
  name?: string; // optional display label
  areaM2: number;
  updatedAt: string; // ISO
  measurements?: Record<string, unknown>;
  crops: SectionCropDTO[];
}

export interface LandDTO {
  id: string;
  name: string;
  areaM2: number;
  sectionsCount: number;
  updatedAt: string; // ISO
}

export interface CreateCropInput {
  itemId: string;
  plantedAmountGrams: number;
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  plantedOnDate: string | null;        // "YYYY-MM-DD"
  expectedHarvestDate: string | null;  // "YYYY-MM-DD"
}

/* =========================
 * Utilities
 * ======================= */

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function deepClone<T>(obj: T): T {
  return structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
}

function todayYYYYMMDD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function pick<T extends object, K extends keyof T>(obj: T, keys: ReadonlyArray<K>): Pick<T, K> {
  const o = {} as Pick<T, K>;
  for (const k of keys) o[k] = obj[k];
  return o;
}

/* =========================
 * In-memory seed data
 * ======================= */

// Catalog (what populates the "Select Crop" dropdown)
const catalog: CatalogItemDTO[] = [
  { id: "itm-tomato", name: "Tomato", imageUrl: "https://picsum.photos/seed/tomato/80/80" },
  { id: "itm-cucumber", name: "Cucumber", imageUrl: "https://picsum.photos/seed/cucumber/80/80" },
  { id: "itm-pepper", name: "Bell Pepper", imageUrl: "https://picsum.photos/seed/pepper/80/80" },
  { id: "itm-strawberry", name: "Strawberry", imageUrl: "https://picsum.photos/seed/strawberry/80/80" },
];

// Lands
const lands: LandDTO[] = [
  { id: "land-west-1", name: "West Valley A", areaM2: 12000, sectionsCount: 2, updatedAt: isoNow() },
  { id: "land-north-2", name: "Northern Ridge", areaM2: 8000, sectionsCount: 1, updatedAt: isoNow() },
];

// Sections and their crops (crops live on sections)
const sectionsByLand = new Map<string, SectionDTO[]>(
  [
    [
      "land-west-1",
      [
        {
          id: "sec-west-1a",
          landId: "land-west-1",
          name: "Section A",
          areaM2: 6000,
          updatedAt: isoNow(),
          measurements: { abM: 60, bcM: 100 },
          crops: [
            {
              itemId: "itm-tomato",
              cropName: "Tomato",
              plantedAmountGrams: 120000, // 120 kg
              plantedOnDate: "2025-08-01",
              status: "growing",
              statusPercentage: 55,
              avgRatePerUnit: 150,
              expectedFruitingPerPlant: 3,
              expectedHarvestDate: "2025-10-05",
              expectedHarvestKg: 300,
              imageUrl: catalog.find(c => c.id === "itm-tomato")?.imageUrl ?? null,
            },
          ],
        },
        {
          id: "sec-west-1b",
          landId: "land-west-1",
          name: "Section B",
          areaM2: 6000,
          updatedAt: isoNow(),
          measurements: { abM: 50, bcM: 120 },
          crops: [
            {
              itemId: "itm-cucumber",
              cropName: "Cucumber",
              plantedAmountGrams: 90000,
              plantedOnDate: "2025-08-15",
              status: "planting",
              statusPercentage: 20,
              avgRatePerUnit: 120,
              expectedFruitingPerPlant: 2,
              expectedHarvestDate: "2025-09-30",
              expectedHarvestKg: 180,
              imageUrl: catalog.find(c => c.id === "itm-cucumber")?.imageUrl ?? null,
            },
          ],
        },
      ],
    ],
    [
      "land-north-2",
      [
        {
          id: "sec-north-2a",
          landId: "land-north-2",
          name: "Main Plot",
          areaM2: 8000,
          updatedAt: isoNow(),
          measurements: { abM: 80, bcM: 100 },
          crops: [
            {
              itemId: "itm-strawberry",
              cropName: "Strawberry",
              plantedAmountGrams: 60000,
              plantedOnDate: "2025-07-25",
              status: "growing",
              statusPercentage: 70,
              avgRatePerUnit: 60,
              expectedFruitingPerPlant: 4,
              expectedHarvestDate: "2025-09-20",
              expectedHarvestKg: 140,
              imageUrl: catalog.find(c => c.id === "itm-strawberry")?.imageUrl ?? null,
            },
          ],
        },
      ],
    ],
  ]
);

/* =========================
 * Core helpers
 * ======================= */

function findCatalogItem(itemId: string): CatalogItemDTO | undefined {
  return catalog.find((c) => c.id === itemId);
}

function ensureDenormalizedFields(crop: SectionCropDTO): SectionCropDTO {
  const item = findCatalogItem(crop.itemId);
  return {
    ...crop,
    cropName: crop.cropName ?? item?.name ?? "Unknown",
    imageUrl: crop.imageUrl ?? item?.imageUrl ?? null,
  };
}

function touchSection(section: SectionDTO): void {
  section.updatedAt = isoNow();
}

/* =========================
 * Public API (fake)
 * ======================= */

/**
 * List lands owned by the farmer (fake: returns all).
 */
export async function listLands(): Promise<LandDTO[]> {
  await delay();
  // Update sectionsCount dynamically in case crops/sections change during session
  const withCounts = lands.map((land) => {
    const sections = sectionsByLand.get(land.id) ?? [];
    return { ...land, sectionsCount: sections.length };
  });
  return deepClone(withCounts);
}

/**
 * List sections for a given land, including their crops[].
 */
export async function listSectionsByLand(landId: string): Promise<SectionDTO[]> {
  await delay();
  const list = sectionsByLand.get(landId) ?? [];
  // Ensure crops have cropName/imageUrl filled (denormalize)
  const denorm = list.map((s) => ({
    ...s,
    crops: s.crops.map(ensureDenormalizedFields),
  }));
  return deepClone(denorm);
}

/**
 * List crop catalog (used by the Add Crop form dropdown).
 */
export async function listCropCatalog(): Promise<CatalogItemDTO[]> {
  await delay();
  return deepClone(catalog);
}

/**
 * Create a new crop entry under a specific section.
 * - Validates minimal inputs
 * - Pushes to the in-memory store
 * - Updates the section.updatedAt
 * - Returns the created (denormalized) crop DTO
 */
export async function createSectionCrop(
  sectionId: string,
  payload: CreateCropInput
): Promise<SectionCropDTO> {
  await delay();

  // Simple validation (client will also validate)
  if (!payload?.itemId) throw new Error("itemId is required");
  if (typeof payload.plantedAmountGrams !== "number" || payload.plantedAmountGrams <= 0) {
    throw new Error("plantedAmountGrams must be > 0");
  }

  // Find the section in the store
  let foundSection: SectionDTO | undefined;
  for (const [, list] of sectionsByLand) {
    const s = list.find((sec) => sec.id === sectionId);
    if (s) {
      foundSection = s;
      break;
    }
  }
  if (!foundSection) {
    throw new Error(`Section ${sectionId} not found`);
  }

  // Compose the new crop (defaults match common sense)
  const crop: SectionCropDTO = ensureDenormalizedFields({
    itemId: payload.itemId,
    plantedAmountGrams: payload.plantedAmountGrams,
    plantedOnDate: payload.plantedOnDate ?? todayYYYYMMDD(),
    status: "planting",
    statusPercentage: 0,
    avgRatePerUnit: payload.avgRatePerUnit ?? null,
    expectedFruitingPerPlant: payload.expectedFruitingPerPlant ?? null,
    expectedHarvestDate: payload.expectedHarvestDate ?? null,
    expectedHarvestKg: null,
    imageUrl: undefined, // will be filled by ensureDenormalizedFields
  });

  // Insert
  foundSection.crops.push(crop);
  touchSection(foundSection);

  return deepClone(crop);
}

export async function createSection(
  landId: string,
  input: { name?: string; areaM2?: number; measurements?: Record<string, unknown> }
): Promise<SectionDTO> {
  await delay();

  // find target land and its sections list (or make one)
  const list = sectionsByLand.get(landId) ?? [];
  const nextIndex = list.length + 1;
  const id = `sec-${landId}-${Math.random().toString(36).slice(2, 7)}`;

  const newSection: SectionDTO = {
    id,
    landId,
    name: (input.name ?? `Section ${nextIndex}`).trim(),
    areaM2: typeof input.areaM2 === "number" && input.areaM2 > 0 ? input.areaM2 : 1000,
    updatedAt: isoNow(),
    measurements: (input.measurements as any) ?? {},
    crops: [], // IMPORTANT: new sections start empty
  };

  // insert + touch land
  list.push(newSection);
  sectionsByLand.set(landId, list);

  const landIdx = lands.findIndex(l => l.id === landId);
  if (landIdx >= 0) {
    lands[landIdx] = {
      ...lands[landIdx],
      sectionsCount: list.length,
      updatedAt: isoNow(),
    };
  }

  return deepClone(newSection);
}


/* =========================
 * Optional default export
 * ======================= */

const fakeFarmerCropsApi = {
  listLands,
  listSectionsByLand,
  listCropCatalog,
  createSectionCrop,
  createSection,
};

export default fakeFarmerCropsApi;

/* =========================
 * Narrow exports for convenience
 * ======================= */
export const __internal = {
  // Useful for tests or future extension; safe to remove later
  _getStoreSnapshot: () => deepClone({
    lands: lands.map(l => pick(l, ["id","name","areaM2","sectionsCount","updatedAt"])),
    sectionsByLand: Array.from(sectionsByLand.entries()).map(([k, v]) => [k, deepClone(v)]),
    catalog: deepClone(catalog),
  }),
};

