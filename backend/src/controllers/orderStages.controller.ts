// src/controllers/orderStages.controller.ts
import { Request, Response, NextFunction } from "express";
import { updateOrderStageStatusService } from "../services/orderStages.service";

export async function postUpdateOrderStage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orderId = req.params.orderId;
    const { stageKey, action, note } = req.body || {};

    // user injected by auth middleware
    const user = {
      _id: (req as any).user?._id,
      role: (req as any).user?.role,
      logisticCenterId: (req as any).user?.logisticCenterId,
      name: (req as any).user?.name,
    };

    const updated = await updateOrderStageStatusService({
      orderId,
      stageKey,
      action,
      note,
      user,
    });

    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
}
