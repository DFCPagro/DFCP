// src/helpers/deliveryShelf.mock.ts
import { Types } from "mongoose";

const DELIV_ZONES = ["D-A", "D-B", "D-C"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newId() {
  return new Types.ObjectId().toString();
}

export const DeliveryShelfMock = {
  /**
   * Assigns a random delivery shelf and returns its id (ObjectId string).
   */
  async assign(args: {
    logisticCenterId: string;
    shiftName: string;
    orderId: string;
  }): Promise<string> {
    // In a real service you’d choose based on capacity/route batching.
    const _zone = pick(DELIV_ZONES);
    const deliveryShelfId = newId();
    return deliveryShelfId;
  },
};
