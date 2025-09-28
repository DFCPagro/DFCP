import mongoose, { Types, FilterQuery, ClientSession } from "mongoose";
import ApiError from "@/utils/ApiError";
import Cart, { computeNewExpiry } from "@/models/cart.model";
import { getInactivityMinutes } from "./config.service";
import {
  AvailableMarketStockModel,
  AvailableMarketStock,
} from "@/models/availableMarketStock.model";
import ShiftConfig from "@/models/shiftConfig.model";
import { calcShiftCutoffForServiceDayUTC } from "@/helpers/time/shiftCutoff";
import { adjustAvailableQtyAtomic } from "@/services/availableMarketStock.service";
import { getCurrentShift } from "@/services/shiftConfig.service";
import logger from "@/config/logger";

/* =============================================================================
 * Types
 * ========================================================================== */

export type AddItemInput = {
  userId: Types.ObjectId;
  availableMarketStockId: Types.ObjectId;
  amsItemId: Types.ObjectId; // AvailableMarketStock.items._id
  amountKg: number;
  inactivityMinutesOverride?: number;
};

export type RemoveItemInput = {
  userId: Types.ObjectId;
  cartId: Types.ObjectId;
  cartItemId: Types.ObjectId;
  amountKg?: number;
};

export type ClearCartInput = {
  userId: Types.ObjectId;
  cartId: Types.ObjectId;
};

export type CheckoutInput = {
  userId: Types.ObjectId;
  cartId: Types.ObjectId;
};

type AmsOneLine = {
  _id: Types.ObjectId;
  LCid: Types.ObjectId;
  availableDate: Date;
  availableShift: "morning" | "afternoon" | "evening" | "night";
  items: Array<{
    _id: Types.ObjectId;
    itemId: Types.ObjectId;
    displayName: string;
    category: string;
    imageUrl: string | null;
    pricePerUnit: number;
    currentAvailableQuantityKg: number;
    originalCommittedQuantityKg: number;
    status: "active" | "soldout" | "removed";
  }>;
};

const SHIFT_ORDER = ["morning", "afternoon", "evening", "night"] as const;
type ShiftName = (typeof SHIFT_ORDER)[number];

/* =============================================================================
 * Small helpers
 * ========================================================================== */

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000;
}

function attachSession<T extends mongoose.Query<any, any>>(
  q: T,
  session: ClientSession | null
): T {
  if (session) q.session(session);
  return q;
}

/** Run with a real transaction unless NODE_ENV === "test". */
async function withOptionalTxn<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const useTxn = process.env.NODE_ENV !== "test";
  const session = useTxn ? await mongoose.startSession() : null;
  if (session) session.startTransaction();
  try {
    const res = await fn(session);
    if (session) await session.commitTransaction();
    return res;
  } catch (e) {
    if (session) await session.abortTransaction();
    throw e;
  } finally {
    if (session) session.endSession();
  }
}

function serviceDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function idxOfShift(s: ShiftName) {
  return SHIFT_ORDER.indexOf(s);
}

async function getAmsLineSnapshot(
  amsId: Types.ObjectId,
  amsItemId: Types.ObjectId,
  session: ClientSession | null
) {
  const q = AvailableMarketStockModel.findOne(
    { _id: amsId, "items._id": amsItemId },
    {
      LCid: 1,
      availableDate: 1,
      availableShift: 1,
      "items.$": 1,
    }
  ).lean<AmsOneLine>();
  attachSession(q, session);
  const doc = await q.exec();
  if (!doc || !doc.items?.length) {
    throw new ApiError(409, "Item not found after reserve (race)");
  }
  return doc;
}

/** Release every line in a cart back to AMS (atomic, inside txn). */
async function releaseAllCartLinesToAMS(
  cart: any,
  session: ClientSession | null
) {
  if (!cart?.items?.length) return;

  for (const line of cart.items) {
    await adjustAvailableQtyAtomic({
      docId: String(cart.availableMarketStockId),
      lineId: String(line.availableMarketStockItemId),
      deltaKg: roundKg(line.amountKg), // release
      enforceEnoughForReserve: false,
      session,
    });
  }
}

/* =============================================================================
 * Public API
 * ========================================================================== */

