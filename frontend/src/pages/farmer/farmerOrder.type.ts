export type FarmerOrderCard = {
  id: string;
  pickUpDate: string; // YYYY-MM-DD
  shift: "morning" | "afternoon" | "evening" | "night";
  farmerStatus: "pending" | "ok" | "problem";
  type: string;
  variety: string;
  forcastedQuantityKg?: number;
  finalQuantityKg?: number | null;
};



// src/types/farmerOrders.ts
export type ShiftKey = "morning" | "afternoon" | "evening" | "night";

export type FarmerOrderForShiftItem = {
  id: string;
  itemId: string;
  type: string;
  variety?: string;
  imageUrl?: string;

  farmerName: string;
  farmName: string;

  shift: ShiftKey;
  pickUpDate: string;            // "YYYY-MM-DD"
  pickUpTime?: string | null;    // stringified by BE or ISO → we display HH:mm

  logisticCenterId: string;

  farmerStatus: "pending" | "ok" | "problem" | string;
  orderedQuantityKg: number;
  forcastedQuantityKg: number;
  finalQuantityKg?: number | null;

  containers: string[];          // ObjectId[] stringified
  containerSnapshots: any[];     // minimal snapshot list if you keep it
  stageKey: string | null;

  farmersQSreport?: any;
  inspectionQSreport?: any;
  visualInspection?: any;
  inspectionStatus: "pending" | "passed" | "failed";
};

// types/farmerOrders.ts
export type FarmerViewByShiftResponse = {
  meta: {
    lc: string
    date: string
    shiftName: "morning" | "afternoon" | "evening" | "night"
    tz: string
    page: number
    limit: number
    total: number
    pages: number
    problemCount: number
    scopedToFarmer?: boolean
    forFarmerView?: boolean
  }
  items: Array<{
    id: string
    itemId: string
    type: string
    variety?: string
    imageUrl?: string
    farmerName: string
    farmName: string
    shift: "morning" | "afternoon" | "evening" | "night"
    pickUpDate: string
    pickUpTime?: string | null
    logisticCenterId: string
    farmerStatus: string
    orderedQuantityKg: number
    forcastedQuantityKg: number
    finalQuantityKg?: number | null
    containers: string[]
    containerSnapshots: any[]
    stageKey: string | null
    farmersQSreport?: any
    inspectionQSreport?: any
    visualInspection?: any
    inspectionStatus: "pending" | "passed" | "failed"
  }>
}


export type AcceptedGroup = {
  pickUpDate: string;
  shift: ShiftKey;
  pickUpTime?: string | null;
  items: Array<{
    id: string;
    itemId: string;
    type: string;
    variety?: string;
    imageUrl?: string;
    forcastedQuantityKg: number;
    finalQuantityKg?: number | null;
  }>;
};

