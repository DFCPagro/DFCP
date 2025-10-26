// Matches the shape you requested
export type PackingPlan = {
  boxes: Array<{
    boxNo: number;
    boxType: string;
    vented?: boolean;
    estFillLiters: number;
    estWeightKg: number;
    fillPct: number;
    contents: Array<{
      itemId: string;
      pieceType: "bag" | "bundle";
      mode: "kg" | "unit";
      qtyKg?: number;
      units?: number;
      liters: number;
    }>;
  }>;
  summary: {
    totalBoxes: number;
    byItem: Array<{
      itemId: string;
      bags: number;
      bundles: number;
      totalKg?: number;
      totalUnits?: number;
    }>;
    warnings: string[];
  };
};
