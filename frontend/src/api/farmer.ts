// src/api/farmer.ts
import type {
  Shipment,
  ShipmentRequest,
  CropRow,
  FarmerLand,
  FarmerSection,
} from "@/types/farmer";

const soon = (mins: number) =>
  new Date(Date.now() + mins * 60_000).toISOString();

// ---- helper: map sections (domain) -> CropRow (UI) ----
function sectionsToCropRows(
  lands: FarmerLand[],
  sections: FarmerSection[]
): CropRow[] {
  const landById = new Map(lands.map((l) => [l._id, l]));
  return sections.map((s): CropRow => {
    const land = landById.get(s.landId);
    return {
      land: land ? land.name : "Unknown Land",
      sectionId: s._id,                // NEW
      sectionName: s.name ?? s._id,    // NEW
      cropItem: s.crop,
      plantedKg: s.plantedKg ?? 0,
      plantedOnISO: s.plantedAtISO,
      status: s.status,
      lastUpdatedISO: s.lastUpdatedISO,
      percentage: s.growthPct ?? 0,
      imageUrl: s.imageUrl,
    };
  });
}

// ---- MOCK DASHBOARD (fits your modals + tables) ----
export async function fetchFarmerDashboard(): Promise<{
  approvedShipments: Shipment[];
  shipmentRequests: ShipmentRequest[];
  crops: CropRow[];
}> {
  await new Promise((r) => setTimeout(r, 250));

  // 1) Approved shipments (for StartPreparingDialog)
  const approvedShipments: Shipment[] = [
    {
      id: "66f0c8a72a5a0a0012ab0001",
      shipmentNumber: "SHP-24001",
      itemName: "Tomato (Cluster)",
      amountKg: 520,
      containerCount: 104,
      pickupTimeISO: soon(90),
      location: "LC - Central",
    },
    {
      id: "66f0c8a72a5a0a0012ab0002",
      shipmentNumber: "SHP-24002",
      itemName: "Cucumber",
      amountKg: 800,
      containerCount: 160,
      pickupTimeISO: soon(240),
      location: "LC - North District",
    },
  ];

  // 2) Pending shipment requests (for ApproveRequestDialog)
  const shipmentRequests: ShipmentRequest[] = [
    {
      id: "66f0c8a72a5a0a0012ab1001",
      itemName: "Bell Pepper (Red)",
      requestedKg: 600,
      pickupTimeISO: soon(360),
      notes: "High demand slot; partial approval allowed.",
    },
    {
      id: "66f0c8a72a5a0a0012ab1002",
      itemName: "Eggplant",
      requestedKg: 300,
      pickupTimeISO: soon(1080),
    },
  ];

  // 3) Lands -> Sections -> CropRow (for My Crops Status)
  const lands: FarmerLand[] = [
    {
      _id: "land_1",
      farmer: "farmer_1",
      name: "North Field A",
      ownership: "owned",
      areaM2: 12000,
      address: {
        lnt: 35.18,
        alt: 31.76,
        address: "North Field A",
        logisticCenterId: null,
      },
      pickupAddress: null,
      measurements: { abM: 120, bcM: 100, cdM: 120, daM: 100, rotationDeg: 8 },
      sections: ["sec_1", "sec_2"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "land_2",
      farmer: "farmer_1",
      name: "Greenhouse 2",
      ownership: "rented",
      areaM2: 3500,
      address: {
        lnt: 35.19,
        alt: 31.75,
        address: "Greenhouse 2",
        logisticCenterId: "lc_central",
      },
      pickupAddress: null,
      measurements: { abM: 70, bcM: 50, cdM: 70, daM: 50 },
      sections: ["sec_3"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

 const sections: FarmerSection[] = [
  {
    _id: "sec_1",
    name: "A1",                 // NEW
    landId: "land_1",
    crop: "Tomato (Cluster)",
    plantedAtISO: "2025-08-25T00:00:00Z",
    lastUpdatedISO: "2025-09-15T10:00:00Z",
    status: "Harvesting",
    plantedKg: 600,
    growthPct: 65,
    imageUrl: "https://images.unsplash.com/photo-1461354464878-ad92f492a5a0?w=200",
  },
  {
    _id: "sec_2",
    name: "A2",                 // NEW
    landId: "land_1",
    crop: "Bell Pepper (Red)",
    plantedAtISO: "2025-08-20T00:00:00Z",
    lastUpdatedISO: "2025-09-14T09:00:00Z",
    status: "Harvesting",
    plantedKg: 400,
    growthPct: 58,
    imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4b36a8d48?w=200",
  },
  {
    _id: "sec_3",
    name: "GH-2-South",         // NEW
    landId: "land_2",
    crop: "Cucumber",
    plantedAtISO: "2025-08-29T00:00:00Z",
    lastUpdatedISO: "2025-09-16T08:00:00Z",
    status: "Growing",
    plantedKg: 900,
    growthPct: 52,
    imageUrl: "https://images.unsplash.com/photo-1603652622857-10a6f1c1d5b3?w=200",
  },
];


  const crops: CropRow[] = sectionsToCropRows(lands, sections);

  return { approvedShipments, shipmentRequests, crops };
}

// Still using the same mock approve/start endpoints for now:
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

/*  // TODO backend final (keep for later)
import type { FarmerDelivery, FarmerOrder, FarmerSection as ServerSection } from "@/types/farmer";
export async function fetchFarmerDashboard(): Promise<{
  approvedShipments: FarmerDelivery[];
  shipmentRequests: FarmerOrder[];
  crops: ServerSection[];
}> {
  const res = await fetch("/api/farmer/dashboard");
  if (!res.ok) throw new Error("Failed to fetch farmer dashboard");
  return res.json();
}
export async function approveShipmentRequest(orderId: string, approvedKg: number, validUntilISO: string) {
  await fetch(`/api/farmer/orders/${orderId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvedKg, validUntilISO }),
  });
}
export async function startPreparingShipment(deliveryId: string) {
  await fetch(`/api/farmer/deliveries/${deliveryId}/start`, { method: "POST" });
}
*/
