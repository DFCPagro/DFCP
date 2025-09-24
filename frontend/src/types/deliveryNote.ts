// src/types/deliveryNote.ts
export type Quality = "A" | "B" | "C";

export type DeliveryNoteItem = {
  id: string;
  name: string;
  farmer?: string;
  quality: Quality;
  unitPrice: number;      // per kg
  quantityKg: number;
  totalVolume?: number;   // m³ or similar
};

export type Party = { name: string; address: string; phone?: string };

export type DeliveryNoteData = {
  noteNumber: string;
  orderNumber?: string;
  dateISO: string;
  logisticsCenter?: string;
  seller?: Party;
  buyer?: Party;
  currency?: string;      // e.g. "ILS"
  items: DeliveryNoteItem[];
};
