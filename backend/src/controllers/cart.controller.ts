import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import ApiError from "@/utils/ApiError";
import {
  addItemToCart,
  removeItemFromCart,
  clearCart,
  checkoutCart,
  refreshCartExpiry,
  getActiveCartForContext,
  getCartById,
  wipeCartsForShift,
  abandonCartAndDelete,
  expireCartAndDelete,
  reclaimCartWithoutDelete,
} from "@/services/cart.service";

/* ------------------------------ helpers ------------------------------ */

function toObjectId(id: unknown, name: string): Types.ObjectId {
  const s = String(id);
  if (!Types.ObjectId.isValid(s)) throw new ApiError(400, `Invalid ${name}`);
  return new Types.ObjectId(s);
}

function requireUserId(req: Request): Types.ObjectId {
  // @ts-ignore your auth middleware attaches user
  const u = req.user;
  if (!u?._id) throw new ApiError(401, "Unauthorized");
  return toObjectId(u._id, "userId");
}

function parsePositiveNumber(n: any, name: string): number {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0)
    throw new ApiError(400, `${name} must be a positive number`);
  return num;
}

/* ------------------------------ controllers ------------------------------ */

/** GET /carts/active?ams=<availableMarketStockId> */
export async function getActiveCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const amsId = toObjectId(req.query.ams, "availableMarketStockId");
    const cart = await getActiveCartForContext(userId, amsId);
    return res.status(200).json(cart); // may be null
  } catch (err) {
    next(err);
  }
}

/** GET /carts/:cartId */
export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    const cart = await getCartById(cartId, userId);
    return res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

/** POST /carts/add */
export async function addItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);

    const availableMarketStockId = toObjectId(
      req.body.availableMarketStockId,
      "availableMarketStockId"
    );
    const amsItemId = toObjectId(req.body.amsItemId, "amsItemId");
    const amountKg = parsePositiveNumber(req.body.amountKg, "amountKg");

    let inactivityMinutesOverride: number | undefined = undefined;
    if (req.body.inactivityMinutesOverride != null) {
      const n = Number(req.body.inactivityMinutesOverride);
      if (!Number.isFinite(n) || n <= 0) {
        throw new ApiError(400, "inactivityMinutesOverride must be a positive number");
      }
      inactivityMinutesOverride = Math.floor(n);
    }

    const cart = await addItemToCart({
      userId,
      availableMarketStockId,
      amsItemId,
      amountKg,
      inactivityMinutesOverride,
    });

    return res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

/** PATCH /carts/:cartId/items/:cartItemId */
export async function removeItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    const cartItemId = toObjectId(req.params.cartItemId, "cartItemId");

    let amountKg: number | undefined = undefined;
    if (req.body.amountKg != null) {
      const n = Number(req.body.amountKg);
      if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, "amountKg must be a positive number");
      amountKg = n;
    }

    const cart = await removeItemFromCart({ userId, cartId, cartItemId, amountKg });
    return res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

/** POST /carts/:cartId/clear */
export async function clear(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    await clearCart({ userId, cartId });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** POST /carts/:cartId/checkout */
export async function checkout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    const out = await checkoutCart({ userId, cartId });
    return res.status(200).json(out);
  } catch (err) {
    next(err);
  }
}

/** POST /carts/:cartId/refresh-expiry */
export async function refreshExpiry(req: Request, res: Response, next: NextFunction) {
  try {
    requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    const cart = await refreshCartExpiry(cartId);
    return res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

/** POST /carts/wipe-shift  (admin) */
export async function wipeShift(req: Request, res: Response, next: NextFunction) {
  try {
    const { availableDate, shiftName, hardDelete } = req.body ?? {};
    if (!availableDate) throw new ApiError(400, "availableDate is required");
    const date = new Date(availableDate);
    if (isNaN(date.getTime())) throw new ApiError(400, "availableDate must be an ISO date");
    if (!["morning", "afternoon", "evening", "night"].includes(String(shiftName))) {
      throw new ApiError(400, "Invalid shiftName");
    }
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    await wipeCartsForShift({ availableDate: d, shiftName, hardDelete: Boolean(hardDelete) });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/* ------------------------------ NEW endpoints ------------------------------ */

/**
 * POST /carts/:cartId/abandon
 * Auth user abandons their cart: releases all items back to stock and deletes the cart.
 * Response: { deleted: boolean, cartId: string }
 */
export async function abandon(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);
    const cartId = toObjectId(req.params.cartId, "cartId");
    const out = await abandonCartAndDelete({ cartId, userId });
    return res.status(200).json({ ...out, cartId: String(out.cartId) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /carts/:cartId/expire  (admin)
 * Admin force-expires a cart: releases stock and deletes the cart doc.
 * Body optional: { reason?: "expired" | "cutoff" | "manual" }
 */
export async function expireOne(req: Request, res: Response, next: NextFunction) {
  try {
    const cartId = toObjectId(req.params.cartId, "cartId");
    const reason = (req.body?.reason ?? "manual") as "expired" | "cutoff" | "manual";
    const out = await expireCartAndDelete({ cartId, reason });
    return res.status(200).json({ ...out, cartId: String(out.cartId) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /carts/:cartId/reclaim   (admin)
 * Admin reclaims a cart's inventory back to AMS and marks it expired, but does NOT delete the doc.
 * Response: { reclaimed: boolean, cartId: string }
 */
export async function reclaimOne(req: Request, res: Response, next: NextFunction) {
  try {
    const cartId = toObjectId(req.params.cartId, "cartId");
    const out = await reclaimCartWithoutDelete(cartId);
    return res.status(200).json({ ...out, cartId: String(out.cartId) });
  } catch (err) {
    next(err);
  }
}
