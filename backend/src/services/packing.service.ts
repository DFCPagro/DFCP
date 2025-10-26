
/*ORDER PACKING */
type PackingPlan = {
  boxes: Array<{
    boxNo: number;
    boxType: string;         // PackageSize.key
    vented?: boolean;
    estFillLiters: number;
    estWeightKg: number;
    fillPct: number;         // estFillLiters / usableLiters
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
    warnings: string[]; // e.g., “split X into 2 boxes due to venting”
  };
}