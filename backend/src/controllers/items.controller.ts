import { Request, Response, NextFunction } from "express";
import ApiError from "@/utils/ApiError";
import {
  createItemWithPacking,
  getItemByItemId,
  listItems,
  updateItemByItemId,
  replaceItemByItemId,
  deleteItemByItemId,
  itemBenefits,
  marketItemPageData,
  listItemsWithPacking,
  getItemWithPackingById,
} from "../services/items.service";
import { itemCategories, PUBLIC_ITEM_PROJECTION } from "../models/Item.model";
import { Types } from "mongoose";

const ensureValidObjectId = (id: string) => Types.ObjectId.isValid(id);

// privileged = admin or fManager
const isPrivileged = (req: Request) => {
  // @ts-ignore injected by auth middleware
  const role: string | undefined = req.user?.role;
  return role === "admin" || role === "fManager";
};

// --- shaping helpers ---

/** Always return a plain object and ensure `_id` exists as a string. */
const toFullItem = (docOrObj: any) => {
  const obj = docOrObj && typeof docOrObj.toObject === "function" ? docOrObj.toObject() : docOrObj;
  if (obj && !("_id" in obj) && (docOrObj as any)?._id) {
    obj._id = String((docOrObj as any)._id);
  }
  if (obj && obj._id && typeof obj._id !== "string") {
    try { obj._id = String(obj._id); } catch {}
  }
  return obj;
};

/** Minimal public view (use `_id` instead of itemId) */
const toPublicItem = (req: Request, item: any) => {
  const id = String(item._id ?? item.itemId);
  const displayName = item.name ?? [item.type, item.variety].filter(Boolean).join(" ");
  const base = req.baseUrl || "/items";
  return {
    _id: id,
    displayName,
    category: item.category,
    itemUrl: `${base}/${id}`,
  };
};

// Extract details[] from a "ValidationError: a; b; c" message
function parseValidationDetails(err: any): string[] | null {
  if (err?.statusCode === 400 && typeof err?.message === "string" && err.message.startsWith("ValidationError")) {
    return err.message.replace(/^ValidationError:\s*/i, "").split(/\s*;\s*/).filter(Boolean);
  }
  return null;
}



function wantsPacking(req: Request) {
  return String((req.query as any)?.includePacking).toLowerCase() === "true";
}

async function respondPossiblyWithPacking(
  req: Request,
  res: Response,
  itemId: string,
  fallbackDocOrObj: any
) {
  const privileged = isPrivileged(req);
  if (privileged && wantsPacking(req)) {
    const obj = await getItemWithPackingById(itemId);
    if (!obj) return res.status(404).json({ message: "Item not found" });
    return res.json(toFullItem(obj)); // has `packing`
  }
  return res.json(toFullItem(fallbackDocOrObj));
}


// --- handlers ---

// CREATE (Item + ItemPacking) — packing is REQUIRED in body: { ...itemFields, packing: {...} }
export async function createItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = (req.body ?? {}) as any;
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "ValidationError", details: ["Body must be an object"] });
    }
    if (!body.packing || typeof body.packing !== "object") {
      return res.status(400).json({ error: "ValidationError", details: ["'packing' is required and must be an object"] });
    }
    if (body?._id) delete body._id;

    const created = await createItemWithPacking(body); // returns { item, packing }
    const itemId = String(created.item?._id);

    // Privileged + includePacking=true → return the aggregated view (uniform response)
    const privileged = isPrivileged(req);
    if (privileged && wantsPacking(req)) {
      const obj = await getItemWithPackingById(itemId);
      if (!obj) return res.status(404).json({ message: "Item not found after create" });
      return res.status(201).json(toFullItem(obj));
    }

    // default: keep existing (non-joined) response
    return res.status(201).json({
      ...toFullItem(created.item),
      packing: created.packing?.items?.[0]?.packing ?? created.packing, // optional convenience
    });
  } catch (err: any) {
    const details = parseValidationDetails(err);
    if (details) return res.status(400).json({ error: "ValidationError", details });
    next(err);
  }
}


