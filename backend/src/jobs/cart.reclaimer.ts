// src/jobs/cart.reclaimer.ts
import mongoose from "mongoose";
import Cart from "../models/cart.model";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import ShiftConfig from "../models/shiftConfig.model";

/** Put all reserved quantities back to AMS for a single cart (inside a txn). */
async function returnAllLines(cart: any, session: mongoose.ClientSession) {
  for (const line of cart.items) {
    await AvailableMarketStockModel.updateOne(
      { _id: cart.availableMarketStockId, "items._id": line.availableMarketStockItemId },
      { $inc: { "items.$.currentAvailableQuantityKg": line.amountKg } },
      { session }
    );
  }
}

/** Mid-shift: carts whose expiresAt passed — return stock then delete. */
export async function reclaimExpiredCarts(batch = 200) {
  const now = new Date();
  const cursor = Cart.find({ status: "active", expiresAt: { $lte: now } }).limit(batch).cursor();

  for await (const stale of cursor) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cart = await Cart.findOne({
        _id: stale._id,
        status: "active",
        expiresAt: { $lte: new Date() },
      }).session(session);

      if (!cart) {
        await session.abortTransaction();
        session.endSession();
        continue;
      }

      if (cart.items?.length) {
        await returnAllLines(cart, session);
      }

      cart.status = "expired";
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      await Cart.deleteOne({ _id: cart._id, status: "expired" });
    } catch {
      await session.abortTransaction();
      session.endSession();
    }
  }
}

/** Shift end: wipe carts for global shift/date (no AMS adjustments). */
export async function endShiftReclaim() {
  const now = new Date();
  const cfgs = await ShiftConfig.find({}).lean();

  const serviceDayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (const cfg of cfgs) {
    const shiftEnd = new Date(serviceDayUTC);
    shiftEnd.setUTCMinutes(shiftEnd.getUTCMinutes() + cfg.generalEndMin);

    if (now >= shiftEnd) {
      await Cart.updateMany(
        { availableDate: serviceDayUTC, availableShift: cfg.name, status: "active" },
        { $set: { items: [], status: "expired", lastActivityAt: new Date() } }
      );

      await Cart.deleteMany({
        availableDate: serviceDayUTC,
        availableShift: cfg.name,
        status: "expired",
        items: { $size: 0 },
      });
    }
  }
}

/** Start both reclaim loops; returns a stopper for graceful shutdown. */
export function startCartReclaimer(opts?: {
  intervalMs?: number;
  enabled?: boolean;
  log?: (msg: string) => void;
}) {
  const intervalMs = opts?.intervalMs ?? Number(process.env.CART_RECLAIMER_INTERVAL_MS ?? 60_000);
  const enabled = opts?.enabled ?? (process.env.CART_RECLAIMER_ENABLED ?? "true") !== "false";
  const log = opts?.log ?? (() => {});

  const timers: NodeJS.Timeout[] = [];

  if (!enabled) {
    log("[cart-reclaimer] disabled");
    return { stop: () => {} };
  }

  log(`[cart-reclaimer] starting, interval=${intervalMs}ms`);

  const t1 = setInterval(() => {
    reclaimExpiredCarts().catch((e) => log(`[cart-reclaimer] reclaimExpiredCarts error: ${e?.message || e}`));
  }, intervalMs);
  const t2 = setInterval(() => {
    endShiftReclaim().catch((e) => log(`[cart-reclaimer] endShiftReclaim error: ${e?.message || e}`));
  }, intervalMs);

  t1.unref?.();
  t2.unref?.();
  timers.push(t1, t2);

  return { stop() { timers.forEach(clearInterval); log("[cart-reclaimer] stopped"); } };
}
