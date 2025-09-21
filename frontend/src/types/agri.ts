// /src/types/agri.ts
// Central agricultural domain types for Farmer → Lands → Sections → Crops
// - Mirrors backend models (shape + intent)
// - Exposes frontend-facing DTOs used by /src/api/farmerCrops.ts
// - No runtime deps

/* =========================
 * Common primitives
 * ======================= */

/** Branded string to document ISO DateTime in JSON (e.g., "2025-09-21T08:45:00.000Z") */
export type ISODateTimeString = string & { __isoDateTime?: true };

/** Branded string to document ISO Date (YYYY-MM-DD) */
export type ISODateString = string & { __isoDate?: true };

/** Database/entity identifier (ObjectId string or custom ID). */
export type Id = string;

/* =========================
 * Enums & constants
 * ======================= */

export const CropStatusValues = [
  "planting",
  "growing",
  "readyForHarvest",
  "clearing",
  "problem",
] as const;

export type CropStatus = (typeof CropStatusValues)[number];

export const LandOwnershipValues = ["owned", "rented"] as const;
export type LandOwnership = (typeof LandOwnershipValues)[number];

/* =========================
 * Shared sub-objects (match backend)
 * ======================= */

/** Minimal address info used by FarmerLand (mirrors AddressSubSchema) */
export interface LandAddress {
  /** Longitude-ish (named 'lnt' in the DB schema) */
  lnt: number;
  /** Latitude-ish (named 'alt' in the DB schema) */
  alt: number;
  /** Human-readable address text */
  address: string;
  /** Optional logistic center id associated with this address */
  logisticCenterId: string | null;
}

/** Measurement helpers (mirrors MeasurementsSchema) */
export interface Measurements {
  /** Side AB length in meters */
  abM?: number;
  /** Side BC length in meters */
  bcM?: number;
  /** Side CD length in meters */
  cdM?: number;
  /** Side DA length in meters */
  daM?: number;
  /** Optional rotation in degrees for drawing helpers */
  rotationDeg?: number;
}

/* =========================
 * Backend domain models (for reference / richer typing)
 * These mirror your Mongoose models. Virtuals are marked optional.
 * ======================= */

export interface Farmer {
  id: Id;
  user: Id | null;
  agriculturalInsurance: boolean;
  farmName: string;
  agreementPercentage: number; // 0..100
  lands: Id[]; // references FarmerLand
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface FarmerLand {
  id: Id;
  farmer: Id; // -> Farmer
  name: string;
  ownership: LandOwnership;
  areaM2: number;
  address: LandAddress;
  pickupAddress: LandAddress | null;
  measurements: Measurements;
  sections: Id[]; // -> FarmerSection
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;

  /** Virtuals (available if API chooses to expose) */
  polygon2D?: [number, number][]; // 2D points A→B→C→D
  computedAreaM2?: number | null;
}

export interface SectionCrop {
  item: Id; // -> Item (catalog)
  plantedAmount: number; // grams
  plantedOnDate: ISODateString | null;

  status: CropStatus;

  avgRatePerUnit: number | null; // grams per plant
  expectedFruitingPerPlant: number | null;

  expectedHarvestDate: ISODateString | null;
  statusPercentage: number | null; // 0..100
  expectedHarvestKg: number | null;
}

export interface FarmerSection {
  id: Id;
  land: Id; // -> FarmerLand
  areaM2: number;
  measurements: Measurements;
  matrix?: unknown; // placeholder/flexible
  crops: SectionCrop[];

  logisticCenterId: string | null;
  agreementAmountKg: number; // remaining supply budget

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;

  /** Virtuals (available if API chooses to expose) */
  polygon2D?: [number, number][];
  computedAreaM2?: number | null;
}

/* =========================
 * Frontend DTOs for the Farmer Crops feature
 * These are what our API facade returns to the UI.
 * ======================= */

/** Catalog entry for crop selection dropdown */
export interface CatalogItemDTO {
  id: Id;
  name: string;
  imageUrl?: string | null;
}

/** A single crop record inside a section, denormalized for display */
export interface SectionCropDTO {
  /** Catalog item id */
  itemId: Id;
  /** Optional denormalized label for the UI (from catalog) */
  cropName?: string;
  /** Planted amount in grams */
  plantedAmountGrams: number;
  /** YYYY-MM-DD or null */
  plantedOnDate: ISODateString | null;

  status: CropStatus;
  /** 0..100 (if backend owns it). UI may derive when missing */
  statusPercentage?: number | null;

  /** Optional agronomic helpers */
  avgRatePerUnit?: number | null; // grams/plant
  expectedFruitingPerPlant?: number | null;
  expectedHarvestDate?: ISODateString | null;
  expectedHarvestKg?: number | null;

  /** Optional thumbnail (from catalog item) */
  imageUrl?: string | null;
}

/** A section and its crop list as the UI consumes it */
export interface SectionDTO {
  id: Id;
  landId: Id;
  /** Optional display label (e.g., "Section A") */
  name?: string;
  areaM2: number;
  /** ISO timestamp from server (used as "Last Updated On" in table) */
  updatedAt: ISODateTimeString;
  /** Optional measurements for maps/drawings */
  measurements?: Measurements;
  /** The crops currently planted in this section */
  crops: SectionCropDTO[];
}

/** Land summary for the land selector and overview badges */
export interface LandDTO {
  id: Id;
  name: string;
  areaM2: number;
  /** Convenience: number of sections under this land */
  sectionsCount: number;
  /** Last updated time for the land (if surfaced by the API) */
  updatedAt: ISODateTimeString;
}

/** Payload to create a crop under a section */
export interface CreateCropInput {
  itemId: Id;
  plantedAmountGrams: number;
  /** Optional agronomic helpers */
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  /** YYYY-MM-DD or null */
  plantedOnDate: ISODateString | null;
  /** YYYY-MM-DD or null */
  expectedHarvestDate: ISODateString | null;
}

/* =========================
 * Small helpers for narrowing (optional)
 * ======================= */

/** Type guard for CropStatus strings */
export function isCropStatus(x: unknown): x is CropStatus {
  return typeof x === "string" && (CropStatusValues as readonly string[]).includes(x);
}

/** Shallow sanity check for ISO date (YYYY-MM-DD). Does not validate calendar correctness. */
export function looksLikeISODate(d: unknown): d is ISODateString {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}


// Create Section payload
export interface CreateSectionInput {
  name?: string;
  areaM2?: number;
  measurements?: Measurements; // optional AB/BC/etc
}
