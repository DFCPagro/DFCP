// controllers/deliveryShelving.controller.ts
import type { Request, Response } from "express";
import * as DeliveryShelving from "../services/deliveryShelving.service";

export async function stageOrder(req: Request, res: Response) {
  try {
    const { orderId, packageWeightKg } = req.body;
    const result = await DeliveryShelving.stageOrderToDelivererLane({ orderId, packageWeightKg });
    // result already contains what you need; just return it (or add ok once)
    res.json(result);
  } catch (e: any) {
    res.status(e?.status || 500).json({ ok: false, message: e?.message || "Failed to stage order" });
  }
}

export async function unstagePackage(req: Request, res: Response) {
  try {
    const { orderPackageId, packageWeightKg } = req.body;
    const result = await DeliveryShelving.unstageOrderPackage({ orderPackageId, packageWeightKg });
    res.json(result);
  } catch (e: any) {
    res.status(e?.status || 500).json({ ok: false, message: e?.message || "Failed to unstage package" });
  }
}

export async function moveStagedPackage(req: Request, res: Response) {
  try {
    const { orderPackageId, toDelivererId, toShelfId, toSlotId, packageWeightKg } = req.body;
    const result = await DeliveryShelving.moveStagedOrderPackage({
      orderPackageId,
      toDelivererId,
      toShelfId,
      toSlotId,
      packageWeightKg,
    });
    res.json(result);
  } catch (e: any) {
    res.status(e?.status || 500).json({ ok: false, message: e?.message || "Failed to move package" });
  }
}
