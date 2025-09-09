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

export async function createItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
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

    // lightweight validation
    if (category && !itemCategories.includes(String(category) as any)) {
      return res.status(400).json({ message: `invalid category: ${category}` });
    }

    const data = await listItems(
      {
        category: category as any,
        type: typeof type === "string" ? type : undefined,
        variety: typeof variety === "string" ? variety : undefined,
        q: typeof q === "string" ? q : undefined,
        minCalories: minCalories != null ? Number(minCalories) : undefined,
        maxCalories: maxCalories != null ? Number(maxCalories) : undefined,
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
    const doc = await getItemByItemId(itemId);
    if (!doc) return res.status(404).json({ message: "Item not found" });
    res.json(doc);
  } catch (err) { next(err); }
}

// PATCH = partial update
export async function patchItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const updated = await updateItemByItemId(itemId, { $set: req.body }, { returnNew: true });
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  } catch (err) { next(err); }
}

// PUT = full replace (idempotent)
export async function putItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const replaced = await replaceItemByItemId(itemId, req.body);
    if (!replaced) return res.status(404).json({ message: "Item not found" });
    res.json(replaced);
  } catch (err) { next(err); }
}

export async function deleteItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const { deletedCount } = await deleteItemByItemId(itemId);
    if (!deletedCount) return res.status(404).json({ message: "Item not found" });
    res.status(204).send();
  } catch (err) { next(err); }
}
