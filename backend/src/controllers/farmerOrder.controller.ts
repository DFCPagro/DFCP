// src/controllers/farmerOrder.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { DateTime } from "luxon";
import ShiftConfig from "../models/shiftConfig.model";
import {
  createFarmerOrderService,
  updateFarmerStatusService,
  farmerOrdersSummary,
  listFarmerOrdersForShift,
  listMyFarmerOrdersService,
  ensureFarmerOrderPrintPayloadService,
  initContainersForFarmerOrderService,
  patchContainerWeightsService,
} from "../services/farmerOrder.service";

import type { AuthUser } from "../services/farmerOrderStages.service";
// helpers (put near top of the controller file)
const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const fromEnum = <T extends readonly string[]>(
  v: unknown,
  allowed: T
): T[number] | undefined => {
  if (typeof v !== "string") return undefined;
  return (allowed as readonly string[]).includes(v)
    ? (v as T[number])
    : undefined;
};

// enums for narrowing
const FARMER_STATUSES = ["pending", "ok", "problem"] as const;
type FarmerStatus = (typeof FARMER_STATUSES)[number];

const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type ShiftName = (typeof SHIFTS)[number];

const WINDOWS = ["future", "past", "all"] as const;
type WindowOpt = (typeof WINDOWS)[number];

