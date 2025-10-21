import { Request, Response, NextFunction } from "express";
import { ContainerOpsService } from "../services/containerOps.service";


export async function getByMongoId(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = await ContainerOpsService.getByMongoId(id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/** GET by business containerId */
export async function getByContainerId(req: Request, res: Response, next: NextFunction) {
  try {
    const { containerId } = req.params;
    const data = await ContainerOpsService.getByContainerId(containerId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

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
    const { id } = req.params;                 // containerOpsId (Mongo _id)
    const { shelfMongoId, slotId } = req.body; // note the rename
    const actorUserId = (req as any).user?.id; // or however you attach it
    const data = await ContainerOpsService.markDepletedIfZero({ containerOpsId: id, shelfMongoId, slotId, actorUserId });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}
