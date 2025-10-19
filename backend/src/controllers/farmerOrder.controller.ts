import { Request, Response } from "express";
import {
  createFarmerOrderService,
  updateFarmerStatusService,
  updateStageStatusService,
  AuthUser,
  farmerOrdersSummary, 
  listFarmerOrdersForShift
} from "../services/farmerOrder.service";

/** POST /api/farmer-orders */
export async function create(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthUser | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const data = await createFarmerOrderService(req.body ?? {}, user);
    return res.status(201).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest")      return res.status(400).json({ error: "Validation failed", details: err.details });
    if (err?.name === "Forbidden")       return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.name === "ValidationError") return res.status(400).json({ error: "ValidationError", details: err.errors });
    console.error("FarmerOrder.create error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** PATCH /api/farmer-orders/:id/farmer-status */
export async function updateFarmerStatus(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthUser | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const orderId = req.params.id;
    const { status, note } = req.body ?? {};

    const data = await updateFarmerStatusService({ orderId, status, note, user });
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest")  return res.status(400).json({ error: "Validation failed", details: err.details });
    if (err?.name === "Forbidden")   return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.name === "NotFound")    return res.status(404).json({ error: "Not Found", details: err.details });
    if (err?.name === "ValidationError") return res.status(400).json({ error: "ValidationError", details: err.errors });
    console.error("FarmerOrder.updateFarmerStatus error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** PATCH /api/farmer-orders/:id/stage  (body: { key, action: "setCurrent"|"ok"|"done"|"problem", note? }) */
export async function updateStageStatus(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthUser | undefined;
    if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

    const farmerOrderId = req.params.id;
    const { key, action, note } = req.body ?? {};

    const data = await updateStageStatusService({ farmerOrderId, key, action, note, user });
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest")  return res.status(400).json({ error: "Validation failed", details: err.details });
    if (err?.name === "Forbidden")   return res.status(403).json({ error: "Forbidden", details: err.details });
    if (err?.name === "NotFound")    return res.status(404).json({ error: "Not Found", details: err.details });
    if (err?.name === "ValidationError") return res.status(400).json({ error: "ValidationError", details: err.errors });
    console.error("FarmerOrder.updateStageStatus error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getFarmerOrdersUpcoming(req: Request, res: Response) {
  const logisticCenterId =
    (req.query.logisticCenterId as string) ||
    (req as any).user?.logisticCenterId ||
    "";
  if (!logisticCenterId) return res.status(400).json({ message: "logisticCenterId is required" });

  const count = parseInt(String(req.query.count ?? "5"), 10) || 5;
  const data = await farmerOrdersSummary({ logisticCenterId, count });
  return res.json(data);
}

export async function getFarmerOrdersForShift(req: Request, res: Response) {
  const logisticCenterId =
    (req.query.logisticCenterId as string) ||
    (req as any).user?.logisticCenterId ||
    "";
  if (!logisticCenterId) return res.status(400).json({ message: "logisticCenterId is required" });

  const date = String(req.query.date || "");
  const shiftName = String(req.query.shiftName || "");
  if (!date || !shiftName)
    return res.status(400).json({ message: "date and shiftName are required" });

  const farmerStatus = req.query.farmerStatus as any;
  const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
  const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;

  const data = await listFarmerOrdersForShift({
    logisticCenterId,
    date,
    shiftName: shiftName as any,
    farmerStatus,
    page,
    limit,
  });
  return res.json(data);
}
