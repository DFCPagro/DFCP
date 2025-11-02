// controllers/deliveryLookup.controller.ts
import { Request, Response } from "express";
import Shelf from "../models/Shelf.model";
import ApiError from "../utils/ApiError";

export async function getDeliveryShelfForDeliverer(req: Request, res: Response) {
  try {
    const { centerId, delivererId } = req.query as any;
    if (!centerId || !delivererId) throw new ApiError(400, "centerId and delivererId are required");

    const shelf = await Shelf.findOne({
      logisticCenterId: centerId,
      isDeliveryShelf: true,
      assignedDelivererId: delivererId,
    }).lean();

    if (!shelf) return res.status(404).json({ ok: false, error: "No shelf found" });
    res.json({ ok: true, shelf });
  } catch (e: any) {
    const status = e.statusCode || 500;
    res.status(status).json({ ok: false, error: e?.message || "Lookup failed" });
  }
}