// -----------------------------------------------------------------------------
// Add (or increase) a line in the user's active cart for the AMS doc.
// Reserves AMS quantity atomically. If cart missing => it’s created.
// -----------------------------------------------------------------------------
export async function addItemToCart(input: AddItemInput) {
  const { userId, availableMarketStockId, amsItemId, amountKg } = input;
  if (amountKg <= 0) throw new ApiError(400, "Amount must be positive");

  return withOptionalTxn(async (session) => {
    // 0) Read AMS once and validate shift BEFORE reserving
    type AmsLean = {
      _id: Types.ObjectId;
      LCid: Types.ObjectId;
      availableDate: Date;
      availableShift: "morning" | "afternoon" | "evening" | "night";
    };

    const amsDoc = await AvailableMarketStockModel.findById(
      availableMarketStockId,
      { LCid: 1, availableDate: 1, availableShift: 1 }
    )
      .lean<AmsLean>()
      .exec();

    if (!amsDoc) throw new ApiError(404, "AvailableMarketStock not found");

    const msPerDay = 24 * 60 * 60 * 1000;
    const todayServiceDay = serviceDayUtc(new Date());
    const amsServiceDay = serviceDayUtc(amsDoc.availableDate);
    const diffDays = Math.round(
      (amsServiceDay.getTime() - todayServiceDay.getTime()) / msPerDay
    );

    const amsShift = amsDoc.availableShift as ShiftName;
    const currShift = (await getCurrentShift()) as ShiftName;

    if (diffDays > 0) {
      // future day -> allowed
    } else if (diffDays === 0) {
      if (idxOfShift(amsShift) < idxOfShift(currShift)) {
        throw new ApiError(
          400,
          `Cannot add items for past shifts. Requested: '${amsShift}', current: '${currShift}'.`
        );
      }

      // Same-day + same (current) shift → enforce cut-off
      if (amsShift === currShift) {
        const cfg = await ShiftConfig.findOne(
          { name: amsShift },
          { timezone: 1, generalStartMin: 1, generalEndMin: 1 }
        ).lean<{ timezone?: string; generalStartMin: number; generalEndMin: number }>();

        if (!cfg) throw new ApiError(500, "Shift configuration missing");

        const { cutoffUTC } = calcShiftCutoffForServiceDayUTC({
          tz: cfg.timezone,
          serviceDayUTC: todayServiceDay,
          startMin: cfg.generalStartMin,
          endMin: cfg.generalEndMin,
          cutoffMin: 15, // 15-minute rule
        });

        if (new Date() >= cutoffUTC) {
          const cutoffLocal = new Date(cutoffUTC).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: cfg.timezone || "Asia/Jerusalem",
          });
          throw new ApiError(
            403,
            `Ordering for '${amsShift}' closed at ${cutoffLocal}.`
          );
        }
      }
    } else {
      throw new ApiError(400, "Cannot add items for past shifts.");
    }

    // 1) Reserve stock (-amount)
    await adjustAvailableQtyAtomic({
      docId: String(availableMarketStockId),
      lineId: String(amsItemId),
      deltaKg: -roundKg(amountKg),
      enforceEnoughForReserve: true,
      session,
    });

    // 2) Snapshot & upsert cart
    const snap = await getAmsLineSnapshot(availableMarketStockId, amsItemId, session);
    const line = snap.items[0];
    if (line.status !== "active") throw new ApiError(409, "Item is not active");

    const inactivityMinutes =
      input.inactivityMinutesOverride ??
      (await getInactivityMinutes(snap.LCid));

    const expiresAt = await computeNewExpiry(
      snap.LCid,
      snap.availableDate,
      snap.availableShift,
      inactivityMinutes
    );

    const upsertQ = Cart.findOneAndUpdate(
      {
        userId,
        LCid: snap.LCid,
        availableMarketStockId,
        availableDate: snap.availableDate,
        availableShift: snap.availableShift,
        status: "active",
      },
      {
        $setOnInsert: {
          userId,
          LCid: snap.LCid,
          availableMarketStockId,
          availableDate: snap.availableDate,
          availableShift: snap.availableShift,
          status: "active",
          items: [],
        },
        $set: { lastActivityAt: new Date(), expiresAt },
      },
      { new: true, upsert: true }
    );
    attachSession(upsertQ, session);
    const cart = await upsertQ.exec();
    if (!cart) throw new ApiError(500, "Failed to upsert cart");

    const existing = (cart as any).items.find(
      (x: any) =>
        x.availableMarketStockItemId.toString() === amsItemId.toString()
    );
    if (existing) {
      existing.amountKg = roundKg(existing.amountKg + amountKg);
      existing.updatedAt = new Date();
    } else {
      (cart as any).items.push({
        availableMarketStockItemId: amsItemId,
        itemId: line.itemId,
        displayName: line.displayName,
        category: line.category,
        imageUrl: line.imageUrl ?? null,
        pricePerUnit: line.pricePerUnit,
        amountKg: roundKg(amountKg),
        addedAt: new Date(),
        updatedAt: new Date(),
      });
    }

    cart.lastActivityAt = new Date();
    cart.expiresAt = await computeNewExpiry(
      snap.LCid,
      snap.availableDate,
      snap.availableShift,
      inactivityMinutes
    );
    await (session ? cart.save({ session }) : cart.save());

    const persisted = await (session
      ? Cart.findById(cart._id).session(session).lean().exec()
      : Cart.findById(cart._id).lean().exec());

    if (!persisted) throw new ApiError(500, "Failed to persist cart");

    logger.info(
      `[cart] upsert user=${String(userId)} ams=${String(
        availableMarketStockId
      )} lc=${String(snap.LCid)} date=${snap.availableDate
        .toISOString()
        .slice(0, 10)} shift=${snap.availableShift} inactivityMin=${inactivityMinutes} ` +
        `expiresAt=${persisted.expiresAt ? new Date(persisted.expiresAt).toISOString() : "null"}`
    );

    return persisted;
  });
}

