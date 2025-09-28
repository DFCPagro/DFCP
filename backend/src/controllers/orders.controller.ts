import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";

import { CreateOrderInputSchema } from "../validations/orders.validation";

import { Role } from "../utils/constants";

import { createOrderForCustomer,
  listOrdersForCustomer, 

} from "../services/order.service";

// -------------------- role buckets --------------------
const STAFF_ROLES: Role[] = ["opManager", "tManager", "fManager", "admin"] as any;

const COURIER_ROLES: Role[] = ["deliverer", "industrialDeliverer"] as any;
const CUSTOMER_ROLE: Role = "customer" as any;

// -------------------- utils --------------------
function ensureOwnerOrStaff(req: Request, orderCustomerId: Types.ObjectId) {
  // @ts-ignore
  const user = req.user as { _id: Types.ObjectId; role: Role };
  const isOwner = user && orderCustomerId.equals(user._id);
  const isStaff = user && STAFF_ROLES.includes(user.role);
  const isCourier = user && COURIER_ROLES.includes(user.role);
  if (!(isOwner || isStaff || isCourier)) throw new ApiError(403, "Forbidden");
}


export async function postCreateOrder(req: Request, res: Response) {
  try {
    const parsed = CreateOrderInputSchema.parse(req.body);

    const userId = (req as any).user?._id || (req as any).user?.id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const data = await createOrderForCustomer(userId, parsed);
    return res.status(201).json({ data });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "ValidationError", details: err.issues });
    }
    if (err.name === "NotFound" && err.message?.includes("AvailableMarketStock")) {
      return res.status(404).json({ error: "NotFound", details: [err.message] });
    }
    if (err.name === "BadRequest" && err.message?.startsWith("AMS line not found")) {
      return res.status(400).json({ error: "BadRequest", details: [err.message, ...(err.details ?? [])] });
    }
    // messages propagated from adjustAvailableQtyAtomic:
    if (err?.message === "Not enough available quantity to reserve") {
      return res.status(400).json({ error: "BadRequest", details: [err.message] });
    }
    if (err?.message === "Document not found or lineId invalid") {
      return res.status(404).json({ error: "NotFound", details: [err.message] });
    }
    if (err?.message === "deltaKg must be a non-zero finite number") {
      return res.status(400).json({ error: "BadRequest", details: [err.message] });
    }

    console.error("[postCreateOrder] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

export async function getMyOrders(req: Request, res: Response) {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    // Optional query param, default to 15; hard-capped in service.
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? Number(limitRaw) : 15;

    const data = await listOrdersForCustomer(userId, isFinite(limit) ? limit : 15);
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getMyOrders] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}
