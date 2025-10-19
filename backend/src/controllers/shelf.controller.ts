import { Request, Response, NextFunction } from "express";

import * as svc from "../services/shelf.service";


import { CrowdService } from "../services/shelfCrowd.service";
import { isObjId } from "@/utils/validations/mongose";

/**
 * Keep controllers skinny:
 * - extract params/body
 * - call a service
 * - send uniform response shape
 */

export async function getShelf(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = await svc.ShelfService.getShelfWithCrowdScore(id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function placeContainer(req: Request, res: Response, next: NextFunction) {
  try {
    const { shelfMongoId } = req.params;
    const { slotId, containerOpsId, weightKg } = req.body;
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfMongoId)) {
      return res.status(400).json({ ok: false, message: "Invalid shelfMongoId" });
    }
    if (!slotId || typeof slotId !== "string") {
      return res.status(400).json({ ok: false, message: "Invalid slotId" });
    }
    if (!isObjId(containerOpsId)) {
      return res.status(400).json({ ok: false, message: "Invalid containerOpsId" });
    }
    if (typeof weightKg !== "number" || Number.isNaN(weightKg) || weightKg < 0) {
      return res.status(400).json({ ok: false, message: "Invalid weightKg" });
    }

    const data = await svc.ShelfService.placeContainer({
      shelfMongoId,
      slotId,
      containerOpsId,
      weightKg,
      userId,
    });

    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}


export async function consumeFromSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfMongoId } = req.params;
    const { slotId } = req.params as any;
    const { amountKg } = req.body;
    // @ts-ignore
    const userId = req.user?._id;
    const data = await svc.ShelfService.consumeFromSlot({ shelfMongoId, slotId, amountKg, userId });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function moveContainer(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromShelfId, fromSlotId, toShelfId, toSlotId } = req.body;
    // @ts-ignore
    const userId = req.user?._id;
    const data = await svc.ShelfService.moveContainer({ fromShelfId, fromSlotId, toShelfId, toSlotId, userId });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function crowdInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    const data = await CrowdService.computeShelfCrowd(shelfId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function markTaskStart(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    const { kind } = req.body; // 'pick' | 'sort' | 'audit'
    // @ts-ignore
    const userId = req.user?._id;
    const data = await svc.ShelfService.markShelfTaskStart({ shelfId, userId, kind });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function markTaskEnd(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    const { kind } = req.body;
    // @ts-ignore
    const userId = req.user?._id;
    const data = await svc.ShelfService.markShelfTaskEnd({ shelfId, userId, kind });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getNonCrowded(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = req.query as any;
    const data = await CrowdService.getNonCrowded(limit ? Number(limit) : 10);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function refillFromWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const { pickerShelfId, pickerSlotId, warehouseShelfId, warehouseSlotId, targetFillKg } = req.body;

    const out = await svc.ShelfService.refillFromWarehouse({
      pickerShelfId,
      pickerSlotId,
      warehouseShelfId,
      warehouseSlotId,
      targetFillKg: Number(targetFillKg),
      userId: user._id,
    });

    res.json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

export async function emptySlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfMongoId } = req.params;
    const { slotId, toArea = "warehouse" } = req.body; // "warehouse" | "out"
    // @ts-ignore
    const userId = req.user?._id;
    const data = await svc.ShelfService.emptySlot({ shelfMongoId, slotId, toArea, userId });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
}
