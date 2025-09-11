import { Request, Response } from "express";
import mongoose from "mongoose";
import MapLayout from "../models/MapLayout.model";
import StorageBin from "../models/StorageBin.model";
import Item from "../models/Item.model";

const toObjectId = (s: string) => new mongoose.Types.ObjectId(s);

/** GET /api/centers/:centerId/map/:name
 *  Returns layout + inventory (joined with items)
 */
export async function getMap(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const name = req.params.name;

  const layout = await MapLayout.findOne({ center, name }).lean();
  if (!layout) return res.status(404).json({ error: "map not found" });

  const bins = await StorageBin.aggregate([
    { $match: { center, mapName: name } },
    { $lookup: { from: "items", localField: "itemId", foreignField: "_id", as: "item" } },
    { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
    { $project: {
        _id:0, code:1, current:1, start:1, updatedAt:1,
        "item._id":1, "item.name":1, "item.imageUrl":1, "item.category":1, "item.price":1
    } }
  ]);

  const inventory: Record<string, any> = {};
  for (const b of bins) {
    inventory[b.code] = {
      current: b.current ?? 0,
      start:   b.start ?? 100,
      itemId:  b.item?._id || null,
      item:    b.item || null,
      lastUpdated: b.updatedAt
    };
  }

  res.json({ ...layout, inventory });
}

/** PUT /api/centers/:centerId/map/:name
 *  Body: { zones: Zone[] }
 *  Upserts map layout for the center
 */
export async function upsertLayout(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const name = req.params.name;
  const zones = Array.isArray(req.body?.zones) ? req.body.zones : [];

  const doc = await MapLayout.findOneAndUpdate(
    { center, name },
    { center, name, zones },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(doc);
}

/** GET /api/centers/:centerId/map/:name/inventory
 *  Returns only inventory map: { [code]: { current, start, itemId, lastUpdated } }
 */
export async function getInventory(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const name = req.params.name;

  const bins = await StorageBin.find({ center, mapName: name })
    .select("code current start updatedAt itemId -_id").lean();

  const inventory: Record<string, any> = {};
  for (const b of bins) {
    inventory[b.code] = {
      current: b.current ?? 0,
      start:   b.start ?? 100,
      itemId:  b.itemId ?? null,
      lastUpdated: b.updatedAt
    };
  }
  res.json(inventory);
}

/** PUT /api/centers/:centerId/map/:name/inventory
 *  Body: { "1A1": { current, start, itemId? }, "2A7": {...}, ... }
 *  Bulk upsert inventory for many cells
 */
export async function bulkUpsertInventory(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const name = req.params.name;
  const payload = req.body || {};

  const ops = Object.entries(payload).map(([code, v]: any) => ({
    updateOne: {
      filter: { center, mapName: name, code },
      update: { $set: {
        current: v.current ?? 0,
        start:   v.start ?? 100,
        ...(v.itemId ? { itemId: v.itemId } : {})
      }},
      upsert: true
    }
  }));

  if (ops.length) await StorageBin.bulkWrite(ops);
  res.json({ ok: true, updated: ops.length });
}

/** PATCH /api/centers/:centerId/map/:name/locations/:code
 *  Body: { current?, start?, itemId? }
 *  Upserts a single cell
 */
export async function patchBin(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const name = req.params.name;
  const code = req.params.code;
  const { current, start, itemId } = req.body;

  const $set: any = {};
  if (current != null) $set.current = Number(current);
  if (start   != null) $set.start   = Number(start);
  if (itemId)          $set.itemId  = String(itemId);

  const doc = await StorageBin.findOneAndUpdate(
    { center, mapName: name, code },
    { $set },
    { upsert: true, new: true }
  );
  res.json({ ok: true, code: doc.code, current: doc.current, start: doc.start, itemId: doc.itemId });
}

/** GET /api/centers/:centerId/items/search?q=...
 *  Item search (by _id or name)
 */
export async function searchItems(req: Request, res: Response) {
  const q = `${req.query.q || ""}`.trim();
  if (!q) return res.json([]);
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const items = await Item.find({ $or:[ { _id:rx }, { name:rx } ] })
                          .select("_id name imageUrl category price")
                          .limit(20).lean();
  res.json(items);
}

/** GET /api/centers/:centerId/items/:itemId/locations
 *  Where is this item stored in this center? (all bins)
 */
export async function getItemLocations(req: Request, res: Response) {
  const center = toObjectId(req.params.centerId);
  const itemId = req.params.itemId;

  const bins = await StorageBin.find({ center, itemId })
    .select("mapName code current start updatedAt -_id")
    .sort({ mapName: 1, code: 1 })
    .lean();

  res.json({ itemId, bins });
}
