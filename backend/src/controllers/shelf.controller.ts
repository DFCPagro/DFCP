// FILE: src/controllers/shelf.controller.ts
import { Request, Response, NextFunction } from "express";
import {ShelfService} from "../services/shelf.service";
import { CrowdService } from "../services/shelfCrowd.service";
import { isObjId } from "@/utils/validations/mongose";
import ApiError from "@/utils/ApiError";


const VALID_TYPES = ["warehouse", "picker", "delivery"] as const;

/**
 * List shelves by logistic center (optionally zone/type)
 * Route: GET /shelves?centerId=<id>&zone=A&type=picker
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { centerId, zone, type } = req.query as {
      centerId?: string;
      zone?: string;
      type?: string;
    };

    if (!centerId || !isObjId(centerId)) {
      return res.status(400).json({ ok: false, message: "Invalid or missing centerId" });
    }

    // (optional) harden type to a known set
    const allowed = new Set(["picker", "warehouse", "staging", "sorting", "out"]);
    const typeFilter = type && allowed.has(type.toLowerCase()) ? type.toLowerCase() : undefined;

    const data = await ShelfService.list({
      logisticCenterId: centerId,
      zone: zone || undefined,
      type: typeFilter,
    });

    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Keep controllers skinny:
 * - extract params/body
 * - call a service
 * - send uniform response shape
 */

export async function getShelf(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!isObjId(id)) {
      return res.status(400).json({ ok: false, message: "Invalid shelf id" });
    }
    const data = await ShelfService.getShelfWithCrowdScore(id);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function placeContainer(req: Request, res: Response, next: NextFunction) {
  try {
    const { shelfMongoId } = req.params;
    const { slotId, containerOpsId, weightKg } = req.body;
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfMongoId)) return res.status(400).json({ ok: false, message: "Invalid shelfMongoId" });
    if (!slotId || typeof slotId !== "string") return res.status(400).json({ ok: false, message: "Invalid slotId" });
    if (!isObjId(containerOpsId)) return res.status(400).json({ ok: false, message: "Invalid containerOpsId" });
    if (typeof weightKg !== "number" || Number.isNaN(weightKg) || weightKg < 0) {
      return res.status(400).json({ ok: false, message: "Invalid weightKg" });
    }

    const data = await ShelfService.placeContainer({
      shelfMongoId,
      slotId,
      containerOpsId,
      weightKg,
      userId,
    });

    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function consumeFromSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfMongoId, slotId } = req.params as { id: string; slotId: string };
    const { amountKg } = req.body as { amountKg: number };
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfMongoId)) return res.status(400).json({ ok: false, message: "Invalid shelf id" });
    if (!slotId || typeof slotId !== "string") return res.status(400).json({ ok: false, message: "Invalid slotId" });
    if (typeof amountKg !== "number" || !Number.isFinite(amountKg) || amountKg <= 0) {
      return res.status(400).json({ ok: false, message: "amountKg must be a positive number" });
    }

    const data = await ShelfService.consumeFromSlot({ shelfMongoId, slotId, amountKg, userId });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function moveContainer(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromShelfId, fromSlotId, toShelfId, toSlotId } = req.body as {
      fromShelfId: string;
      fromSlotId: string;
      toShelfId: string;
      toSlotId: string;
    };
    // @ts-ignore
    const userId = req.user?._id;

    if (![fromShelfId, toShelfId].every(isObjId)) {
      return res.status(400).json({ ok: false, message: "Invalid shelf ids" });
    }
    if (![fromSlotId, toSlotId].every((x) => typeof x === "string" && x)) {
      return res.status(400).json({ ok: false, message: "Invalid slot ids" });
    }

    const data = await ShelfService.moveContainer({ fromShelfId, fromSlotId, toShelfId, toSlotId, userId });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function crowdInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    if (!isObjId(shelfId)) return res.status(400).json({ ok: false, message: "Invalid shelf id" });

    const data = await CrowdService.computeShelfCrowd(shelfId);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markTaskStart(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    const { kind } = req.body as { kind: "pick" | "sort" | "audit" };
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfId)) return res.status(400).json({ ok: false, message: "Invalid shelf id" });
    if (!["pick", "sort", "audit"].includes(kind as any)) {
      return res.status(400).json({ ok: false, message: "Invalid kind (pick|sort|audit)" });
    }

    const data = await ShelfService.markShelfTaskStart({ shelfId, userId, kind });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function markTaskEnd(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfId } = req.params;
    const { kind } = req.body as { kind: "pick" | "sort" | "audit" };
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfId)) return res.status(400).json({ ok: false, message: "Invalid shelf id" });
    if (!["pick", "sort", "audit"].includes(kind as any)) {
      return res.status(400).json({ ok: false, message: "Invalid kind (pick|sort|audit)" });
    }

    const data = await ShelfService.markShelfTaskEnd({ shelfId, userId, kind });
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getNonCrowded(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit } = req.query as { limit?: string };
    const n = limit ? Number(limit) : 10;
    const data = await CrowdService.getNonCrowded(Number.isFinite(n) ? n : 10);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function refillFromWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    // @ts-ignore
    const user = req.user;
    const { pickerShelfId, pickerSlotId, warehouseShelfId, warehouseSlotId, targetFillKg } = req.body as {
      pickerShelfId: string;
      pickerSlotId: string;
      warehouseShelfId: string;
      warehouseSlotId: string;
      targetFillKg: number | string;
    };

    if (![pickerShelfId, warehouseShelfId].every(isObjId)) {
      return res.status(400).json({ ok: false, message: "Invalid shelf ids" });
    }
    if (![pickerSlotId, warehouseSlotId].every((x) => typeof x === "string" && x)) {
      return res.status(400).json({ ok: false, message: "Invalid slot ids" });
    }
    const tgt = Number(targetFillKg);
    if (!Number.isFinite(tgt) || tgt <= 0) {
      return res.status(400).json({ ok: false, message: "targetFillKg must be a positive number" });
    }

    const out = await ShelfService.refillFromWarehouse({
      pickerShelfId,
      pickerSlotId,
      warehouseShelfId,
      warehouseSlotId,
      targetFillKg: tgt,
      userId: user._id,
    });

    res.json({ ok: true, data: out });
  } catch (err) {
    next(err);
  }
}

