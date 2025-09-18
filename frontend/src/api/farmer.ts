import type { Shipment, ShipmentRequest, CropRow } from "@/types/farmer";

const soon = (mins: number) => new Date(Date.now() + mins * 60_000).toISOString();

export async function fetchFarmerDashboard(): Promise<{
  approvedShipments: Shipment[];
  shipmentRequests: ShipmentRequest[];
  crops: CropRow[];
}> {
  await new Promise((r) => setTimeout(r, 250));
  return {
    approvedShipments: [
      { id: "SHP-001", shipmentNumber: "SHP-001", itemName: "Apple Fuji", amountKg: 432, containerCount: 85, pickupTimeISO: soon(240), location: "LC - North District" },
      { id: "SHP-002", shipmentNumber: "SHP-002", itemName: "Banana Cavendish", amountKg: 733, containerCount: 110, pickupTimeISO: soon(90), location: "LC - Central" },
    ],
    shipmentRequests: [
      { id: "REQ-010", itemName: "Orange Navel", requestedKg: 500, pickupTimeISO: soon(360), notes: "High demand slot" },
      { id: "REQ-011", itemName: "Grapes Red Globe", requestedKg: 300, pickupTimeISO: soon(1080) },
    ],
    crops: [
      { land: "Land 1", cropItem: "Apple Fuji", plantedKg: 432, plantedOnISO: "2025-07-15T00:00:00Z", status: "Harvesting", lastUpdatedISO: "2025-07-15T12:00:00Z", percentage: 40, imageUrl: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=200" },
      { land: "Land 2", cropItem: "Banana Cavendish", plantedKg: 733, plantedOnISO: "2025-07-15T00:00:00Z", status: "Harvesting", lastUpdatedISO: "2025-07-15T12:00:00Z", percentage: 58, imageUrl: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=200" },
      { land: "Land 3", cropItem: "Orange Navel", plantedKg: 432, plantedOnISO: "2025-07-15T00:00:00Z", status: "Harvesting", lastUpdatedISO: "2025-07-15T12:00:00Z", percentage: 48, imageUrl: "https://images.unsplash.com/photo-1574226516831-e1dff420e43e?w=200" },
      { land: "Land 4", cropItem: "Grapes Red Globe", plantedKg: 342, plantedOnISO: "2025-07-15T00:00:00Z", status: "Harvesting", lastUpdatedISO: "2025-07-15T12:00:00Z", percentage: 30, imageUrl: "https://images.unsplash.com/photo-1628314345072-30f69c3dbfcf?w=200" },
    ],
  };
}

export async function approveShipmentRequest(
  id: string,
  approvedKg: number,
  validUntilISO: string
) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, id, approvedKg, validUntilISO };
}

export async function startPreparingShipment(shipmentId: string) {
  await new Promise((r) => setTimeout(r, 200));
  return { ok: true, shipmentId };
}


/*  // TODO backend final:
import type { FarmerDelivery, FarmerOrder, FarmerSection } from "@/types/farmer";

// Replace fetch with your real API client (axios, fetch wrapper, etc.)
export async function fetchFarmerDashboard(): Promise<{
  approvedShipments: FarmerDelivery[];
  shipmentRequests: FarmerOrder[];
  crops: FarmerSection[];
}> {
  const res = await fetch("/api/farmer/dashboard");
  if (!res.ok) throw new Error("Failed to fetch farmer dashboard");
  return res.json();
}

export async function approveShipmentRequest(
  orderId: string,
  approvedKg: number,
  validUntilISO: string
) {
  await fetch(`/api/farmer/orders/${orderId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvedKg, validUntilISO }),
  });
}

export async function startPreparingShipment(deliveryId: string) {
  await fetch(`/api/farmer/deliveries/${deliveryId}/start`, {
    method: "POST",
  });
}
// 


*/