// src/controllers/farmerInventory.controller.ts
import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import * as service from "../services/farmerInventory.service";

/* ----------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------*/
function getUser(req: Request): {
  id: string;
  role?: string;
  logisticCenterId?: string;
} {
  const u = (req as any).user;
  if (!u?.id) throw new ApiError(401, "Unauthorized");
  return {
    id: String(u.id),
    role: u.role ? String(u.role) : undefined,
    logisticCenterId: String(u.logisticCenterId)
      ? String(u.logisticCenterId)
      : undefined,
  };
}

function isFarmer(role: string): boolean {
  return role === "farmer";
}

function sendNotFound(res: Response, entity = "FarmerInventory") {
  return res.status(404).json({ message: `${entity} not found` });
}

function mapMongoErrorToStatus(err: unknown): number | undefined {
  // Duplicate key error (unique index violations)
  // @ts-ignore - access if it looks like a MongoServerError
  if (err && (err as any).code === 11000) return 409;
  return undefined;
}

/* ----------------------------------------------------------------------------
 * Controllers
 * --------------------------------------------------------------------------*/

/**
 * GET /farmer/inventory
 * Query: farmerId?, itemId?, logisticCenterId?, page?, limit?
 */
export async function listInventory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, role, logisticCenterId } = getUser(req);

    // Filters
    const farmerId = (req.query.farmerId as string | undefined) ?? undefined;
    const itemId = (req.query.itemId as string | undefined) ?? undefined;

    // If caller is a farmer, force scope regardless of query

    // Pagination (optional)
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await service.listInventory(
      { farmerId, itemId, logisticCenterId },
      { page, limit }
    );

    // If your project typically returns { data, page, limit, total }, the service should shape it.
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /farmer/inventory/:id
 */
export async function getInventoryById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, role, logisticCenterId } = getUser(req);

    const doc = await service.getInventoryById(id);

    if (!doc) return sendNotFound(res);

    // Ownership check for farmer role (defense-in-depth; also enforce in service)
    if (isFarmer(role ?? "")) {
      const userFarmerId = req.user?.farmerId;
      // @ts-ignore - doc may be a Mongoose document; treat as any to access farmerId
      if (userFarmerId && doc.farmerId?.toString?.() !== userFarmerId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    return res.json(doc);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /farmer/inventory
 * Body: { farmerId, itemId, logisticCenterId?, agreementAmountKg?, currentAvailableAmountKg? }
 */
export async function createInventory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, role, logisticCenterId } = getUser(req);
    const body = req.body ?? {};

    // If caller is farmer, enforce/override farmerId to their own
    if (isFarmer(role ?? "")) {
      if (!logisticCenterId) {
        return res
          .status(400)
          .json({ message: "Authenticated farmer has no logisticCenterId" });
      }
      body.farmerId = req.user.farmerId;
    }

    const created = await service.createInventory(body);
    return res.status(201).json(created);
  } catch (err) {
    const mapped = mapMongoErrorToStatus(err);
    if (mapped)
      return res.status(mapped).json({ message: "Conflict", error: err });
    return next(err);
  }
}

/**
 * PATCH /farmer/inventory/:id
 * Body: subset of { agreementAmountKg, currentAvailableAmountKg, logisticCenterId? }
 */
export async function patchInventory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id, role, logisticCenterId } = getUser(req);
    const { reqId } = req.params;
    const patch = req.body ?? {};

    // If caller is farmer, ensure the target doc belongs to them (service will re-check)
    if (isFarmer(role ?? "")) {
      const doc = await service.getInventoryById(reqId);
      if (!doc) return sendNotFound(res);
      const userFarmerId = req.user?.farmerId;
      // @ts-ignore - doc may be a Mongoose document; treat as any to access farmerId
      if (userFarmerId && doc.farmerId?.toString?.() !== userFarmerId) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const updated = await service.updateInventoryById(reqId, patch);
    if (!updated) return sendNotFound(res);
    return res.json(updated);
  } catch (err) {
    const mapped = mapMongoErrorToStatus(err);
    if (mapped)
      return res.status(mapped).json({ message: "Conflict", error: err });
    return next(err);
  }
}
