// types/packing.ts
export type BoxContent = {
  itemId: string;
  itemName?: string;          // ← now sent by backend
  pieceType: "bag" | "bundle";
  mode: "kg" | "unit";
  qtyKg?: number;             // undefined if mode = "unit"
  units?: number;             // undefined if mode = "kg"
  liters: number;
};

export type BoxPlan = {
  boxNo: number;
  boxType: string;            // PackageSize.key
  vented?: boolean;
  estFillLiters: number;
  estWeightKg: number;
  fillPct: number;            // 0..1  (NOT percent)
  contents: BoxContent[];
};

export type SummaryByItem = {
  itemId: string;
  itemName?: string;          // ← optional helper for UI
  mode: "kg" | "unit";
  totalKg?: number;
  totalUnits?: number;
  liters?: number;
  bags?: number;
  bundles?: number;
};

export type PackingPlan = {
  boxes: BoxPlan[];
  summary: {
    totalBoxes: number;
    byItem: SummaryByItem[];
    warnings: string[];
  };
};
