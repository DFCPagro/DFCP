import { Types } from "mongoose";
import ContainerOps from "../models/ContainerOps.model";
import Shelf from "../models/Shelf.model";
import ApiError from "../utils/ApiError";

/**
 * ContainerOps activities that complement shelf moves:
 * - recordPicked (audit only)
 * - soft empty of a slot when container fully consumed (with shelf link)
 */

export namespace ContainerOpsService {
  export async function getByMongoId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid containerOps id");
    }
    const doc = await ContainerOps.findById(id);
    if (!doc) throw new ApiError(404, "ContainerOps not found");
    return doc.toObject();
  }

  /** Get a container by its business containerId (e.g. printed/QR id) */
  export async function getByContainerId(containerId: string) {
    if (!containerId?.trim()) {
      throw new ApiError(400, "containerId is required");
    }
    const doc = await ContainerOps.findOne({ containerId });
    if (!doc) throw new ApiError(404, "ContainerOps not found");
    return doc.toObject();
  }

  export async function recordPicked(args: {
    containerOpsId: string;
    amountKg: number;
    userId: string | Types.ObjectId;
  }) {
    const { containerOpsId, amountKg, userId } = args;
    if (amountKg <= 0) throw new ApiError(400, "amountKg must be > 0");

    const ops = await ContainerOps.findById(containerOpsId);
    if (!ops) throw new ApiError(404, "ContainerOps not found");

    ops.auditTrail.push({
      userId: new Types.ObjectId(userId),
      action: "picked",
      note: `Picked ${amountKg}kg from container`,
      timestamp: new Date(),
      meta: { amountKg },
    } as any);

    // remain 'shelved' unless thresholds are hit elsewhere
    await ops.save();
    return ops.toObject();
  }

  /**
   * If a slot is emptied (0kg), you may want to set state=depleted or out.
   * This is optional; many flows keep the state 'shelved' until moved.
   */
  export async function markDepletedIfZero(args: {
    containerOpsId: string;        // Mongo _id
    shelfMongoId: string;          // Mongo _id
    slotId: string;
    actorUserId?: string;          // for audit
  }) {
    const { containerOpsId, shelfMongoId, slotId, actorUserId } = args;

    const shelf = await Shelf.findById(shelfMongoId);
    if (!shelf) throw new ApiError(404, "Shelf not found");

    const slot = shelf.slots.find((s) => s.slotId === slotId);
    if (!slot) throw new ApiError(404, "Slot not found");

    if (!slot.containerOpsId) return { changed: false, reason: "slot-empty" };
    if (String(slot.containerOpsId) !== String(containerOpsId)) {
      return { changed: false, reason: "slot-occupied-by-different-container" };
    }
    if ((slot.currentWeightKg || 0) > 0) return { changed: false, reason: "weight-not-zero" };

    const ops = await ContainerOps.findById(containerOpsId);
    if (!ops) return { changed: false, reason: "container-not-found" };

    // 1) Free the slot (and decrement occupiedSlots if it was counted as occupied)
    await Shelf.updateOne(
      { _id: shelfMongoId },
      {
        $set: {
          "slots.$[s].containerOpsId": null,
          "slots.$[s].occupiedAt": null,
          "slots.$[s].emptiedAt": new Date(),
          updatedAt: new Date(),
        },
        $inc: { occupiedSlots: -1 },
      },
      { arrayFilters: [{ "s.slotId": slotId }] }
    );

    // 2) Set ContainerOps to the explicit depleted state
    ops.state = "depleted";
    ops.location = {
      area: "warehouse", // or wherever it logically goes next
      zone: null,
      aisle: null,
      shelfId: null,
      slotId: null,
      updatedAt: new Date(),
    } as any;

    ops.auditTrail.push({
      userId: actorUserId ?? undefined,
      action: "depleted",
      note: `Slot ${slotId} reached 0kg and was freed`,
      timestamp: new Date(),
      meta: { shelfMongoId, slotId },
    } as any);

    await ops.save();

    return { changed: true, containerOps: ops.toObject() };
  }
}
