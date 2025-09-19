import mongoose, { Types, FilterQuery, ClientSession } from "mongoose";
import ApiError from "@/utils/ApiError";
import Cart, { computeNewExpiry } from "@/models/cart.model";
import { getInactivityMinutes } from "./config.service";
import { AvailableMarketStockModel,  AvailableMarketStock} from "@/models/availableMarketStock.model";
import {
  adjustAvailableQtyAtomic,
} from "@/services/availableMarketStock.service";
import { getCurrentShift  } from "@/services/shiftConfig.service"; // assuming you already have it
import logger from "@/config/logger";

type CartLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  LCid: Types.ObjectId;
  availableDate: Date;
  availableShift: "morning" | "afternoon" | "evening" | "night";
  availableMarketStockId: Types.ObjectId;
  status: "active" | "checkedout" | "abandoned" | "expired";
  items: Array<{
    _id: Types.ObjectId;
    availableMarketStockItemId: Types.ObjectId;
    itemId: Types.ObjectId;
    displayName: string;
    category: string;
    imageUrl: string | null;
    pricePerUnit: number;
    amountKg: number;
    addedAt: Date;
    updatedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date | null;
};


// ---- small helpers ----
function roundKg(n: number) {
  return Math.round(n * 1000) / 1000;
}

function attachSession<T extends mongoose.Query<any, any>>(q: T, session: ClientSession | null): T {
  if (session) q.session(session);
  return q;
}

/** Run with a real transaction unless NODE_ENV === "test". */
async function withOptionalTxn<T>(fn: (session: ClientSession | null) => Promise<T>): Promise<T> {
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

// ---- types ----
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

// ---- internal: fetch 1 AMS line snapshot we need for the cart merge ----
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

const amsDoc = await AvailableMarketStockModel
  .findById(
    availableMarketStockId,
    { LCid: 1, availableDate: 1, availableShift: 1 } // <- projection avoids weird unions
  )
  .lean<AmsLean>()
  .exec();

if (!amsDoc) throw new ApiError(404, "AvailableMarketStock not found");


    const currentShift = await getCurrentShift();
    if (amsDoc.availableShift !== currentShift) {
      throw new ApiError(
        400,
        `Cannot add items for shift '${amsDoc.availableShift}'. Current global shift is '${currentShift}'.`
      );
    }

    // 1) Reserve stock (-amount)
    await adjustAvailableQtyAtomic({
      docId: String(availableMarketStockId),
      lineId: String(amsItemId),
      deltaKg: -roundKg(amountKg),
      enforceEnoughForReserve: true,
      session,
    });

    // 2) Snapshot + rest of your code exactly as you have it now...
    const snap = await getAmsLineSnapshot(availableMarketStockId, amsItemId, session);
    const line = snap.items[0];
    if (line.status !== "active") throw new ApiError(409, "Item is not active");

    const inactivityMinutes = await getInactivityMinutes(snap.LCid);
    const expiresAt = await computeNewExpiry(snap.LCid, snap.availableDate, snap.availableShift, inactivityMinutes);

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
      (x: any) => x.availableMarketStockItemId.toString() === amsItemId.toString()
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
      amsDoc.LCid, amsDoc.availableDate, amsDoc.availableShift, inactivityMinutes
    );
    await (session ? cart.save({ session }) : cart.save());

    const persisted = await (session
  ? Cart.findById(cart._id).session(session).lean<CartLean>().exec()
  : Cart.findById(cart._id).lean<CartLean>().exec());

if (!persisted) throw new ApiError(500, "Failed to persist cart");


    logger.info(
  `[cart] upsert user=${String(userId)} ams=${String(availableMarketStockId)} ` +
  `lc=${String(amsDoc.LCid)} date=${amsDoc.availableDate.toISOString().slice(0,10)} ` +
  `shift=${amsDoc.availableShift} inactivityMin=${inactivityMinutes} ` +
  `expiresAt=${persisted.expiresAt ? persisted.expiresAt.toISOString() : "null"}`
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

    for (const line of (cart as any).items) {
      await adjustAvailableQtyAtomic({
        docId: String(cart.availableMarketStockId),
        lineId: String(line.availableMarketStockItemId),
        deltaKg: roundKg(line.amountKg), // release
        enforceEnoughForReserve: false,
        session,
      });
    }

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
  const cart = await Cart.findOne({ userId, availableMarketStockId, status: "active" });
  return cart?.toJSON() ?? null;
}

export async function getCartById(cartId: Types.ObjectId, userId: Types.ObjectId) {
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
    { availableDate, availableShift: shiftName, status: "active" } as FilterQuery<any>,
    { $set: { items: [], status: "expired", lastActivityAt: new Date() } }
  );

  if (hardDelete) {
    await Cart.deleteMany(
      { availableDate, availableShift: shiftName, status: "expired", items: { $size: 0 } } as FilterQuery<any>
    );
  }
}
