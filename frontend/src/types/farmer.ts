// --- UI tables (already used by the dashboard) ---
export interface Shipment {
  id: string;
  shipmentNumber: string;
  itemName: string;
  amountKg: number;
  containerCount: number;
  pickupTimeISO: string;
  location: string;
}

export interface ShipmentRequest {
  id: string;
  itemName: string;
  requestedKg: number;
  pickupTimeISO: string;
  notes?: string;
}

export interface CropRow {
  land: string;             // Land name
  cropItem: string;         // Section crop name
  plantedKg: number;        // Optional aggregate/estimate
  plantedOnISO: string;
  status: "Seeding" | "Growing" | "Harvesting" | "Dormant";
  lastUpdatedISO: string;
  percentage: number;       // growth %
  imageUrl?: string;
}

// --- Domain mirrors of your backend models (simplified) ---
export interface Farmer {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  lands: string[];         // refs to FarmerLand
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  lnt: number;              // longitude-ish (as in your model)
  alt: number;              // latitude-ish (as in your model)
  address: string;
  logisticCenterId?: string | null;
}

export interface Measurements {
  abM: number;
  bcM: number;
  cdM: number;
  daM: number;
  rotationDeg?: number;
}

export interface FarmerLand {
  _id: string;
  farmer: string;           // Farmer _id
  name: string;
  ownership: "owned" | "rented";
  areaM2: number;
  address: Address;
  pickupAddress?: Address | null;
  measurements: Measurements;
  sections: string[];       // refs to FarmerSection
  createdAt: string;
  updatedAt: string;
}

export interface FarmerSection {
  _id: string;
  landId: string;
  crop: string;
  plantedAtISO: string;
  lastUpdatedISO: string;
  status: "Seeding" | "Growing" | "Harvesting" | "Dormant";
  plantedKg?: number;
  growthPct?: number;
  imageUrl?: string;
  /** NEW (optional): human label for section */
  name?: string;
}

export interface CropRow {
  land: string;
  /** NEW: section id + display name */
  sectionId?: string;
  sectionName?: string;

  cropItem: string;
  plantedKg: number;
  plantedOnISO: string;
  status: "Seeding" | "Growing" | "Harvesting" | "Dormant";
  lastUpdatedISO: string;
  percentage: number;
  imageUrl?: string;
}
