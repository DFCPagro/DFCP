export type ItemCategory = "fruit" | "vegetable";

export type Price = {
  a?: number | null;
  b?: number | null;
  c?: number | null;
};

// ABC helper for quality standards
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
  weightPerUnit?: ABC;     // prefer this key
  weightPerUnitG?: ABC;    // fallback (backend syncs if needed)
  diameterMM?: ABC;
  qualityGrade?: ABC;
  maxDefectRatioLengthDiameter?: ABC;
  rejectionRate?: ABC;
};

export type Item = {
  _id: string;                 // server returns stringified ObjectId
  category: ItemCategory;
  type: string;
  variety?: string | null;
  imageUrl?: string | null;

  // NEW
  season?: string | null;
  tolerance?: string | null;   // shown as ±2% if missing
  qualityStandards?: QualityStandards;

  farmerTips?: string | null;
  customerInfo?: string[];
  caloriesPer100g?: number | null;
  price?: Price;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ItemsListResponse = {
  items: Item[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};