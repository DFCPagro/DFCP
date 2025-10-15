import { Request, Response, NextFunction } from "express";
import { ContainerOpsService } from "../services/containerOps.service";

/** Audits a pick against a container (complements shelf.consume). */
export async function recordPicked(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // containerOpsId
    const { amountKg } = req.body;
    // @ts-ignore
    const userId = req.user?._id;
    const data = await ContainerOpsService.recordPicked({ containerOpsId: id, amountKg, userId });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/** Optional endpoint: if slot hit 0kg, flip container state. */
export async function markDepletedIfZero(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params; // containerOpsId
    const { shelfId, slotId } = req.body;
    const data = await ContainerOpsService.markDepletedIfZero({ containerOpsId: id, shelfId, slotId });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}
