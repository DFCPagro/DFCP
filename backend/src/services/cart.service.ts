import mongoose, { Types, FilterQuery, ClientSession } from "mongoose";
import ApiError from "@/utils/ApiError";
import Cart, { computeNewExpiry } from "@/models/cart.model";
import { AvailableMarketStockModel } from "@/models/availableMarketStock.model";
import { getInactivityMinutes } from "./config.service";

function roundKg(n: number) {
  return Math.round(n * 1000) / 1000;
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

// --- only changed blocks shown ---

export async function addItemToCart(input: AddItemInput) {
  const {
    userId,
    availableMarketStockId,
    amsItemId,
    amountKg,
    inactivityMinutesOverride,
  } = input;
  if (amountKg <= 0) throw new ApiError(400, "Amount must be positive");

  return withOptionalTxn(async (session) => {
    // 1) AMS decrement (unchanged)
    const amsQuery = AvailableMarketStockModel.findOneAndUpdate(
      {
        _id: availableMarketStockId,
        "items._id": amsItemId,
        "items.status": "active",
        "items.currentAvailableQuantityKg": { $gte: roundKg(amountKg) },
      },
      { $inc: { "items.$.currentAvailableQuantityKg": -roundKg(amountKg) } },
      { new: true }
    );
    if (session) amsQuery.session(session);
    const amsDoc = await amsQuery.exec();
    if (!amsDoc)
      throw new ApiError(409, "Insufficient stock or item not active");

    // 2) find item line (unchanged)
    // @ts-ignore
    const itm =
      amsDoc.items.id?.(amsItemId) ||
      amsDoc.items.find((x: any) => x._id.toString() === amsItemId.toString());
    if (!itm) throw new ApiError(409, "Item not found (race)");

    // 3) inactivity + expiry (unchanged)
    const inactivityMinutes =
      inactivityMinutesOverride ?? (await getInactivityMinutes(amsDoc.LCid));
    const expiresAt = await computeNewExpiry(
      amsDoc.LCid as Types.ObjectId,
      amsDoc.availableDate,
      amsDoc.availableShift as any,
      inactivityMinutes
    );

    // 4) upsert active cart (unchanged)
    const cartUpsertQuery = Cart.findOneAndUpdate(
      {
        userId,
        LCid: amsDoc.LCid,
        availableMarketStockId,
        availableDate: amsDoc.availableDate,
        availableShift: amsDoc.availableShift,
        status: "active",
      },
      {
        $setOnInsert: {
          userId,
          LCid: amsDoc.LCid,
          availableMarketStockId,
          availableDate: amsDoc.availableDate,
          availableShift: amsDoc.availableShift,
          status: "active",
          items: [],
        },
        $set: { lastActivityAt: new Date(), expiresAt },
      },
      { new: true, upsert: true }
    );
    if (session) cartUpsertQuery.session(session);
    const cart = await cartUpsertQuery.exec();

    // 5) merge line (unchanged)
    const existing = cart.items.find(
      (x: any) =>
        x.availableMarketStockItemId.toString() === amsItemId.toString()
    );
    if (existing) {
      existing.amountKg = roundKg(existing.amountKg + amountKg);
      existing.updatedAt = new Date();
    } else {
      cart.items.push({
        availableMarketStockItemId: amsItemId,
        itemId: itm.itemId,
        displayName: itm.displayName,
        category: itm.category,
        imageUrl: itm.imageUrl,
        pricePerUnit: itm.pricePerUnit,
        amountKg: roundKg(amountKg),
        addedAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    if (session) await cart.save({ session });
    else await cart.save();

    // 👇 return a fresh lean doc so _id/ids are stable (ObjectId)
    const persistedQuery = Cart.findById(cart._id);
    if (session) persistedQuery.session(session);
    const persisted = await persistedQuery.exec();
    if (!persisted) throw new ApiError(500, "Failed to persist cart");
    return persisted.toJSON();
  });
}

export async function removeItemFromCart(input: RemoveItemInput) {
  const { cartId, cartItemId, amountKg } = input; // ⬅ drop userId check

  return withOptionalTxn(async (session) => {
    // ⬇ only _id + active
    const cartQuery = Cart.findOne({ _id: cartId, status: "active" });
    if (session) cartQuery.session(session);
    const cart = await cartQuery.exec();
    if (!cart) throw new ApiError(404, "Cart not found or not active");

    const idx = cart.items.findIndex(
      (x: any) => x._id.toString() === cartItemId.toString()
    );
    if (idx === -1) throw new ApiError(404, "Cart item not found");
    const line = cart.items[idx];

    const putBack = roundKg(amountKg ?? line.amountKg);
    if (putBack <= 0 || putBack > line.amountKg)
      throw new ApiError(400, "Invalid amount");

    const amsInc = AvailableMarketStockModel.updateOne(
      {
        _id: cart.availableMarketStockId,
        "items._id": line.availableMarketStockItemId,
      },
      { $inc: { "items.$.currentAvailableQuantityKg": putBack } }
    );
    if (session) amsInc.session(session);
    await amsInc.exec();

    line.amountKg = roundKg(line.amountKg - putBack);
    line.updatedAt = new Date();
    if (line.amountKg <= 0) cart.items.splice(idx, 1);

    cart.lastActivityAt = new Date();
    if (session) await cart.save({ session });
    else await cart.save();

    const outQuery = Cart.findById(cart._id).lean();
    if (session) outQuery.session(session);
    const out = await outQuery.exec();
    return out!;
  });
}

export async function clearCart(input: ClearCartInput) {
  const { cartId } = input; // ⬅ drop userId check

  return withOptionalTxn(async (session) => {
    const cartQuery = Cart.findOne({ _id: cartId });
    if (session) cartQuery.session(session);
    const cart = await cartQuery.exec();
    if (!cart) return;

    for (const line of cart.items) {
      const inc = AvailableMarketStockModel.updateOne(
        {
          _id: cart.availableMarketStockId,
          "items._id": line.availableMarketStockItemId,
        },
        {
          $inc: {
            "items.$.currentAvailableQuantityKg": roundKg(line.amountKg),
          },
        }
      );
      if (session) inc.session(session);
      await inc.exec();
    }

    cart.items.splice(0, cart.items.length);
    cart.status = "abandoned";
    cart.lastActivityAt = new Date();
    if (session) await cart.save({ session });
    else await cart.save();
  });
}

export async function checkoutCart(input: CheckoutInput) {
  const { cartId } = input; // ⬅ drop userId check

  return withOptionalTxn(async (session) => {
    const cartQuery = Cart.findOne({ _id: cartId, status: "active" });
    if (session) cartQuery.session(session);
    const cart = await cartQuery.exec();
    if (!cart) throw new ApiError(404, "Cart not found or not active");

    cart.status = "checkedout";
    cart.lastActivityAt = new Date();
    if (session) await cart.save({ session });
    else await cart.save();

    const outQuery = Cart.findById(cart._id).lean();
    if (session) outQuery.session(session);
    const out = await outQuery.exec();
    return out!;
  });
}

export async function refreshCartExpiry(cartId: Types.ObjectId) {
  const cart = await Cart.findById(cartId);
  if (!cart || cart.status !== "active")
    throw new ApiError(404, "Cart not found or not active");

  const inactivityMinutes = await getInactivityMinutes(cart.LCid);
  const expiresAt = await computeNewExpiry(
    cart.LCid as Types.ObjectId,
    cart.availableDate,
    cart.availableShift as any,
    inactivityMinutes
  );

  cart.lastActivityAt = new Date();
  cart.expiresAt = expiresAt;
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
