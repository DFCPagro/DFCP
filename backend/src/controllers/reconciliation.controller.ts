// Controller for container reconciliation.  Rebuilds the distributed
// weight records of a container by scanning all shelves and slots
// containing the container.

import { Request, Response, NextFunction } from "express";
import ContainerOps from "../models/ContainerOps.model";
import Shelf from "../models/Shelf.model";
import ApiError from "../utils/ApiError";

export async function reconcileContainer(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const ops = await ContainerOps.findById(id);
    if (!ops) throw new ApiError(404, "ContainerOps not found");
    // find all shelves where this container occupies a slot
    const shelves = await Shelf.find({ "slots.containerOpsId": ops._id }).lean();
    const distributed: any[] = [];
    let total = 0;
    for (const shelf of shelves) {
      for (const slot of shelf.slots) {
        if ((slot as any).containerOpsId && String((slot as any).containerOpsId) === String(ops._id)) {
          const w = slot.currentWeightKg || 0;
          distributed.push({ shelfId: shelf._id, slotId: slot.slotId, weightKg: w });
          total += w;
        }
      }
    }
    ops.set("distributedWeights", distributed as any);
    ops.markModified("distributedWeights");
    ops.totalWeightKg = total;
    await ops.save();
    res.json({ containerOps: ops.toObject() });
  } catch (e) {
    next(e);
  }
}
