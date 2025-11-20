// src/controllers/availableMarketStock.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";

import ApiError from "../utils/ApiError";
import LogisticCenter from "../models/logisticsCenter.model";

import {
  AvailableMarketStockModel,
  type ItemStatus,
  type UnitMode,
  // type AmsItem, // not needed directly here
} from "../models/availableMarketStock.model";

import {
  findOrCreateAvailableMarketStock,
  getAvailableMarketStockByKey,
  listUpcomingAvailableMarketStock,
  // FO-centric adjusters:
  adjustAvailableKgByFOAtomic, // by KG using farmerOrderId
  adjustAvailableUnitsByFOAtomic, // by UNITS using farmerOrderId
  updateItemQtyStatusAtomic, // now accepts farmerOrderId
  nextFiveShiftsWithStock,
  getAvailableMarketStockById,
} from "../services/availableMarketStock.service";

/* --------------------------------- Types --------------------------------- */

type LeanMatchedItemFO = {
  // no _id (subdoc has _id: false)
  farmerOrderId: Types.ObjectId | null;

  currentAvailableQuantityKg: number;
  originalCommittedQuantityKg: number;
  status: ItemStatus;

  unitMode: UnitMode; // "kg" | "unit" | "mixed"
  estimates?: {
    avgWeightPerUnitKg: number | null;
    sdKg: number | null;
    unitBundleSize?: number;
    zScore?: number;
    shrinkagePct?: number;
    availableUnitsEstimate: number | null;
  };
  pricePerUnit?: number | null;
  farmLogo?: string | null;
};

type LeanMatchedDocFO = {
  items: LeanMatchedItemFO[];
};

/* ------------------------------ Helpers ------------------------------ */

async function getSingleLineByFO(docId: string, farmerOrderId: string) {
  const _docId = new Types.ObjectId(docId);
  const _foId = new Types.ObjectId(farmerOrderId);

  const rows = await AvailableMarketStockModel.aggregate<LeanMatchedDocFO>([
    { $match: { _id: _docId } },
    {
      $project: {
        items: {
          $filter: {
            input: "$items",
            as: "it",
            cond: { $eq: ["$$it.farmerOrderId", _foId] },
          },
        },
      },
    },
    { $match: { "items.0": { $exists: true } } },
    {
      $project: {
        "items.farmerOrderId": 1,
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

async function respondAfterAdjustFO({
  res,
  docId,
  farmerOrderId,
  autoSoldoutOnZero,
}: {
  res: Response;
  docId: string;
  farmerOrderId: string;
  autoSoldoutOnZero: boolean;
}) {
  const line = await getSingleLineByFO(docId, farmerOrderId);
  if (!line) {
    return res
      .status(404)
      .json({ error: "Document or farmerOrder line not found after update" });
  }

  const newQty = Number(line.currentAvailableQuantityKg ?? 0);
  const unitsLeft =
    line.estimates?.availableUnitsEstimate != null
      ? Number(line.estimates.availableUnitsEstimate)
      : null;

  let newStatus: "soldout" | undefined = undefined;
  if (autoSoldoutOnZero && newQty === 0 && line.status !== "soldout") {
    await updateItemQtyStatusAtomic({
      docId,
      farmerOrderId,
      status: "soldout",
    });
    newStatus = "soldout";
  }

  return res.json({
    ok: true,
    docId,
    farmerOrderId,
    newQty,
    unitsLeft, // lets frontend update "~units left"
    ...(newStatus ? { status: newStatus } : {}),
  });
}

/* ------------------------------ Controllers ------------------------------ */

export async function initDoc(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const LCid = user.logisticCenterId; // keep as you had when it worked
    const { date, shift } = req.body;
    const createdById = user._id;

    console.log(
      "initDoc called by user",
      user._id,
      "for LCid",
      LCid,
      "date",
      date,
      "shift",
      shift
    );

    if (!LCid || !date || !shift) {
      return res
        .status(400)
        .json({ error: "LCid, date, and shift are required" });
    }

    const doc = await findOrCreateAvailableMarketStock({
      LCid,
      date,
      shift,
      createdById,
    });
    console.log("findOrCreateAvailableMarketStock result:", doc);

    // --- normalize for the FE ---
    const obj =
      typeof (doc as any)?.toObject === "function"
        ? (doc as any).toObject({ virtuals: true })
        : doc;

    const id =
      (obj?._id?.toString?.() as string) ??
      (typeof obj?._id === "string" ? obj._id : undefined) ??
      (typeof obj?.id === "string" ? obj.id : undefined);

    if (!id) {
      return res.status(500).json({ error: "Failed to serialize AMS id" });
    }

    const availableDate = new Date(obj.availableDate)
      .toISOString()
      .slice(0, 10);
    const payload = {
      id,
      availableDate,
      availableShift: obj.availableShift,
      items: Array.isArray(obj.items) ? obj.items : [],
    };

    return res.json(payload); // << send clean DTO (id as string, date normalized)
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to init available market stock" });
  }
}

export async function getDoc(req: Request, res: Response) {
  try {
    const { LCid, date, shift } = req.query as any;
    if (!LCid || !date || !shift) {
      return res
        .status(400)
        .json({ error: "LCid, date, and shift are required" });
    }

    const doc = await getAvailableMarketStockByKey({ LCid, date, shift });
    if (!doc) return res.status(404).json({ error: "Not found" });

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

    const rows = await listUpcomingAvailableMarketStock({
      LCid,
      count,
      fromDate,
    });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to list upcoming available market stock",
    });
  }
}

export async function listNextFiveWithStock(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "66e007000000000000000001");
    if (!LCid) return res.status(400).json({ error: "LCid is required" });
    const fromTs = Date.now();

    // console.log("listNextFiveWithStock for LCid", LCid, "fromTs", fromTs);
    const rows = await nextFiveShiftsWithStock({ LCid, fromTs });
    // console.log("Found rows:", rows);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Failed to list next five shifts with stock",
    });
  }
}

