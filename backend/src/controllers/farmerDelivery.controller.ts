// src/controllers/farmerDelivery.controller.ts

import type { Request, Response } from "express";
import { Types } from "mongoose";

import ApiError from "../utils/ApiError";

import {
  getFarmerDeliveryDashboardSummary,
  ensurePlanForShift,
  getFarmerDeliveriesByShift,
} from "../services/farmerDelivery.service";

import type { Shift } from "../models/farmerOrder.model";
import type { AddressLike } from "../services/farmerDeliveryPlanning.service";

const DEFAULT_LOGISTIC_CENTER_ID = "66e007000000000000000001";

const DEFAULT_LC_ADDRESS: AddressLike = {
  lnt: 35.218805,
  alt: 32.733459,
  address: "LC-1 Main Warehouse",
  logisticCenterId: DEFAULT_LOGISTIC_CENTER_ID,
  note: "Default LC location placeholder",
};

/* -------------------------------------------------------------------------- */
/*                               Error helper                                  */
/* -------------------------------------------------------------------------- */

function handleError(res: Response, err: any) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      details: (err as any).details || undefined,
    });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

/* -------------------------------------------------------------------------- */
/*          GET /farmer-delivery/summary                                      */
/*          T-manager dashboard: current + next 5                             */
/* -------------------------------------------------------------------------- */

export async function getFarmerDeliveryDashboard(
  req: Request,
  res: Response
) {
  try {
    const user = (req as any).user;
    const logisticCenterId: string =
      user?.logisticCenterId || DEFAULT_LOGISTIC_CENTER_ID;

    if (!logisticCenterId) {
      return res
        .status(400)
        .json({ message: "logisticCenterId is required on user context" });
    }

    const count =
      req.query.count != null ? Number(req.query.count) || 6 : 6;

    const data = await getFarmerDeliveryDashboardSummary({
      logisticCenterId,
      count,
    });

    return res.json({ data });
  } catch (err) {
    return handleError(res, err);
  }
}

/* -------------------------------------------------------------------------- */
/*          POST /farmer-delivery/plan                                        */
/*   Ensure plan for a given LC+date+shift (create if missing)                */
/* -------------------------------------------------------------------------- */

export async function postPlanFarmerDeliveries(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.id) throw new ApiError(401, "Unauthorized");

    const logisticCenterId: string =
      user?.logisticCenterId || DEFAULT_LOGISTIC_CENTER_ID;

    if (!logisticCenterId) {
      return res
        .status(400)
        .json({ message: "logisticCenterId is required on user context" });
    }

    // FE now sends ONLY pickUpDate + shift
    const { pickUpDate, shift } = req.body as {
      pickUpDate?: string;
      shift?: Shift;
    };

    if (!pickUpDate || !shift) {
      throw new ApiError(400, "pickUpDate and shift are required");
    }

    // LC address is resolved fully on backend
    const logisticCenterAddress: AddressLike = {
      ...DEFAULT_LC_ADDRESS,
      logisticCenterId,
    };

    const { created, deliveries } = await ensurePlanForShift({
      logisticCenterId,
      logisticCenterAddress,
      pickUpDate,
      shift,
      createdBy: new Types.ObjectId(user.id),
    });

    return res.status(created ? 201 : 200).json({
      created,
      data: deliveries,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/* -------------------------------------------------------------------------- */
/*          GET /farmer-delivery/by-shift                                     */
/*   When manager clicks "View" for a specific date+shift                     */
/* -------------------------------------------------------------------------- */

export async function getFarmerDeliveriesByShiftHandler(
  req: Request,
  res: Response
) {
  try {
    const user = (req as any).user;
    const logisticCenterId: string =
      user?.logisticCenterId || DEFAULT_LOGISTIC_CENTER_ID;

    if (!logisticCenterId) {
      throw new ApiError(
        400,
        "logisticCenterId is required on user context"
      );
    }

    // FE sends only pickUpDate + shift as query params
    const pickUpDate = req.query.pickUpDate as string | undefined;
    const shift = req.query.shift as Shift | undefined;

    if (!pickUpDate || !shift) {
      throw new ApiError(400, "pickUpDate and shift are required");
    }

    const deliveries = await getFarmerDeliveriesByShift({
      logisticCenterId,
      pickUpDate,
      shift,
    });

    return res.json({ data: deliveries });
  } catch (err) {
    return handleError(res, err);
  }
}
