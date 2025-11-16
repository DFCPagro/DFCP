// src/controllers/farmerOrderStages.controller.ts
import type { Request, Response } from "express";
import {
  updateFarmerOrderStageService,
  type AuthUser,
} from "../services/farmerOrderStages.service";

/**
 * PATCH /api/farmer-orders/:id/stage
 * Body: { key, action: "setCurrent"|"ok"|"done"|"problem", note?: string }
 * Auth: fManager, admin (route middleware should enforce)
 */
export async function patchFarmerOrderStage(req: Request, res: Response) {
  try {
    const rawUser = (req as any).user; // Mongoose User doc from authenticate

    if (!rawUser?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user: AuthUser = {
      id: String(rawUser._id),
      role: rawUser.role,
      logisticCenterId: rawUser.logisticCenterId
        ? String(rawUser.logisticCenterId)
        : undefined,
      name: rawUser.name,
    };

    const farmerOrderId = req.params.id;
    const { key, action, note } = req.body ?? {};

    const data = await updateFarmerOrderStageService({
      farmerOrderId,
      key,
      action,
      note,
      user,
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err?.name === "BadRequest") {
      return res
        .status(400)
        .json({ error: "Validation failed", details: err.details });
    }
    if (err?.name === "Forbidden") {
      return res.status(403).json({ error: "Forbidden", details: err.details });
    }
    if (err?.name === "NotFound") {
      return res.status(404).json({ error: "Not Found", details: err.details });
    }
    if (err?.name === "ValidationError") {
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.errors });
    }

    console.error("patchFarmerOrderStage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
