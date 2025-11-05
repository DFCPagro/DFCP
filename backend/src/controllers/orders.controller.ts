import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";

import { CreateOrderInputSchema } from "../validations/orders.validation";

import { Role } from "../utils/constants";

import {
  createOrderForCustomer,
  listOrdersForCustomer,
  ordersSummarry,
  listOrdersForShift,
  canFulfillOrderFromPickerShelves,
} from "../services/order.service";

// -------------------- role buckets --------------------
const STAFF_ROLES: Role[] = [
  "opManager",
  "tManager",
  "fManager",
  "admin",
] as any;

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
    console.log("Creating order with body:", req.body);
    const parsed = CreateOrderInputSchema.parse(req.body);
    console.log("Parsed order input:", parsed);
    const userId = (req as any).user?._id || (req as any).user?.id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const data = await createOrderForCustomer(userId, parsed);
    return res.status(201).json({ data });
  } catch (err: any) {
    // Zod schema errors
    if (err.name === "ZodError") {
      console.log("zod");
      return res
        .status(400)
        .json({ error: "ValidationError", details: err.issues });
    }

    // Not found AMS document
    if (
      err.name === "NotFound" &&
      err.message?.includes("AvailableMarketStock")
    ) {
      console.log("ams not found");
      return res
        .status(404)
        .json({ error: "NotFound", details: [err.message] });
    }

    // FO-centric missing line in AMS
    if (
      err.name === "BadRequest" &&
      err.message?.startsWith("AMS line not found for farmerOrderId")
    ) {
      console.log("ams line (FO) not found");
      return res.status(400).json({
        error: "BadRequest",
        details: [err.message, ...(err.details ?? [])],
      });
    }

    // Guard errors from FO adjusters
    if (err?.message === "Not enough available quantity to reserve") {
      console.log("not enough qty");
      return res
        .status(400)
        .json({ error: "BadRequest", details: [err.message] });
    }

    // FO selector couldn't match inside the doc
    if (err?.message === "AvailableMarketStock not found or FO not matched") {
      console.log("doc or FO not matched");
      return res
        .status(404)
        .json({ error: "NotFound", details: [err.message] });
    }

    // Bad deltas
    if (err?.message === "deltaKg must be a non-zero finite number") {
      console.log("delta kg issue");
      return res
        .status(400)
        .json({ error: "BadRequest", details: [err.message] });
    }

    // Units path not allowed (unit/mixed mismatch or missing avg)
    if (
      err?.message === "This item is not sold by unit" ||
      err?.message ===
        "This item is not sold by unit or missing avgWeightPerUnitKg"
    ) {
      console.log("units path invalid for item");
      return res
        .status(400)
        .json({ error: "BadRequest", details: [err.message] });
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

    const data = await listOrdersForCustomer(
      userId,
      isFinite(limit) ? limit : 15
    );
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getMyOrders] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

export async function getOrdersSummary(req: Request, res: Response) {
  try {
    //const logisticCenterId = String(req.query.lc || req.query.logisticCenterId || "");
    const user= (req as any).user;
    const logisticCenterId = user.logisticCenterId;
    if (!logisticCenterId)
      throw new ApiError(400, "Missing query param ?lc=<logisticCenterId>");

    const countRaw = req.query.count ? Number(req.query.count) : 5;
    const count =
      Number.isFinite(countRaw) && countRaw > 0
        ? Math.min(10, Math.floor(countRaw))
        : 5;

    const data = await ordersSummarry({ logisticCenterId, count });
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    console.error("[getOrdersSummary] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

export async function getOrdersForShift(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const logisticCenterId = user.logisticCenterId;
    const date = String(req.query.date || ""); // yyyy-LL-dd in LC timezone
    const shiftName = String(req.query.shift || req.query.shiftName || "");

    if (!logisticCenterId)
      throw new ApiError(400, "Missing query param ?lc=<logisticCenterId>");
    if (!date) throw new ApiError(400, "Missing query param ?date=YYYY-MM-DD");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new ApiError(400, "Invalid date format, expected YYYY-MM-DD");
    if (!["morning", "afternoon", "evening", "night"].includes(shiftName))
      throw new ApiError(
        400,
        "Invalid shift; expected one of: morning|afternoon|evening|night"
      );

    const status = req.query.status ? String(req.query.status) : undefined; // optional filter
    const pageRaw = req.query.page ? Number(req.query.page) : 1;
    const limitRaw = req.query.limit ? Number(req.query.limit) : 50;
    const page =
      Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(200, Math.floor(limitRaw))
        : 50;

    // optional comma-separated field projection, e.g. fields=_id,status,customerId,totalPrice
    const fields =
      typeof req.query.fields === "string" && req.query.fields.trim().length
        ? req.query.fields
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const data = await listOrdersForShift({
      logisticCenterId,
      date,
      shiftName: shiftName as any,
      status,
      page,
      limit,
      fields,
    });
    //console.log("data:", data);
    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    console.error("[getOrdersForShift] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}


//what is dis?
export async function checkOrderPickerFulfillment(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const { orderId } = req.params;
    const result = await canFulfillOrderFromPickerShelves(orderId);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}
