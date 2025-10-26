import { Request, Response } from "express";
import { Types } from "mongoose";
import * as svc from "../services/ItemPacking.service";
import ApiError from "../utils/ApiError";
import { itemCategories, type ItemCategory } from "../models/Item.model";

/**
 * GET /item-packings
 * Public (auth optional): use `authenticateIfPresent`
 */
export const list = async (req: Request, res: Response) => {
  const {
    page,
    limit,
    sort,
    populate,
    type,
    variety,
    category,
    itemId,
    fragility,
    allowMixing,
    requiresVentedBox,
  } = req.query;

  // Validate category (if provided) using the shared enum list
  let cat: ItemCategory | undefined = undefined;
  if (typeof category === "string") {
    if (!itemCategories.includes(category as ItemCategory)) {
      throw new ApiError(400, `invalid category: ${category}`);
    }
    cat = category as ItemCategory;
  }

  // Validate itemId (if provided)
  if (typeof itemId === "string" && itemId && !Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid itemId");
  }

  const data = await svc.list({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sort: sort as string | undefined,
    populate: String(populate ?? "") === "true",
    type: type as string | undefined,
    variety: variety as string | undefined,
    category: cat,
    itemId: itemId as string | undefined,
    fragility: fragility as any,
    allowMixing: allowMixing as any,
    requiresVentedBox: requiresVentedBox as any,
  });

  res.json(data);
};

/**
 * GET /item-packings/:id
 * For now we only support Mongo ObjectId.
 */
export const getOne = async (req: Request, res: Response) => {
  const { id } = req.params as { id?: string };
  if (!id) throw new ApiError(400, "Missing id");
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid id");
  const doc = await svc.getById(id, String(req.query.populate ?? "") === "true");
  res.json(doc);
};

/**
 * POST /item-packings
 * Protected: admin, dManager
 */
export const create = async (req: Request, res: Response) => {
  const created = await svc.create(req.body);
  res.status(201).json(created);
};

/**
 * PATCH /item-packings/:id
 * Protected: admin, dManager
 */
export const update = async (req: Request, res: Response) => {
  const { id } = req.params as { id?: string };
  if (!id) throw new ApiError(400, "Missing id");
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid id");
  const updated = await svc.update(id, req.body);
  res.json(updated);
};

/**
 * DELETE /item-packings/:id
 * Protected: admin, dManager
 */
export const remove = async (req: Request, res: Response) => {
  const { id } = req.params as { id?: string };
  if (!id) throw new ApiError(400, "Missing id");
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid id");
  const result = await svc.remove(id);
  res.json(result);
};
