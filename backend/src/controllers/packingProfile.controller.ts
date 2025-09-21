import { Request, Response } from "express";
import * as svc from "../services/packingProfile.service";
import ApiError from "../utils/ApiError";

/**
 * GET /packing-profiles
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

  const data = await svc.list({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sort: sort as string | undefined,
    populate: String(populate ?? "") === "true",
    type: type as string | undefined,
    variety: variety as string | undefined,
    category: category as "fruit" | "vegetable" | undefined,
    itemId: itemId as string | undefined,
    fragility: fragility as any,
    allowMixing: allowMixing as any,
    requiresVentedBox: requiresVentedBox as any,
  });

  res.json(data);
};

/**
 * GET /packing-profiles/:idOrKey
 * For now we only support Mongo ObjectId. Param kept as idOrKey for parity.
 */
export const getOne = async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  if (!idOrKey) throw new ApiError(400, "Missing id");
  const doc = await svc.getById(idOrKey, String(req.query.populate ?? "") === "true");
  res.json(doc);
};

/**
 * POST /packing-profiles
 * Protected: admin, dManager
 */
export const create = async (req: Request, res: Response) => {
  // req.body must conform to schema; Mongoose will validate.
  const created = await svc.create(req.body);
  res.status(201).json(created);
};

/**
 * PATCH /packing-profiles/:idOrKey
 * Protected: admin, dManager
 */
export const update = async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  if (!idOrKey) throw new ApiError(400, "Missing id");
  const updated = await svc.update(idOrKey, req.body);
  res.json(updated);
};

/**
 * DELETE /packing-profiles/:idOrKey
 * Protected: admin, dManager
 */
export const remove = async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  if (!idOrKey) throw new ApiError(400, "Missing id");
  const result = await svc.remove(idOrKey);
  res.json(result);
};
