// src/pages/items/types/item.ts

export type ItemCategory = "fruit" | "vegetable" | "egg_dairy" | "other";

export type Price = {
  a?: number | null;
  b?: number | null;
  c?: number | null;
};

export type ABC = {
  A?: string | null;
  B?: string | null;
  C?: string | null;
};

export type QualityStandards = {
  tolerance?: ABC;
  brix?: ABC;
  acidityPercentage?: ABC;
  pressure?: ABC;
  colorDescription?: ABC;
  colorPercentage?: ABC;
  weightPerUnit?: ABC;     // preferred key for QS tables
  weightPerUnitG?: ABC;    // fallback; backend may sync
  diameterMM?: ABC;
  qualityGrade?: ABC;
  maxDefectRatioLengthDiameter?: ABC;
  rejectionRate?: ABC;
};

export type SellModes = {
  byKg?: boolean;           // default true
  byUnit?: boolean;         // default false
  unitBundleSize?: number;  // default 1
};

/** Persisted fields (match Mongoose schema) */
export type ItemBase = {
  _id: string;
  category: ItemCategory;

  type: string;
  variety: string | null;

  imageUrl: string | null;

  season: string | null;
  farmerTips: string | null;
  customerInfo: string[];          // default []

  caloriesPer100g: number | null;

  price?: Price;                   // may be absent

  // weight / area metadata
  avgWeightPerUnitGr: number | null;  // preferred numeric field
  sdWeightPerUnitGr: number;          // default 0
  avgQmPerUnit: number | null;

  // legacy alias kept for older data (backend should keep these in sync)
  weightPerUnitG: number | null;

  // selling modes (older docs may miss it)
  sellModes?: SellModes | null;

  // optional explicit per-unit price override
  pricePerUnitOverride?: number | null;

  // quality & tolerances
  qualityStandards?: QualityStandards;
  tolerance: string;               // product-level tolerance (e.g., "0.02")

  // audit
  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;            // legacy alias
};

/** Virtuals included in JSON (toJSON.virtuals = true) */
export type ItemDerived = {
  itemId: string;
  displayName?: string;            // e.g., "Strawberry Albion (12 pack)"
  name: string;                    // base name without pack suffix
  pricePerKg: number | null;
  pricePerUnit: number | null;

  /** normalized sell mode derived on backend */
  unitMode: "kg" | "unit" | "mixed";
};

export type Item = ItemBase & Partial<ItemDerived>;

export type ItemsListResponse = {
  items: Item[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};