export async function listItemsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      category, type, variety, q, minCalories, maxCalories,
      page, limit, sort,
    } = req.query as Record<string, string | undefined>;

    if (category && !itemCategories.includes(String(category) as any)) {
      return res.status(400).json({ message: `invalid category: ${category}` });
    }

    const toNum = (v: unknown) => (v != null ? Number(v) : undefined);
    const minC = toNum(minCalories);
    const maxC = toNum(maxCalories);
    if ((minC !== undefined && Number.isNaN(minC)) || (maxC !== undefined && Number.isNaN(maxC))) {
      return res.status(400).json({ message: "minCalories/maxCalories must be numbers" });
    }

    const privileged = isPrivileged(req);

    if (!privileged) {
      const data = await listItems(
        {
          category: category as any,
          type,
          variety,
          q,
          minCalories: minC,
          maxCalories: maxC,
        },
        {
          page: page != null ? Number(page) : undefined,
          limit: limit != null ? Number(limit) : undefined,
          sort: sort,
          projection: PUBLIC_ITEM_PROJECTION,
          lean: true,
        }
      );
      const items = data.items.map((it: any) => toPublicItem(req, it));
      return res.json({ ...data, items });
    }

    // privileged → always return with packing
    const data = await listItemsWithPacking(
      {
        category: category as any,
        type,
        variety,
        q,
        minCalories: minC,
        maxCalories: maxC,
      },
      {
        page: page != null ? Number(page) : undefined,
        limit: limit != null ? Number(limit) : undefined,
        sort: sort,
      }
    );
    const items = data.items.map(toFullItem);
    return res.json({ ...data, items });
  } catch (err) { next(err); }
}



export async function getItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const privileged = isPrivileged(req);

    if (!privileged) {
      const doc = await getItemByItemId(itemId, PUBLIC_ITEM_PROJECTION);
      if (!doc) return res.status(404).json({ message: "Item not found" });
      const obj = (doc as any).toObject ? (doc as any).toObject() : doc;
      return res.json(toPublicItem(req, obj));
    }

    const obj = await getItemWithPackingById(itemId);
    if (!obj) return res.status(404).json({ message: "Item not found" });
    return res.json(toFullItem(obj)); // includes packing
  } catch (err) { next(err); }
}



// PATCH = partial update
export async function patchItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    if (req.body && req.body._id && String(req.body._id) !== itemId) {
      return res.status(400).json({ message: "Body _id must match path :itemId" });
    }
    if (req.body?._id) delete req.body._id;

    const updated = await updateItemByItemId(itemId, { $set: req.body }, { returnNew: true });
    if (!updated) return res.status(404).json({ message: "Item not found" });

    // If privileged and asked for packing, return the joined view
    const privileged = isPrivileged(req);
    const wantsPacking =
      String((req.query as any)?.includePacking).toLowerCase() === "true";

    if (privileged && wantsPacking) {
      const obj = await getItemWithPackingById(itemId);
      if (!obj) return res.status(404).json({ message: "Item not found" });
      return res.json(toFullItem(obj)); // includes `packing` (or undefined if none)
    }

    // Default: return the updated item only
    res.json(toFullItem(updated));
  } catch (err: any) {
    const details = parseValidationDetails(err);
    if (details) return res.status(400).json({ error: "ValidationError", details });
    next(err);
  }
}


// PUT = full replace (idempotent)
export async function putItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    if (req.body && req.body._id && String(req.body._id) !== itemId) {
      return res.status(400).json({ message: "Body _id must match path :itemId" });
    }

    const replaced = await replaceItemByItemId(itemId, { ...req.body, _id: itemId });
    if (!replaced) return res.status(404).json({ message: "Item not found" });

    if (isPrivileged(req)) {
      const joined = await getItemWithPackingById(itemId);
      if (!joined) return res.status(404).json({ message: "Item not found" });
      return res.json(toFullItem(joined));
    }

    return res.json(toPublicItem(req, replaced));
  } catch (err: any) {
    const details = parseValidationDetails(err);
    if (details) return res.status(400).json({ error: "ValidationError", details });
    next(err);
  }
}



export async function deleteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const privileged = isPrivileged(req);
    let beforeJoin: any | null = null;

    if (privileged) {
      beforeJoin = await getItemWithPackingById(itemId); // snapshot
    }

    const { deletedCount } = await deleteItemByItemId(itemId);
    if (!deletedCount) return res.status(404).json({ message: "Item not found" });

    if (privileged) {
      return res.status(200).json({ deleted: true, item: beforeJoin ? toFullItem(beforeJoin) : null });
    }

    return res.status(204).send();
  } catch (err) { next(err); }
}




/*----for market ----*/
export async function getItemBenefits(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const data = await itemBenefits(itemId);
    if (!data) return res.status(404).json({ message: "Item not found" });

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function marketItemPage(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId, farmerUserId } = req.params;
    if (!ensureValidObjectId(itemId) || !ensureValidObjectId(farmerUserId)) {
      throw new ApiError(400, "itemId and farmerUserId are required and must be valid ObjectIds");
    }

    const data = await marketItemPageData(itemId, farmerUserId);
    if (!data) throw new ApiError(404, "Item or Farmer not found");

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