/** POST /api/farmer-orders */
export async function create(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthUser | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const data = await createFarmerOrderService(req.body ?? {}, user);
    return res.status(201).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest")
      return res
        .status(400)
        .json({ error: "Validation failed", details: err.details });
    if (err?.name === "Forbidden")
      return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.name === "ValidationError")
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    console.error("FarmerOrder.create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/farmer-orders/:id/containers/init
 * body: { count }
 */
export async function initContainersForFarmerOrder(
  req: Request,
  res: Response
) {
  try {
    const user = (req as any).user as { id: string; role: string } | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const farmerOrderId = String(req.params.id || "");
    const count = Number((req.body ?? {}).count);
    if (!Number.isInteger(count) || count <= 0)
      return res
        .status(400)
        .json({ error: "count must be a positive integer" });

    const data = await initContainersForFarmerOrderService({
      farmerOrderId,
      count,
      user: {
        userId: new Types.ObjectId(user.id),
        role: String(user.role || ""),
      },
    });

    return res.status(201).json({ data });
  } catch (err: any) {
    if (err?.status === 403 || err?.name === "Forbidden")
      return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.status === 404 || err?.name === "NotFound")
      return res.status(404).json({ error: "FarmerOrder not found" });
    if (err?.status === 400 || err?.name === "BadRequest")
      return res.status(400).json({
        error: err.message || "Bad request",
        details: err.details,
      });
    console.error("initContainersForFarmerOrder error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * PATCH /api/farmer-orders/:id/containers/weights
 * body: { weights: [{ containerId, weightKg }] }
 *    or body: { containers: [...] } (legacy alias)
 */
export async function updateContainerWeights(req: Request, res: Response) {
  try {
    const user = (req as any).user as { id: string; role: string } | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const farmerOrderId = String(req.params.id || "");
    // legacy alias: we accept body.containers too
    const weights = (req.body?.weights || req.body?.containers) as Array<{
      containerId: string;
      weightKg: number;
    }>;

    const data = await patchContainerWeightsService({
      farmerOrderId,
      weights,
      user: {
        userId: new Types.ObjectId(user.id),
        role: String(user.role || ""),
      },
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err?.status === 403 || err?.name === "Forbidden")
      return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.status === 404 || err?.name === "NotFound")
      return res.status(404).json({ error: "FarmerOrder not found" });
    if (err?.status === 400 || err?.name === "BadRequest")
      return res.status(400).json({
        error: err.message || "Bad request",
        details: err.details,
      });
    console.error("updateContainerWeights error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * PATCH /api/farmer-orders/:id/farmer-status
 * body: { status, note }
 *
 * This is the "farmer flow" / high-level approval path.
 * It can (for example) create AMS stock when status === "ok".
 * We KEEP this here, because it's domain-heavy.
 */
export async function updateFarmerStatus(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthUser | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const orderId = req.params.id;
    const { status, note } = req.body ?? {};

    const data = await updateFarmerStatusService({
      orderId,
      status,
      note,
      user,
    });
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest")
      return res
        .status(400)
        .json({ error: "Validation failed", details: err.details });
    if (err?.name === "Forbidden")
      return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.name === "NotFound")
      return res.status(404).json({ error: "Not Found", details: err.details });
    if (err?.name === "ValidationError")
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    console.error("FarmerOrder.updateFarmerStatus error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * NOTE:
 * We REMOVED updateStageStatus() from this controller.
 *
 * Stage patching for manager/admin is now handled in:
 *   src/controllers/farmerOrderStages.controller.ts
 * which calls updateFarmerOrderStageService.
 *
 * That keeps "pipeline moves" separated from "farmer OK / AMS stock logic".
 */

/**
 * GET /api/farmer-orders/upcoming?logisticCenterId=&count=
 * Quick dashboard summary for an LC.
 */
export async function getFarmerOrdersUpcoming(req: Request, res: Response) {
  try {
    const logisticCenterId =
      (req.query.logisticCenterId as string) ||
      (req as any).user?.logisticCenterId ||
      "";
    if (!logisticCenterId)
      return res.status(400).json({ message: "logisticCenterId is required" });

    const count = parseInt(String(req.query.count ?? "5"), 10) || 5;
    const data = await farmerOrdersSummary({ logisticCenterId, count });
    return res.json(data);
  } catch (err: any) {
    console.error("getFarmerOrdersUpcoming error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/farmer-orders/shift?logisticCenterId=&date=&shiftName=&farmerStatus=&page=&limit=
 * Paginated list for shift dashboard.
 */

export async function getFarmerOrdersForShift(req: Request, res: Response) {
  try {
    const user = (req as any).user || {};
    const role = user.role as string | undefined;
    const userId = (user.id || user._id) as string | undefined;

    const logisticCenterId = user?.logisticCenterId || "";
    if (!logisticCenterId)
      return res.status(400).json({ message: "logisticCenterId is required" });

    const date = String(req.query.date || "");
    const shiftName = String(req.query.shiftName || "");
    if (!date || !shiftName)
      return res
        .status(400)
        .json({ message: "date and shiftName are required" });

    const farmerStatus = req.query.farmerStatus as any;
    const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;

    const isFarmer = role === "farmer";

    const data = await listFarmerOrdersForShift({
      logisticCenterId,
      date,
      shiftName: shiftName as any,
      farmerStatus,
      page,
      limit,
      farmerId: isFarmer ? userId : undefined,
      forFarmerView: isFarmer, // <- switches projection + mapping + normalization
    });

    // console.log("getFarmerOrdersForShift data:", data.items);

    return res.json(data);
  } catch (err) {
    console.error("getFarmerOrdersForShift error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
/**
 * GET /api/farmer-orders (my list)
 * farmer sees their own orders, manager/admin can also filter
 */
export async function listMyOrders(req: Request, res: Response) {
  try {
    const user = (req as any).user as
      | { id: string; role: string; logisticCenterId?: string }
      | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const isMgr = ["admin", "fManager"].includes(String(user.role));

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    // role-aware LC selection
    const lcFromQuery = asString(req.query.lc);
    const effectiveLC = isMgr
      ? lcFromQuery || user.logisticCenterId
      : user.logisticCenterId;
    if (isMgr && !effectiveLC) {
      return res
        .status(400)
        .json({ error: "logisticCenterId (lc) is required for manager/admin" });
    }

    // window / dates
    const window = fromEnum(req.query.window, WINDOWS) ?? "future";
    const fromQ = asString(req.query.from);
    const toQ = asString(req.query.to);

    // load tz from LC (if available)
    let tz = "Asia/Jerusalem";
    if (effectiveLC) {
      const cfg = await ShiftConfig.findOne(
        { logisticCenterId: effectiveLC },
        { timezone: 1 }
      )
        .lean()
        .exec();
      tz = cfg?.timezone || tz;
    }
    const todayLocal = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");

    let from = fromQ;
    let to = toQ;
    if (!from && !to) {
      if (window === "future") from = todayLocal;
      else if (window === "past")
        to = DateTime.fromISO(todayLocal)
          .minus({ days: 1 })
          .toFormat("yyyy-LL-dd");
      // "all" => leave undefined
    }

    // other filters — NARROWED ✅
    const farmerStatus: FarmerStatus | undefined = fromEnum(
      req.query.farmerStatus,
      FARMER_STATUSES
    );
    const shift: ShiftName | undefined = fromEnum(req.query.shift, SHIFTS);
    const itemId = asString(req.query.itemId);

    // fields[]=...
    const fieldsParam = req.query.fields;
    const fields = Array.isArray(fieldsParam)
      ? (fieldsParam.map(asString).filter(Boolean) as string[])
      : fieldsParam
      ? [String(fieldsParam)]
      : undefined;

    const data = await listMyFarmerOrdersService(
      {
        userId: new Types.ObjectId(String(user.id)),
        role: String(user.role),
        // if your service expects ObjectId here, convert before passing:
        // logisticCenterId: effectiveLC ? new Types.ObjectId(effectiveLC) : undefined,
        // (your current service uses user.LogisticCenterId: Types.ObjectId | undefined)
      } as any, // keep your existing UserCtx shape if different
      {
        limit,
        offset,
        filters: { farmerStatus, itemId, shift, from, to, fields },
      }
    );

    return res.json({ data, paging: { limit, offset, count: data.length } });
  } catch (err: any) {
    console.error("listMyOrders error:", err);
    return res
      .status(err?.status || 500)
      .json({ error: err?.message || "Internal server error" });
  }
}

/**
 * GET /api/farmer-orders/:id/print
 * Returns farmer order + container QR codes etc.
 */
export async function getFarmerOrderAndQrs(req: Request, res: Response) {
  try {
    const user = (req as any).user as { id: string; role: string } | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const foId = String(req.params.id || "");
    if (!foId)
      return res.status(400).json({ error: "FarmerOrder id is required" });

    const data = await ensureFarmerOrderPrintPayloadService({
      farmerOrderId: foId,
      user: {
        userId: new Types.ObjectId(String(user.id)),
        role: String(user.role || ""),
      },
    });

    return res.json({ data });
  } catch (err: any) {
    if (err?.status === 404 || err?.name === "NotFound")
      return res.status(404).json({ error: "FarmerOrder not found" });
    if (err?.status === 403 || err?.name === "Forbidden")
      return res.status(403).json({ error: "Forbidden" });
    console.error("getFarmerOrderAndQrs error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
