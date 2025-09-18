// src/types/farmer.ts

// ---- UI types used by the Farmer Dashboard ----
// Approved Shipments table + StartPreparingDialog
export interface Shipment {
  id: string;
  shipmentNumber: string;
  itemName: string;
  amountKg: number;
  containerCount: number;
  pickupTimeISO: string; // ISO string
  location: string;
}

// Pending Shipment Requests table + ApproveRequestDialog
export interface ShipmentRequest {
  id: string;
  itemName: string;
  requestedKg: number;
  pickupTimeISO: string; // ISO string
  notes?: string;
}

// My Crops Status table
export interface CropRow {
  land: string; // display name of land/section
  cropItem: string; // display name of crop
  plantedKg: number;
  plantedOnISO: string;  // ISO date
  status: "Seeding" | "Growing" | "Harvesting" | "Dormant";
  lastUpdatedISO: string; // ISO date
  percentage: number; // 0..100
  imageUrl?: string;
}

/* -------------------------------------------------------
   (Optional) server-aligned types you can extend later.
   If/when you wire real endpoints, you can switch to:
   export interface FarmerDelivery { ... }
   export interface FarmerOrder { ... }
   export interface FarmerSection { ... }
------------------------------------------------------- */
