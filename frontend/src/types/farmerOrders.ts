export type Shift = "morning" | "afternoon" | "evening" | "night";

export type FarmerOrderStatus = "pending" | "ok" | "problem";

export interface FarmerOrderDTO {
  id: string;

  // item identity & labels (you said type/variety won’t be empty)
  itemId: string;
  type: string;
  variety: string;
  pictureUrl?: string | null;

  // status & quantities
  farmerStatus: FarmerOrderStatus;
  forcastedQuantityKg: number;          // <-- exact name per your request
  finalQuantityKg?: number | null;

  // scheduling
  pickUpDate: string;                    // "YYYY-MM-DD" (local)
  shift: Shift;
}
