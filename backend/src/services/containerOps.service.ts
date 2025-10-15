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

    // remain 'shelved' unless you want to change states on thresholds
    await ops.save();
    return ops.toObject();
  }

  /**
   * If a slot is emptied (0kg), you may want to set state=sorted or out.
   * This is optional; many flows keep the state 'shelved' until moved.
   */
  export async function markDepletedIfZero(args: {
    containerOpsId: string;
    shelfId: string;
    slotId: string;
  }) {
    const { containerOpsId, shelfId, slotId } = args;
    const shelf = await Shelf.findById(shelfId);
    if (!shelf) throw new ApiError(404, "Shelf not found");

    const slot = shelf.slots.find((s) => s.slotId === slotId);
    if (!slot) throw new ApiError(404, "Slot not found");
    if (!slot.containerOpsId) return { changed: false };

    if ((slot.currentWeightKg || 0) > 0) return { changed: false };

    const ops = await ContainerOps.findById(containerOpsId);
    if (!ops) return { changed: false };

    ops.state = "sorted"; // or 'stored' depending on your policy
    ops.auditTrail.push({
      userId: undefined as any,
      action: "depleted",
      note: "Slot reached 0kg",
      timestamp: new Date(),
      meta: { shelfId, slotId },
    } as any);
    await ops.save();
    return { changed: true, containerOps: ops.toObject() };
  }
}
