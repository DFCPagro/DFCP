// src/controllers/packing.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import OrderModel from "../models/order.model";
import ItemModel from "../models/Item.model";
import PackageSizeModel from "../models/PackageSize";
import ItemPackingModel from "../models/ItemPacking";
import {
  computePackingForOrderDoc,
  type ItemLite,
  type PackageSizeLite,
  type ItemPackingById,
  type ItemPackingOverride,
} from "../services/packing.service";

export async function postPackOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "InvalidOrderId" });
    }

    // 1) Load order
    const order = await OrderModel.findById(id).lean();
    if (!order) return res.status(404).json({ error: "OrderNotFound" });

    // 2) Load items (include name)
    const itemIds = Array.from(new Set((order.items || []).map((l: any) => String(l.itemId))));
    const items = await ItemModel.find({ _id: { $in: itemIds } })
      .select("_id name category type variety avgWeightPerUnitGr")
      .lean();

    const itemsById: Record<string, ItemLite> = Object.fromEntries(
      items.map((it: any) => [String(it._id), it as ItemLite])
    );

    // 3) Load package sizes
    const packageSizes = (await PackageSizeModel.find({})
      .select("key innerDimsCm headroomPct usableLiters maxWeightKg vented maxSkusPerBox mixingAllowed")
      .lean()) as unknown as PackageSizeLite[];

    // 4) Build ItemPacking overrides map
    const overridesById: ItemPackingById = {};
    if (itemIds.length > 0) {
      const idsAsObj = itemIds.filter(mongoose.isValidObjectId).map(x => new mongoose.Types.ObjectId(x));

      if (idsAsObj.length > 0) {
        const ipDocs = await ItemPackingModel.find({
          "items.itemId": { $in: idsAsObj },
        })
          .select([
            "items.itemId",
            "items.packing.fragility",
            "items.packing.allowMixing",
            "items.packing.requiresVentedBox",
            "items.packing.minBoxType",
            "items.packing.maxWeightPerPackageKg",
            "items.packing.maxKgPerBag",
            "items.packing.densityKgPerL",
            "items.packing.unitVolLiters",
          ].join(" "))
          .lean();

        for (const doc of ipDocs || []) {
          for (const it of (doc as any).items || []) {
            const key = String(it.itemId);
            const p = it?.packing || {};
            const ov: ItemPackingOverride = {};
            if (p.fragility) ov.fragility = p.fragility;
            if (typeof p.allowMixing === "boolean") ov.allowMixing = p.allowMixing;
            if (typeof p.requiresVentedBox === "boolean") ov.requiresVentedBox = p.requiresVentedBox;
            if (p.minBoxType) ov.minBoxType = p.minBoxType;
            if (typeof p.maxWeightPerPackageKg === "number") ov.maxWeightPerPackageKg = p.maxWeightPerPackageKg;
            if (typeof p.maxKgPerBag === "number") ov.maxKgPerBag = p.maxKgPerBag;
            if (typeof p.densityKgPerL === "number") ov.densityKgPerL = p.densityKgPerL;
            if (typeof p.unitVolLiters === "number") ov.unitVolLiters = p.unitVolLiters;

            overridesById[key] = { ...(overridesById[key] || {}), ...ov };
          }
        }
      }
    }

    // 5) Compute the plan (4th arg is optional)
    const plan = computePackingForOrderDoc(
      order as any,
      itemsById,
      packageSizes,
      overridesById
    );
    //console.log("Packing plan computed:", plan[0].contents);
    return res.json({ data: plan });
  } catch (err: any) {
    console.error("[postPackOrder] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
