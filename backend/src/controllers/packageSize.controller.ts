import { Request, Response, NextFunction } from "express";
import * as svc from "../services/packageSize.service";

// tiny async wrapper to bubble errors to your global handler
const ah =
  (fn: any) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const list = ah(async (req: Request, res: Response) => {
  const { page, limit, sort, q } = req.query;
  const data = await svc.listPackageSizes({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sort: typeof sort === "string" ? sort : undefined,
    q: typeof q === "string" ? q : undefined,
  });
  res.json(data);
});

export const getOne = ah(async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  const doc = await svc.getPackageSizeByIdOrKey(idOrKey);
  res.json(doc);
});

export const create = ah(async (req: Request, res: Response) => {
  const doc = await svc.createPackageSize(req.body);
  res.status(201).json(doc);
});

export const update = ah(async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  const doc = await svc.updatePackageSize(idOrKey, req.body);
  res.json(doc);
});

export const remove = ah(async (req: Request, res: Response) => {
  const { idOrKey } = req.params;
  await svc.deletePackageSize(idOrKey);
  res.status(204).send();
});
