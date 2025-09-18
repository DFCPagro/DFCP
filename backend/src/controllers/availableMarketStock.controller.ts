import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { get } from './deliverer.controller';

import {
  findOrCreateAvailableMarketStock,
  getAvailableMarketStockByKey,
  listUpcomingAvailableMarketStock,
  adjustAvailableQtyAtomic,
  updateItemQtyStatusAtomic,
  nextFiveShiftsWithStock,
  getAvailableMarketStockById
} from "../services/availableMarketStock.service";

export async function initDoc(req: Request, res: Response) {
  try {
    const userId= req.user._id;
    const { LCid, date, shift } = req.body;
    const createdById = userId;
    if (!LCid || !date || !shift) return res.status(400).json({ error: "LCid, date, and shift are required" });

    const doc = await findOrCreateAvailableMarketStock({ LCid, date, shift, createdById });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to init available market stock" });
  }
}

export async function getDoc(req: Request, res: Response) {
  try {
    const { LCid, date, shift } = req.query as any;
    if (!LCid || !date || !shift) return res.status(400).json({ error: "LCid, date, and shift are required" });

    const doc = await getAvailableMarketStockByKey({ LCid, date, shift });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch available market stock" });
  }
}

/**
 * Get an AvailableMarketStock document by its _id (stock id).
 */
export async function getStockById(req: Request, res: Response) {
  try {
    const { docId } = req.params;
    if (!docId) {
      return res.status(400).json({ error: "docId is required" });
    }

    const stock = await getAvailableMarketStockById(docId);
    return res.json(stock);
  } catch (err: any) {
    return res.status(404).json({ error: err.message || "AvailableMarketStock not found" });
  }
}

export async function listUpcoming(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "");
    const count = req.query.count ? Number(req.query.count) : 5;
    const fromDate = (req.query.fromDate as string) || undefined;

    if (!LCid) return res.status(400).json({ error: "LCid is required" });

    const rows = await listUpcomingAvailableMarketStock({ LCid, count, fromDate });
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list upcoming available market stock" });
  }
}

export async function listNextFiveWithStock(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "");
    if (!LCid) return res.status(400).json({ error: "LCid is required" });

    const fromTs = req.query.fromTs ? Number(req.query.fromTs) : undefined;
    const rows = await nextFiveShiftsWithStock({ LCid, fromTs });
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list next five shifts with stock" });
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
 *  { ok: true, docId, lineId, newQty: number, status?: "soldout" }
 */
export async function adjustAvailableQty(req: Request, res: Response) {
  try {
    const { docId, lineId, deltaKg } = req.body ?? {};
    const enforceEnoughForReserve =
      req.body?.enforceEnoughForReserve === undefined ? true : !!req.body.enforceEnoughForReserve;
    const autoSoldoutOnZero =
      req.body?.autoSoldoutOnZero === undefined ? true : !!req.body.autoSoldoutOnZero;

    if (!docId || !lineId || typeof deltaKg !== "number" || !isFinite(deltaKg) || deltaKg === 0) {
      return res.status(400).json({ error: "docId, lineId, and non-zero numeric deltaKg are required" });
    }

    // Debug: log docId and lineId
    console.log("adjustAvailableQty: docId=", docId, "lineId=", lineId);

    // 1) Atomic adjust (clamped 0..original, and optionally enforced for reserves)
    await adjustAvailableQtyAtomic({ docId, lineId, deltaKg, enforceEnoughForReserve });

    // 2) Read back just this line to return the new quantity
    const _docId = new Types.ObjectId(docId);
    const _lineId = new Types.ObjectId(lineId);

    const doc = await AvailableMarketStockModel.findOne(
      { _id: _docId, "items._id": _lineId },
      { "items.$": 1 } // project only the matched subdoc
    ).lean();

    // Debug: log the result of the query
    console.log("adjustAvailableQty: doc after query=", JSON.stringify(doc));

    if (!doc || !doc.items?.length) {
      return res.status(404).json({ error: "Document or line not found after update" });
    }

    const line = doc.items[0];
    const newQty = Number(line.currentAvailableQuantityKg ?? 0);

    // 3) Optional: auto mark soldout if quantity hits 0
    let newStatus: "soldout" | undefined = undefined;
    if (autoSoldoutOnZero && newQty === 0 && line.status !== "soldout") {
      await updateItemQtyStatusAtomic({ docId, lineId, status: "soldout" });
      newStatus = "soldout";
    }

    return res.json({ ok: true, docId, lineId, newQty, ...(newStatus ? { status: newStatus } : {}) });
  } catch (err: any) {
    return res.status(409).json({ error: err.message || "Failed to adjust available quantity" });
  }
}
