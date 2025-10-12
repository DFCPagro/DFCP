// src/controllers/availableMarketStock.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";

import ApiError from "../utils/ApiError";

import {
  AvailableMarketStockModel,
  type ItemStatus,
  type UnitMode,
  type AmsItem,
} from "../models/availableMarketStock.model";

import {
  findOrCreateAvailableMarketStock,
  getAvailableMarketStockByKey,
  listUpcomingAvailableMarketStock,
  adjustAvailableQtyAtomic,          // by KG
  adjustAvailableQtyByUnitsAtomic,   // by UNITS
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

  // model-aligned fields:
  unitMode: UnitMode; // "kg" | "unit" | "mixed"
  estimates?: {
    avgWeightPerUnitKg: number | null;
    sdKg: number | null;
    unitBundleSize?: number;
    zScore?: number;
    shrinkagePct?: number;
    availableUnitsEstimate: number | null;
  };
  pricePerUnit?: number;       // legacy per-line price (derived/override)
  farmLogo?: string | null;
};

type LeanMatchedDoc = {
  items: LeanMatchedItem[];
};

/* ------------------------------ Helpers ------------------------------ */

async function getSingleLineFromDoc(docId: string, lineId: string) {
  const _docId = new Types.ObjectId(docId);
  const _lineId = new Types.ObjectId(lineId);

  const rows = await AvailableMarketStockModel.aggregate<LeanMatchedDoc>([
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
    // Optionally trim subfields here:
    {
      $project: {
        "items._id": 1,
        "items.currentAvailableQuantityKg": 1,
        "items.originalCommittedQuantityKg": 1,
        "items.status": 1,
        "items.unitMode": 1,
        "items.estimates": 1,
        "items.pricePerUnit": 1,
        "items.farmLogo": 1,
      },
    },
  ]);

  if (!rows.length) return null;
  return rows[0].items[0];
}

async function respondAfterAdjust({
  res,
  docId,
  lineId,
  autoSoldoutOnZero,
}: {
  res: Response;
  docId: string;
  lineId: string;
  autoSoldoutOnZero: boolean;
}) {
  const line = await getSingleLineFromDoc(docId, lineId);
  if (!line) {
    return res
      .status(404)
      .json({ error: "Document or line not found after update" });
  }

  const newQty = Number(line.currentAvailableQuantityKg ?? 0);
  const unitsLeft =
    line.estimates?.availableUnitsEstimate != null
      ? Number(line.estimates.availableUnitsEstimate)
      : null;

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
    unitsLeft, // lets frontend update "~units left"
    ...(newStatus ? { status: newStatus } : {}),
  });
}

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

    // doc includes items[].unitMode (string), items[].estimates.*, items[].farmLogo, etc.
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
 * Adjust by KG
 * Body:
 *  - docId: string (AvailableMarketStock _id)
 *  - lineId: string (subdocument _id in items[])
 *  - deltaKg: number (negative=reserve, positive=release; non-zero)
 *  - enforceEnoughForReserve?: boolean (default true)
 *  - autoSoldoutOnZero?: boolean (default true)
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

    await adjustAvailableQtyAtomic({ docId, lineId, deltaKg, enforceEnoughForReserve });

    return respondAfterAdjust({ res, docId, lineId, autoSoldoutOnZero });
  } catch (err: any) {
    return res
      .status(409)
      .json({ error: err.message || "Failed to adjust available quantity" });
  }
}

/**
 * Adjust by UNITS
 * Body:
 *  - docId: string
 *  - lineId: string
 *  - unitsDelta: number (negative=reserve, positive=release; NATURAL & bundle-aligned enforced)
 *  - enforceEnoughForReserve?: boolean (default true)
 *  - autoSoldoutOnZero?: boolean (default true)
 */
export async function adjustAvailableQtyByUnits(req: Request, res: Response) {
  try {
    const { docId, lineId, unitsDelta } = req.body ?? {};
    const enforceEnoughForReserve =
      req.body?.enforceEnoughForReserve === undefined
        ? true
        : !!req.body.enforceEnoughForReserve;
    const autoSoldoutOnZero =
      req.body?.autoSoldoutOnZero === undefined ? true : !!req.body.autoSoldoutOnZero;

    if (
      !docId ||
      !lineId ||
      typeof unitsDelta !== "number" ||
      !isFinite(unitsDelta) ||
      unitsDelta === 0
    ) {
      return res
        .status(400)
        .json({ error: "docId, lineId, and non-zero numeric unitsDelta are required" });
    }
    if (!Types.ObjectId.isValid(docId) || !Types.ObjectId.isValid(lineId)) {
      return res.status(400).json({ error: "Invalid docId or lineId" });
    }

    await adjustAvailableQtyByUnitsAtomic({
      docId,
      lineId,
      unitsDelta,
      enforceEnoughForReserve,
    });

    return respondAfterAdjust({ res, docId, lineId, autoSoldoutOnZero });
  } catch (err: any) {
    return res
      .status(409)
      .json({ error: err.message || "Failed to adjust available quantity by units" });
  }
}
