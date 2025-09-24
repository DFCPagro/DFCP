// src/api/deliveryNotes.ts
import type { DeliveryNoteData } from "@/types/deliveryNote";

const MOCK: DeliveryNoteData = {
  noteNumber: "DN-2025-000123",
  orderNumber: "ORD-778899",
  dateISO: new Date().toISOString(),
  logisticsCenter: "LC-01 Tel Aviv",
  seller: { name: "DFCP Logistics", address: "1 Market Way, Tel Aviv", phone: "+972-50-000-0000" },
  buyer: { name: "Alex Cohen", address: "Herzl St 10, Rishon LeZion", phone: "+972-54-123-4567" },
  currency: "ILS",
  items: [
    { id: "1", name: "Tomato Roma", farmer: "Levy Farm", quality: "A", unitPrice: 8.5, quantityKg: 6, totalVolume: 0.012 },
    { id: "2", name: "Cucumber", farmer: "Negev Greens", quality: "B", unitPrice: 6.2, quantityKg: 4.5, totalVolume: 0.010 },
    { id: "3", name: "Strawberry Albion", farmer: "Galilee Fields", quality: "A", unitPrice: 24, quantityKg: 2, totalVolume: 0.006 },
  ],
};

export async function getDeliveryNote(noteId?: string): Promise<DeliveryNoteData> {
  // swap with real fetch later
  return Promise.resolve(MOCK);
}
