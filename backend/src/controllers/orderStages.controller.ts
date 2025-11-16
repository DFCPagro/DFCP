// src/controllers/orderStages.controller.ts
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { updateOrderStageStatusService } from "../services/orderStages.service";

// canonical stage keys (no "problem")
const StageKeySchema = z
  .string()
  .transform((v) => String(v).trim())
  .transform((k) => {
    const alias: Record<string, string> = {
      intransit: "in-transit",
      ready_for_pickup: "ready_for_pickUp",
      out_for_delivery: "out_for_delivery",
    };
    return alias[k] || k;
  })
  .pipe(
    z.enum([
      "pending",
      "confirmed",
      "farmer",
      "in-transit",
      "packing",
      "ready_for_pickUp",
      "out_for_delivery",
      "delivered",
      "received",
      "canceled",
    ])
  );

// service action literals
const StageActionSchema = z
  .enum(["setCurrent", "ok", "done", "problem", "cancel"])
  .default("ok");

const BodySchema = z.object({
  stageKey: StageKeySchema,
  action: StageActionSchema,
  note: z.string().max(500).optional(),
});

export async function postUpdateOrderStage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const orderId = req.params.orderId?.trim();
    if (!orderId) {
      return res
        .status(400)
        .json({ error: "BadRequest", details: ["Missing :orderId"] });
    }

    const parsed = BodySchema.parse(req.body);

    const rawUser = (req as any).user; // Mongoose User doc from authenticate
    if (!rawUser?._id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Normalize for service
    const user = {
      id: String(rawUser._id),
      role: rawUser.role,
      logisticCenterId: rawUser.logisticCenterId
        ? String(rawUser.logisticCenterId)
        : undefined,
      name: rawUser.name,
    };

    const updated = await updateOrderStageStatusService({
      orderId,
      stageKey: parsed.stageKey,
      action: parsed.action,
      note: parsed.note,
      user,
    });

    return res.status(200).json({ data: updated });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.issues });
    }
    return next(err);
  }
}
