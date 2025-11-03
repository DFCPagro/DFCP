// src/helpers/shelfLocator.mock.ts
import { Types } from "mongoose";

export type ShelfLocation = {
  shelfId: string;
  zone: string;      // A-D
  aisle: string;     // 1-3
  level: string;     // 1-3
  slot: string;      // 1-3
  slotId: string;    // "A-1-2-3" (zone-aisle-level-slot)
  containerOpsId: string;
  containerQr: string; // "QR:<containerOpsId>"
};

const ZONES = ["A", "B", "C", "D"] as const;
const AISLES = ["1", "2", "3"] as const;
const LEVELS = ["1", "2", "3"] as const;
const SLOTS  = ["1", "2", "3"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newId() {
  return new Types.ObjectId().toString();
}

export const ShelfLocatorMock = {
  /**
   * Suggest a random shelf location + container for the needed item/FO.
   * The signature mirrors what your real service will eventually use.
   */
  async suggest(args: {
    farmerOrderId: string;
    itemId: string;
    needKg?: number;
    needUnits?: number;
    logisticCenterId: string;
  }): Promise<ShelfLocation> {
    const zone = pick(ZONES);
    const aisle = pick(AISLES);
    const level = pick(LEVELS);
    const slot = pick(SLOTS);

    const shelfId = newId();
    const containerOpsId = newId();
    const slotId = `${zone}-${aisle}-${level}-${slot}`;
    const containerQr = `QR:${containerOpsId}`;

    return {
      shelfId,
      zone,
      aisle,
      level,
      slot,
      slotId,
      containerOpsId,
      containerQr,
    };
  },

  /**
   * Very simple QR verifier: accepts only strings of form "QR:<ObjectId>".
   * Returns normalized ids + echoes a random shelf/slot (since this is a mock).
   */
  async verifyContainerQr(containerQr: string): Promise<{
    ok: true;
    containerOpsId: string;
    shelfId: string;
    slotId: string;
  } | null> {
    if (typeof containerQr !== "string") return null;
    const m = containerQr.match(/^QR:([a-f\d]{24})$/i);
    if (!m) return null;

    const containerOpsId = m[1];
    const zone = pick(ZONES);
    const aisle = pick(AISLES);
    const level = pick(LEVELS);
    const slot = pick(SLOTS);
    const shelfId = newId();
    const slotId = `${zone}-${aisle}-${level}-${slot}`;

    return { ok: true, containerOpsId, shelfId, slotId };
  },
};
