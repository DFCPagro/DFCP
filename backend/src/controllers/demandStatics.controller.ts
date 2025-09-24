import { Request, Response } from "express";
import {
  bulkImportRaw,
  createSlot,
  getBySlotKey,
  listSlots,
  normalizeBody,
  removeSlot,
  replaceItems,
  upsertSlot,
} from "../services/demandStatics.service";
import { DemandStaticsModel } from "../models/DemandStatics.model";
import ApiError from "../utils/ApiError";

export async function getSlots(req: Request, res: Response) {
  const { page, limit, day, part } = req.query as Record<string, string>;
  const data = await listSlots({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    day,
    part,
  });
  res.json(data);
}

export async function getSlot(req: Request, res: Response) {
  const { slotKey } = req.params;
  const doc = await getBySlotKey(slotKey);
  res.json(doc);
}

export async function postSlot(req: Request, res: Response) {
  const data = normalizeBody(req.body);
  const doc = await createSlot(data);
  res.status(201).json(doc);
}

export async function putSlot(req: Request, res: Response) {
  const data = normalizeBody(req.body);
  const doc = await upsertSlot(data);
  res.json(doc);
}

export async function patchSlotItems(req: Request, res: Response) {
  const { slotKey } = req.params;
  const { items } = req.body ?? {};
  if (!Array.isArray(items)) throw new ApiError(400, "`items` must be an array");
  const doc = await replaceItems(slotKey, items);
  res.json(doc);
}

export async function deleteSlot(req: Request, res: Response) {
  const { slotKey } = req.params;
  const deleted = await removeSlot(slotKey);
  res.json({ deleted });
}

export async function importRaw(req: Request, res: Response) {
  const result = await bulkImportRaw(req.body);
  res.json(result);
}

/** Optional: return the original dynamic-key shape (without populate transform) */
export async function getSlotRaw(req: Request, res: Response) {
  const { slotKey } = req.params;
  const doc = await DemandStaticsModel.findOne({ slotKey: slotKey.toLowerCase() }).lean();
  if (!doc) throw new ApiError(404, "Slot not found");
  const raw = DemandStaticsModel.toRaw(doc as any);
  res.json(raw);
}