// -----------------------------------------------------------------------------
// Remove (or decrease) a cart line, and release AMS qty.
// -----------------------------------------------------------------------------
export async function removeItemFromCart(input: RemoveItemInput) {
  const { userId, cartId, cartItemId, amountKg } = input;

  return withOptionalTxn(async (session) => {
    const cartQ = Cart.findOne({ _id: cartId, userId, status: "active" });
    attachSession(cartQ, session);
    const cart = await cartQ.exec();
    if (!cart) throw new ApiError(404, "Cart not found or not active");

    const idx = (cart as any).items.findIndex(
      (x: any) => x._id.toString() === cartItemId.toString()
    );
    if (idx === -1) throw new ApiError(404, "Cart item not found");

    const line = (cart as any).items[idx];
    const putBack = roundKg(amountKg ?? line.amountKg);
    if (!Number.isFinite(putBack) || putBack <= 0 || putBack > line.amountKg) {
      throw new ApiError(400, "Invalid amount");
    }

    // release to AMS
    await adjustAvailableQtyAtomic({
      docId: String(cart.availableMarketStockId),
      lineId: String(line.availableMarketStockItemId),
      deltaKg: putBack, // + => release
      enforceEnoughForReserve: false,
      session,
    });

    // update cart
    line.amountKg = roundKg(line.amountKg - putBack);
    line.updatedAt = new Date();
    if (line.amountKg <= 0) (cart as any).items.splice(idx, 1);

    (cart as any).lastActivityAt = new Date();
    await (session ? cart.save({ session }) : cart.save());

    const outQ = Cart.findById(cart._id).lean();
    attachSession(outQ, session);
    const out = await outQ.exec();
    return out ?? cart.toJSON();
  });
}

// -----------------------------------------------------------------------------
// Clear entire cart, release all to AMS, mark abandoned.
// -----------------------------------------------------------------------------
export async function clearCart(input: ClearCartInput) {
  const { userId, cartId } = input;

  return withOptionalTxn(async (session) => {
    const cartQ = Cart.findOne({ _id: cartId, userId });
    attachSession(cartQ, session);
    const cart = await cartQ.exec();
    if (!cart) return;

    await releaseAllCartLinesToAMS(cart, session);

    (cart as any).items.splice(0, (cart as any).items.length);
    (cart as any).status = "abandoned";
    (cart as any).lastActivityAt = new Date();
    await (session ? cart.save({ session }) : cart.save());
  });
}

// -----------------------------------------------------------------------------
// Checkout (no AMS change here).
// -----------------------------------------------------------------------------
export async function checkoutCart(input: CheckoutInput) {
  const { userId, cartId } = input;

  return withOptionalTxn(async (session) => {
    const cartQ = Cart.findOne({ _id: cartId, userId, status: "active" });
    attachSession(cartQ, session);
    const cart = await cartQ.exec();
    if (!cart) throw new ApiError(404, "Cart not found or not active");

    (cart as any).status = "checkedout";
    (cart as any).lastActivityAt = new Date();
    await (session ? cart.save({ session }) : cart.save());

    const outQ = Cart.findById(cart._id).lean();
    attachSession(outQ, session);
    const out = await outQ.exec();
    return out ?? cart.toJSON();
  });
}

// -----------------------------------------------------------------------------
// Misc
// -----------------------------------------------------------------------------
export async function refreshCartExpiry(cartId: Types.ObjectId) {
  const cart = await Cart.findById(cartId);
  if (!cart || (cart as any).status !== "active") {
    throw new ApiError(404, "Cart not found or not active");
  }

  const inactivityMinutes = await getInactivityMinutes((cart as any).LCid);
  const expiresAt = await computeNewExpiry(
    (cart as any).LCid as Types.ObjectId,
    (cart as any).availableDate,
    (cart as any).availableShift as any,
    inactivityMinutes
  );

  (cart as any).lastActivityAt = new Date();
  (cart as any).expiresAt = expiresAt;
  await cart.save();
  return cart.toJSON();
}

