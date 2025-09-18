export type Shipment = {
  id: string;
  shipmentNumber: string;
  itemName: string;
  amountKg: number;
  containerCount: number;
  pickupTimeISO: string;
  location: string;
};

export type ShipmentRequest = {
  id: string;
  itemName: string;
  requestedKg: number;
  pickupTimeISO: string;
  notes?: string;
};

export type CropRow = {
  land: string;
  cropItem: string;
  plantedKg: number;
  plantedOnISO: string;
  status: "Seeding" | "Growing" | "Harvesting" | "Dormant";
  lastUpdatedISO: string;
  percentage: number;
  imageUrl?: string;
};

