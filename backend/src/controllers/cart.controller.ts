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
  wipeCartsForShift, // optional admin op
} from "@/services/cart.service";

/* ------------------------------ helpers ------------------------------ */

function toObjectId(id: unknown, name: string): Types.ObjectId {
  const s = String(id);
  if (!Types.ObjectId.isValid(s)) throw new ApiError(400, `Invalid ${name}`);
  return new Types.ObjectId(s);
}

function requireUserId(req: Request): Types.ObjectId {
  // your authenticate middleware attaches a full User doc on req.user
  // @ts-ignore
  const u = req.user;
  if (!u?._id) throw new ApiError(401, "Unauthorized");
  return toObjectId(u._id, "userId");
}

function parsePositiveNumber(n: any, name: string): number {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) throw new ApiError(400, `${name} must be a positive number`);
  return num;
}

/* ------------------------------ controllers ------------------------------ */

/**
 * GET /carts/active?ams=<availableMarketStockId>
 * Returns the user's active cart for a given AvailableMarketStock context (LC+date+shift).
 */
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

/**
 * GET /carts/:cartId
 * Returns a single cart (must belong to the authenticated user).
 */
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

/**
 * POST /carts/add
 * Body: { availableMarketStockId, amsItemId, amountKg, inactivityMinutesOverride? }
 * Adds (or increases) an item line in the active cart; creates the cart if missing.
 */
export async function addItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = requireUserId(req);

    const availableMarketStockId = toObjectId(req.body.availableMarketStockId, "availableMarketStockId");
    const amsItemId = toObjectId(req.body.amsItemId, "amsItemId");
    const amountKg = parsePositiveNumber(req.body.amountKg, "amountKg");

    let inactivityMinutesOverride: number | undefined = undefined;
    if (req.body.inactivityMinutesOverride != null) {
      const n = Number(req.body.inactivityMinutesOverride);
      if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, "inactivityMinutesOverride must be a positive number");
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

/**
 * PATCH /carts/:cartId/items/:cartItemId
 * Body: { amountKg? }  (omit -> remove full line)
 */
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

/**
 * POST /carts/:cartId/clear
 * Clears the entire cart and returns the stock to AMS; marks cart as 'abandoned'.
 */
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

/**
 * POST /carts/:cartId/checkout
 * Marks the cart as checked out (stock remains deducted; order creation would happen in service).
 */
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

/**
 * POST /carts/:cartId/refresh-expiry
 * Recomputes expiresAt based on current AppConfig + global shift end.
 */
export async function refreshExpiry(req: Request, res: Response, next: NextFunction) {
  try {
    requireUserId(req); // just ensure auth; not used directly here
    const cartId = toObjectId(req.params.cartId, "cartId");

    const cart = await refreshCartExpiry(cartId);
    return res.status(200).json(cart);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------ optional admin ------------------------------ */

/**
 * POST /carts/wipe-shift
 * Body: { availableDate: string|Date (00:00 UTC), shiftName: 'morning'|'afternoon'|'evening'|'night', hardDelete?: boolean }
 * Global wipe at shift end (does NOT return stock to AMS).
 * Protect this route with `authorize('admin')` or similar.
 */
export async function wipeShift(req: Request, res: Response, next: NextFunction) {
  try {
    const { availableDate, shiftName, hardDelete } = req.body ?? {};
    if (!availableDate) throw new ApiError(400, "availableDate is required");
    const date = new Date(availableDate);
    if (isNaN(date.getTime())) throw new ApiError(400, "availableDate must be an ISO date");

    if (!["morning", "afternoon", "evening", "night"].includes(String(shiftName))) {
      throw new ApiError(400, "Invalid shiftName");
    }

    // normalize to 00:00 UTC (same as model)
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    await wipeCartsForShift({ availableDate: d, shiftName, hardDelete: Boolean(hardDelete) });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