export async function emptySlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: shelfMongoId } = req.params;
    const { slotId, toArea = "warehouse" } = req.body as { slotId: string; toArea?: "warehouse" | "out" };
    // @ts-ignore
    const userId = req.user?._id;

    if (!isObjId(shelfMongoId)) return res.status(400).json({ ok: false, message: "Invalid shelf id" });
    if (!slotId || typeof slotId !== "string") return res.status(400).json({ ok: false, message: "Invalid slotId" });
    if (!["warehouse", "out"].includes(toArea)) {
      return res.status(400).json({ ok: false, message: "Invalid toArea (warehouse|out)" });
    }

    const data = await ShelfService.emptySlot({ shelfMongoId, slotId, toArea, userId });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBestLocationForFO(req: Request, res: Response, next: NextFunction) {
  try {
    const { foId, type } = req.body ?? {};

    if (!foId || typeof foId !== "string") {
      throw new ApiError(400, "foId is required and must be a string");
    }
    if (!type || typeof type !== "string") {
      throw new ApiError(400, "type is required and must be a string");
    }
    const typeNorm = type.toLowerCase();
    if (!(VALID_TYPES as readonly string[]).includes(typeNorm)) {
      throw new ApiError(400, `Invalid type: '${type}'. Must be one of ${VALID_TYPES.join(", ")}`);
    }

    // Pass through any optional filters you support
    const {
      minKg,
      zone,
      centerId,
      excludeTemporarilyAvoid,
      maxBusyScore,
      preferTypes,
      originRow,
      originCol,
      demand, // if you added it
    } = req.body ?? {};

    const result = await ShelfService.findBestLocationForFO({
      foId,
      type: typeNorm as any, // narrowed above
      minKg,
      zone,
      centerId,
      excludeTemporarilyAvoid,
      maxBusyScore,
      preferTypes,
      originRow,
      originCol,
      demand,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

