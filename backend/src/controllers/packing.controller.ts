// src/controllers/packing.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import OrderModel from "../models/order.model";
import ItemModel from "../models/Item.model";
import PackageSizeModel from "../models/PackageSize";
import { computePackingForOrderDoc } from "../services/packing.service";

export async function postPackOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "InvalidOrderId" });
    }

    // 1) load order
    const order = await OrderModel.findById(id).lean();
    if (!order) return res.status(404).json({ error: "OrderNotFound" });

    // 2) load items referenced by the order
    const itemIds = Array.from(new Set((order.items || []).map((l: any) => String(l.itemId))));
    const items = await ItemModel.find({ _id: { $in: itemIds } })
      .select("_id category type variety avgWeightPerUnitGr")
      .lean();
    const itemsById = Object.fromEntries(items.map((it: any) => [String(it._id), it]));

    // 3) load all package sizes
    const packageSizes = await PackageSizeModel.find({})
      .select("key innerDimsCm headroomPct usableLiters maxWeightKg vented")
      .lean();

    // 4) compute the plan (stateless)
    const plan = computePackingForOrderDoc(order as any, itemsById as any, packageSizes as any);

    return res.json({ data: plan });
  } catch (err: any) {
    console.error("[postPackOrder] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
