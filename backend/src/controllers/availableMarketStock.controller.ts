import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import {
  findOrCreateAvailableMarketStock,
  getAvailableMarketStockByKey,
  listUpcomingAvailableMarketStock,
  addItemToAvailableMarketStock,
  updateItemQtyStatus,
  removeItemFromAvailableMarketStock,
  nextFiveShiftsWithStock,
} from "../services/availableMarketStock.service";

export async function initDoc(req: Request, res: Response) {
  try {
    
    const { LCid, date, shift } = req.body;
    const createdById = (req as any).userId ?? null; // if you set this in auth middleware
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

export async function listUpcoming(req: Request, res: Response) {
  try {
    const LCid = String(req.query.LCid || "");
    const count = req.query.count ? Number(req.query.count) : 6;
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

export async function addItem(req: Request, res: Response) {
  try {
    const { docId } = req.params;
    if (!docId) return res.status(400).json({ error: "docId is required" });

    const updated = await addItemToAvailableMarketStock({ docId, item: req.body });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add item" });
  }
}

export async function updateLine(req: Request, res: Response) {
  try {
    const { docId, lineId } = req.params;
    if (!docId || !lineId) return res.status(400).json({ error: "docId and lineId are required" });

    const { currentAvailableQuantityKg, status } = req.body;
    const updated = await updateItemQtyStatus({ docId, lineId, currentAvailableQuantityKg, status });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update line" });
  }
}

export async function removeLine(req: Request, res: Response) {
  try {
    const { docId, lineId } = req.params;
    if (!docId || !lineId) return res.status(400).json({ error: "docId and lineId are required" });

    const updated = await removeItemFromAvailableMarketStock({ docId, lineId });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove line" });
  }
}
