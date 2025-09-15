// src/types/items.ts
export type ItemCategory = "fruit" | "vegetable";

export type Price = {
  a?: number | null;
  b?: number | null;
  c?: number | null;
};

export type Item = {
  _id: string;                 // server returns stringified ObjectId
  category: ItemCategory;
  type: string;
  variety?: string | null;
  imageUrl?: string | null;
  season?: string | null;
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