export async function getActiveCartForContext(
  userId: Types.ObjectId,
  availableMarketStockId: Types.ObjectId
) {
  const cart = await Cart.findOne({
    userId,
    availableMarketStockId,
    status: "active",
  });
  return cart?.toJSON() ?? null;
}

export async function getCartById(
  cartId: Types.ObjectId,
  userId: Types.ObjectId
) {
  const cart = await Cart.findOne({ _id: cartId, userId });
  if (!cart) throw new ApiError(404, "Cart not found");
  return cart.toJSON();
}

/** SHIFT-END NUKE (GLOBAL): wipe items for all active carts for date+shift (no AMS adjustments). */
export async function wipeCartsForShift(params: {
  availableDate: Date; // 00:00 UTC
  shiftName: "morning" | "afternoon" | "evening" | "night";
  hardDelete?: boolean;
}) {
  const { availableDate, shiftName, hardDelete } = params;

  await Cart.updateMany(
    {
      availableDate,
      availableShift: shiftName,
      status: "active",
    } as FilterQuery<any>,
    { $set: { items: [], status: "expired", lastActivityAt: new Date() } }
  );

  if (hardDelete) {
    await Cart.deleteMany({
      availableDate,
      availableShift: shiftName,
      status: "expired",
      items: { $size: 0 },
    } as FilterQuery<any>);
  }
}

/* =============================================================================
 * Centralized reclaim/abandon helpers (used by jobs & controllers)
 * ========================================================================== */

/**
 * Abandon a cart (owner-scoped): releases all items back to AMS,
 * sets status "abandoned", then deletes the empty cart document.
 * Throws 404 if not found or not owned by user.
 */
export async function abandonCartAndDelete(input: {
  cartId: Types.ObjectId;
  userId: Types.ObjectId;
}) {
  const { cartId, userId } = input;

  return withOptionalTxn(async (session) => {
    const cart = await Cart.findOne({ _id: cartId, userId }).session(session);
    if (!cart) throw new ApiError(404, "Cart not found");

    await releaseAllCartLinesToAMS(cart as any, session);

    cart.set("items", []);
    (cart as any).status = "abandoned";
    (cart as any).lastActivityAt = new Date();
    await cart.save({ session });

    const del = await Cart.deleteOne({ _id: cart._id, status: "abandoned" }).session(session);
    logger.info(
      `[cart] abandoned & deleted cart=${String(cart._id)} owner=${String(userId)} deleted=${del.deletedCount}`
    );

    return { deleted: del.deletedCount > 0, cartId: cart._id };
  });
}

/**
 * Force-expire & delete a cart (admin/jobs). Releases items to AMS,
 * sets status to "expired", deletes the doc. Returns deletion result.
 * If the cart is already empty, still enforces the status->delete flow.
 */
export async function expireCartAndDelete(input: {
  cartId: Types.ObjectId;
  reason?: "expired" | "cutoff" | "manual";
}) {
  const { cartId, reason = "manual" } = input;

  return withOptionalTxn(async (session) => {
    const cart = await Cart.findOne({ _id: cartId }).session(session);
    if (!cart) return { deleted: false, cartId };

    await releaseAllCartLinesToAMS(cart as any, session);

    cart.set("items", []);
    (cart as any).status = "expired";
    (cart as any).lastActivityAt = new Date();
    await cart.save({ session });

    const del = await Cart.deleteOne({ _id: cart._id, status: "expired" }).session(session);
    logger.info(
      `[cart] expired & deleted cart=${String(cart._id)} reason=${reason} deleted=${del.deletedCount}`
    );

    return { deleted: del.deletedCount > 0, cartId: cart._id };
  });
}

/**
 * Generic helper for jobs that need to reclaim many carts:
 * release lines & mark expired (keeps the doc; no delete).
 */
export async function reclaimCartWithoutDelete(cartId: Types.ObjectId) {
  return withOptionalTxn(async (session) => {
    const cart = await Cart.findOne({ _id: cartId, status: "active" }).session(session);
    if (!cart) return { reclaimed: false, cartId };

    await releaseAllCartLinesToAMS(cart as any, session);

    (cart as any).status = "expired";
    cart.set("items", []);
    (cart as any).lastActivityAt = new Date();
    await cart.save({ session });

    logger.info(`[cart] reclaimed (no delete) cart=${String(cart._id)}`);
    return { reclaimed: true, cartId: cart._id };
  });
}
