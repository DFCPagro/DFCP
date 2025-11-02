// frontend/src/types/packing.ts

// One line in a box (one bag / one bundle)
export interface PackedPiece {
  itemId: string;
  itemName?: string;
  pieceType: "bag" | "bundle";
  mode: "kg" | "unit";
  qtyKg?: number;          // only if mode === "kg"
  units?: number;          // only if mode === "unit"
  liters: number;
  estWeightKgPiece: number; // estimated kg for THIS piece
}

// A single physical box/crate in the plan
export interface PackedBox {
  boxNo: number;           // 1, 2, 3...
  boxType: string;         // "Small" | "Medium" | "Large"
  vented?: boolean;

  estFillLiters: number;   // sum of liters in this box
  estWeightKg: number;     // sum of estWeightKgPiece of contents
  fillPct: number;         // estFillLiters / usableLiters(box)

  contents: PackedPiece[];
}

// Per-item rollup summary at the bottom of the UI
export interface PackedItemSummary {
  itemId: string;
  itemName?: string;
  bags: number;
  bundles: number;
  totalKg?: number;
  totalUnits?: number;
}

// The full plan for the order (what backend calls PackingPlan / PackedOrder)
export interface PackedOrder {
  boxes: PackedBox[];
  summary: {
    totalBoxes: number;
    byItem: PackedItemSummary[];
    warnings: string[];
  };
}

// Server response shape from the controller
// (your controller returns { data: plan })
export interface PackOrderResponse {
  data: PackedOrder;
}
