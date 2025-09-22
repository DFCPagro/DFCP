export type PackageSize = {
  _id?: string;
  key: "Small" | "Medium" | "Large";
  name: string;
  innerDimsCm: {
    l: number;
    w: number;
    h: number;
  };
  headroomPct: number;
  maxSkusPerBox: number;
  maxWeightKg: number;
  mixingAllowed: boolean;
  tareWeightKg: number;
  usableLiters: number;
  vented: boolean;
  notes?: string;
  // optional map of values
  values?: Record<string, number>;
};


export type ListQuery = {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type PackageSizeDTO = {
  _id?: string;
  id?: string;
  name: string;
  key: "Small" | "Medium" | "Large";
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct: number;          // 0..0.9 (e.g., 0.15)
  maxSkusPerBox: number;
  maxWeightKg: number;
  mixingAllowed: boolean;
  tareWeightKg: number;
  usableLiters: number;         // server computes/overwrites
  vented: boolean;
  values?: Record<string, number>;
};