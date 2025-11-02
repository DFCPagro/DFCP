// src/data/orders.ts
import type { OrderRowAPI } from "@/types/orders";

export type OrderRowLoose = OrderRowAPI & Record<string, unknown>;

export const MOCK_ORDERS: OrderRowLoose[] = [
  // ACTIVE
  {
    id: "o-20001",
    orderId: "ORD-20001",
    stageKey: "accepted" as any,
    acceptedAt: "2025-09-29",
    acceptedWindowStart: "19:00",
    acceptedWindowEnd: "20:00",
    createdAt: "2025-09-28T09:40:00Z",
    // no coords -> page will generate a deterministic mock point
    items: [
      {
        productId: "CMB-01",
        name: "Cucumber Beit Alpha",
        quantity: 6,
        unit: "unit",
        unitPrice: 0.7,
        currency: "$",
      } as any,
    ],
  },
  {
    id: "o-20002",
    orderId: "ORD-20002",
    stageKey: "from_the_logistic_to_the_customer" as any,
    acceptedAt: "2025-10-02",
    acceptedWindowStart: "18:00",
    acceptedWindowEnd: "19:00",
    createdAt: "2025-10-02T14:50:00Z",
    delivery: { lat: 32.066, lng: 34.777 }, // has coords
    items: [
      {
        productId: "LETT-ROM",
        name: "Lettuce Romaine",
        quantity: 2,
        unit: "unit",
        unitPrice: 1.2,
        currency: "$",
      } as any,
    ],
  },

  // OLD
  {
    id: "o-20003",
    orderId: "ORD-20003",
    stageKey: "delivered" as any,
    acceptedAt: "2025-09-27",
    acceptedWindowStart: "09:00",
    acceptedWindowEnd: "10:00",
    createdAt: "2025-09-26T08:30:00Z",
    // no coords -> page will generate a deterministic mock point
    items: [
      {
        productId: "BAN-CA",
        name: "Banana Cavendish",
        quantity: 6,
        unit: "unit",
        unitPrice: 0.5,
        currency: "$",
      } as any,
    ],
  },

  // REPORTED
  {
    id: "o-20004",
    orderId: "ORD-20004",
    stageKey: "packed" as any,
    reported: true,
    acceptedAt: "2025-10-01",
    acceptedWindowStart: "11:00",
    acceptedWindowEnd: "12:00",
    createdAt: "2025-09-30T16:15:00Z",
    delivery: { lat: 31.995, lng: 35.011 },
    items: [
      {
        productId: "PEPPER-R",
        name: "Red Pepper",
        quantity: 2,
        unit: "kg",
        unitPrice: 3.0,
        currency: "$",
      } as any,
    ],
  },
];