/**
 * Adjust by KG (FO-centric)
 * Body:
 *  - docId: string (AvailableMarketStock _id)
 *  - farmerOrderId: string (unique per item line)
 *  - deltaKg: number (negative=reserve, positive=release; non-zero)
 *  - enforceEnoughForReserve?: boolean (default true)
 *  - autoSoldoutOnZero?: boolean (default true)
 */
export async function adjustAvailableQty(req: Request, res: Response) {
  try {
    const { docId, farmerOrderId, deltaKg } = req.body ?? {};
    const enforceEnoughForReserve =
      req.body?.enforceEnoughForReserve === undefined
        ? true
        : !!req.body.enforceEnoughForReserve;
    const autoSoldoutOnZero =
      req.body?.autoSoldoutOnZero === undefined
        ? true
        : !!req.body.autoSoldoutOnZero;

    if (
      !docId ||
      !farmerOrderId ||
      typeof deltaKg !== "number" ||
      !isFinite(deltaKg) ||
      deltaKg === 0
    ) {
      return res.status(400).json({
        error:
          "docId, farmerOrderId, and non-zero numeric deltaKg are required",
      });
    }
    if (
      !Types.ObjectId.isValid(docId) ||
      !Types.ObjectId.isValid(farmerOrderId)
    ) {
      return res.status(400).json({ error: "Invalid docId or farmerOrderId" });
    }

    await adjustAvailableKgByFOAtomic({
      docId,
      farmerOrderId,
      deltaKg,
      enforceEnoughForReserve,
    });

    return respondAfterAdjustFO({
      res,
      docId,
      farmerOrderId,
      autoSoldoutOnZero,
    });
  } catch (err: any) {
    return res
      .status(409)
      .json({ error: err.message || "Failed to adjust available quantity" });
  }
}

/**
 * Adjust by UNITS (FO-centric)
 * Body:
 *  - docId: string
 *  - farmerOrderId: string
 *  - unitsDelta: number (negative=reserve, positive=release; NATURAL & bundle-aligned enforced)
 *  - enforceEnoughForReserve?: boolean (default true)
 *  - autoSoldoutOnZero?: boolean (default true)
 */
export async function adjustAvailableQtyByUnits(req: Request, res: Response) {
  try {
    const { docId, farmerOrderId, unitsDelta } = req.body ?? {};
    const enforceEnoughForReserve =
      req.body?.enforceEnoughForReserve === undefined
        ? true
        : !!req.body.enforceEnoughForReserve;
    const autoSoldoutOnZero =
      req.body?.autoSoldoutOnZero === undefined
        ? true
        : !!req.body.autoSoldoutOnZero;

    if (
      !docId ||
      !farmerOrderId ||
      typeof unitsDelta !== "number" ||
      !isFinite(unitsDelta) ||
      unitsDelta === 0
    ) {
      return res.status(400).json({
        error:
          "docId, farmerOrderId, and non-zero numeric unitsDelta are required",
      });
    }
    if (
      !Types.ObjectId.isValid(docId) ||
      !Types.ObjectId.isValid(farmerOrderId)
    ) {
      return res.status(400).json({ error: "Invalid docId or farmerOrderId" });
    }

    await adjustAvailableUnitsByFOAtomic({
      docId,
      farmerOrderId,
      unitsDelta,
      enforceEnoughForReserve,
    });

    return respondAfterAdjustFO({
      res,
      docId,
      farmerOrderId,
      autoSoldoutOnZero,
    });
  } catch (err: any) {
    return res.status(409).json({
      error: err.message || "Failed to adjust available quantity by units",
    });
  }
}
