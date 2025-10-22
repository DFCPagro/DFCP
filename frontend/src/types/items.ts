export type ItemCategory = "fruit" | "vegetable";

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
  weightPerUnit?: ABC;     // preferred key
  weightPerUnitG?: ABC;    // fallback; backend syncs if needed
  diameterMM?: ABC;
  qualityGrade?: ABC;
  maxDefectRatioLengthDiameter?: ABC;
  rejectionRate?: ABC;
};

export type SellModes = {
  byKg?: boolean;          // default true
  byUnit?: boolean;        // default false
  unitBundleSize?: number; // default 1
};

/** Persisted fields (match Mongoose schema) */
export type ItemBase = {
  _id: string;
  category: ItemCategory;
  type: string;
  variety: string | null;            // present, can be null
  imageUrl: string | null;

  season: string | null;
  farmerTips: string | null;
  customerInfo: string[];            // backend default []
  caloriesPer100g: number | null;

  price?: Price;                     // may be absent

  // weight/area metadata
  avgWeightPerUnitGr: number | null;
  sdWeightPerUnitGr: number;         // default 0
  avgQmPerUnit: number | null;
  weightPerUnitG: number | null;     // legacy alias

  // selling modes
  sellModes?: SellModes;

  // optional unit price override
  pricePerUnitOverride: number | null;

  // quality & tolerances
  qualityStandards?: QualityStandards;
  tolerance: string;                 // default "0.02"

  // audit
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Virtuals included in JSON (toJSON.virtuals = true) */
export type ItemDerived = {
  itemId: string;
  name: string;
  pricePerKg: number | null;
  pricePerUnit: number | null;
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
