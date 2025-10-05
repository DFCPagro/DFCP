// src/controllers/availableMarketStock.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";

import {
  AvailableMarketStockModel,
  type ItemStatus,
} from "../models/availableMarketStock.model";

import {
  findOrCreateAvailableMarketStock,
  getAvailableMarketStockByKey,
  listUpcomingAvailableMarketStock,
  adjustAvailableQtyAtomic,
  updateItemQtyStatusAtomic,
  nextFiveShiftsWithStock,
  getAvailableMarketStockById,
} from "../services/availableMarketStock.service";

/* --------------------------------- Types --------------------------------- */

type LeanMatchedItem = {
  _id: Types.ObjectId;
  currentAvailableQuantityKg: number;
  originalCommittedQuantityKg: number;
  status: ItemStatus;
  // new fields to surface
  pricePerKg?: number;
  unitMode?: {
    enabled: boolean;
    unitBundleSize: number;
    avgWeightPerUnitGr: number | null;
    sdWeightPerUnitGr: number;
    pricePerUnit: number | null;
    zScore: number;
    shrinkagePct: number;
    minUnitStep: number;
  };
  estimates?: { availableUnitsEstimate: number | null };
  farmLogo?: string | null;
};

type LeanMatchedDoc = {
  items: LeanMatchedItem[];
};

/* ------------------------------ Controllers ------------------------------ */

export async function initDoc(req: Request, res: Response) {
  try {
    const userId = (req as any).user?._id; // assumes auth middleware populates req.user
    const { LCid, date, shift } = req.body;
    const createdById = userId;

    if (!LCid || !date || !shift) {
      return res.status(400).json({ error: "LCid, date, and shift are required" });
    }

    const doc = await findOrCreateAvailableMarketStock({ LCid, date, shift, createdById });
    return res.json(doc);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message || "Failed to init available market stock" });
  }
}

export async function getDoc(req: Request, res: Response) {
  try {
    const { LCid, date, shift } = req.query as any;
    if (!LCid || !date || !shift) {
      return res.status(400).json({ error: "LCid, date, and shift are required" });
    }

    const doc = await getAvailableMarketStockByKey({ LCid, date, shift });
    if (!doc) return res.status(404).json({ error: "Not found" });

    // doc includes items[].pricePerKg, items[].unitMode, items[].estimates, items[].farmLogo, etc.
    return res.json(doc);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message || "Failed to fetch available market stock" });
  }
}

/** Get an AvailableMarketStock document by its _id (stock id). */
export async function getStockById(req: Request, res: Response) {
  try {
    const { docId } = req.params;
    if (!docId) {
      return res.status(400).json({ error: "docId is required" });
    }
    if (!Types.ObjectId.isValid(docId)) {
      return res.status(400).json({ error: "Invalid docId" });
    }

    const stock = await getAvailableMarketStockById(docId);
    return res.json(stock);
  } catch (err: any) {
    return res
      .status(404)
      .json({ error: err.message || "AvailableMarketStock not found" });
  }
}

export async function listUpcoming(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "");
    const count = req.query.count ? Number(req.query.count) : 5;
    const fromDate = (req.query.fromDate as string) || undefined;

    if (!LCid) return res.status(400).json({ error: "LCid is required" });

    const rows = await listUpcomingAvailableMarketStock({ LCid, count, fromDate });
    return res.json(rows);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message || "Failed to list upcoming available market stock" });
  }
}

export async function listNextFiveWithStock(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "66e007000000000000000001");
    if (!LCid) return res.status(400).json({ error: "LCid is required" });
    const fromTs = Date.now();

    console.log("listNextFiveWithStock for LCid", LCid, "fromTs", fromTs);
    const rows = await nextFiveShiftsWithStock({ LCid, fromTs });
    console.log("Found rows:", rows);
    return res.json(rows);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message || "Failed to list next five shifts with stock" });
  }
}

/**
 * Body:
 *  - docId: string (AvailableMarketStock _id)
 *  - lineId: string (subdocument _id in items[])
 *  - deltaKg: number (negative=reserve, positive=release)
 *  - enforceEnoughForReserve?: boolean (default true)
 *  - autoSoldoutOnZero?: boolean (default true)
 *
 * Response:
 *  {
 *    ok: true,
 *    docId,
 *    lineId,
 *    newQty: number,
 *    unitsLeft?: number | null,          // NEW: from estimates.availableUnitsEstimate
 *    status?: "soldout"
 *  }
 */
export async function adjustAvailableQty(req: Request, res: Response) {
  try {
    const { docId, lineId, deltaKg } = req.body ?? {};
    const enforceEnoughForReserve =
      req.body?.enforceEnoughForReserve === undefined
        ? true
        : !!req.body.enforceEnoughForReserve;
    const autoSoldoutOnZero =
      req.body?.autoSoldoutOnZero === undefined ? true : !!req.body.autoSoldoutOnZero;

    if (
      !docId ||
      !lineId ||
      typeof deltaKg !== "number" ||
      !isFinite(deltaKg) ||
      deltaKg === 0
    ) {
      return res
        .status(400)
        .json({ error: "docId, lineId, and non-zero numeric deltaKg are required" });
    }
    if (!Types.ObjectId.isValid(docId) || !Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: "Invalid docId or lineId" });
    }

    const _docId = new Types.ObjectId(docId);
    const _lineId = new Types.ObjectId(lineId);

    // 1) atomic adjust (service also best-effort refreshes units estimate)
    await adjustAvailableQtyAtomic({ docId, lineId, deltaKg, enforceEnoughForReserve });

    // 2) re-fetch the matched line with the new fields we care about
    const rows = await AvailableMarketStockModel.aggregate<
      {
        _id: Types.ObjectId;
        items: Array<LeanMatchedItem>;
      }
    >([
      { $match: { _id: _docId } },
      {
        $project: {
          items: {
            $filter: {
              input: "$items",
              as: "it",
              cond: { $eq: ["$$it._id", _lineId] },
            },
          },
        },
      },
      { $match: { "items.0": { $exists: true } } },
      // you can optionally $project subfields here to trim the payload
    ]);

    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "Document or line not found after update" });
    }

    const line = rows[0].items[0];
    const newQty = Number(line.currentAvailableQuantityKg ?? 0);
    const unitsLeft =
      line.estimates?.availableUnitsEstimate != null
        ? Number(line.estimates.availableUnitsEstimate)
        : null;

    // 3) optional auto-soldout on zero
    let newStatus: "soldout" | undefined = undefined;
    if (autoSoldoutOnZero && newQty === 0 && line.status !== "soldout") {
      await updateItemQtyStatusAtomic({ docId, lineId, status: "soldout" });
      newStatus = "soldout";
    }

    return res.json({
      ok: true,
      docId,
      lineId,
      newQty,
      unitsLeft, // NEW: lets frontend update "~units left" immediately
      ...(newStatus ? { status: newStatus } : {}),
    });
  } catch (err: any) {
    return res
      .status(409)
      .json({ error: err.message || "Failed to adjust available quantity" });
  }
}
