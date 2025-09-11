import { Request, Response, NextFunction } from "express";
import {
  createItem,
  getItemByItemId,
  listItems,
  updateItemByItemId,
  replaceItemByItemId,
  deleteItemByItemId,
} from "../services/items.service";
import { itemCategories } from "../models/Item.model";
import { Types } from "mongoose";

const ensureValidObjectId = (id: string) => Types.ObjectId.isValid(id);

export async function createItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    // ignore _id if client provides one — Mongo will create it
    if (req.body?._id) delete req.body._id;
    const doc = await createItem(req.body);
    res.status(201).json(doc);
  } catch (err) { next(err); }
}

export async function listItemsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      category, type, variety, q, minCalories, maxCalories,
      page, limit, sort,
    } = req.query;

    if (category && !itemCategories.includes(String(category) as any)) {
      return res.status(400).json({ message: `invalid category: ${category}` });
    }

    const toNum = (v: unknown) => (v != null ? Number(v) : undefined);
    const minC = toNum(minCalories);
    const maxC = toNum(maxCalories);
    if ((minC !== undefined && Number.isNaN(minC)) || (maxC !== undefined && Number.isNaN(maxC))) {
      return res.status(400).json({ message: "minCalories/maxCalories must be numbers" });
    }

    const data = await listItems(
      {
        category: category as any,
        type: typeof type === "string" ? type : undefined,
        variety: typeof variety === "string" ? variety : undefined,
        q: typeof q === "string" ? q : undefined,
        minCalories: minC,
        maxCalories: maxC,
      },
      {
        page: page != null ? Number(page) : undefined,
        limit: limit != null ? Number(limit) : undefined,
        sort: typeof sort === "string" ? sort : undefined,
        lean: true,
      }
    );

    res.json(data);
  } catch (err) { next(err); }
}

export async function getItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }
    const doc = await getItemByItemId(itemId);
    if (!doc) return res.status(404).json({ message: "Item not found" });
    res.json(doc);
  } catch (err) { next(err); }
}

// PATCH = partial update
export async function patchItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    // if client sends _id in body, enforce consistency or drop it
    if (req.body && req.body._id && String(req.body._id) !== itemId) {
      return res.status(400).json({ message: "Body _id must match path :itemId" });
    }
    if (req.body?._id) delete req.body._id;

    const updated = await updateItemByItemId(itemId, { $set: req.body }, { returnNew: true });
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  } catch (err) { next(err); }
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
    res.json(replaced);
  } catch (err) { next(err); }
}

export async function deleteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    if (!ensureValidObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }
    const { deletedCount } = await deleteItemByItemId(itemId);
    if (!deletedCount) return res.status(404).json({ message: "Item not found" });
    res.status(204).send();
  } catch (err) { next(err); }
}
