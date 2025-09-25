// src/jobs/cart.reclaimer.ts
import mongoose from "mongoose";
import Cart from "@/models/cart.model";
import { AvailableMarketStockModel } from "@/models/availableMarketStock.model";
import ShiftConfig from "@/models/shiftConfig.model";
import { calcShiftCutoffUTC } from "@/helpers/time/shiftCutoff";

/** Put all reserved quantities back to AMS for a single cart (inside a txn). */
async function returnAllLines(cart: any, session: mongoose.ClientSession) {
  if (!cart?.items?.length) return;

  for (const line of cart.items) {
    await AvailableMarketStockModel.updateOne(
      { _id: cart.availableMarketStockId, "items._id": line.availableMarketStockItemId },
      { $inc: { "items.$.currentAvailableQuantityKg": line.amountKg } },
      { session }
    );
  }
}

/** Mid-shift: carts whose expiresAt passed — return stock then delete. */
export async function reclaimExpiredCarts(
  batch = 200,
  log: (m: string) => void = () => {}
) {
  const now = new Date();
  const cursor = Cart.find({ status: "active", expiresAt: { $lte: now } })
    .limit(batch)
    .cursor();

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

      log(
        `[cart-reclaimer] expiring cart=${cart._id} now=${new Date().toISOString()} ` +
          `expiresAt=${cart.expiresAt?.toISOString()} Δms=${Date.now() - (cart.expiresAt?.getTime() ?? Date.now())}`
      );

      await returnAllLines(cart as any, session);

      cart.status = "expired";
      // IMPORTANT: don't assign [] directly (TS type mismatch). Use set().
      cart.set("items", []); // clears DocumentArray in a type-safe way
      cart.lastActivityAt = new Date();
      await cart.save({ session });

      await session.commitTransaction();
      session.endSession();

      const result = await Cart.deleteOne({ _id: cart._id, status: "expired" });
      if (result.deletedCount > 0) {
        log(
          `[cart-reclaimer] Deleted expired cart ${cart._id} (post-expiresAt) `
          + `(had returned items)`
        );
      }
    } catch (e: any) {
      await session.abortTransaction();
      session.endSession();
      log(
        `[cart-reclaimer] reclaimExpiredCarts failed for ${stale._id}: ${e?.message || e}`
      );
    }
  }
}

/**
 * At cut-off (shift end - 15 min): return AMS qty and delete carts
 * for the CURRENT service day + shift. Runs continuously; only acts in [cutoff, end).
 */
export async function cutoffShiftReclaim(log: (m: string) => void = () => {}) {
  const cfgs = await ShiftConfig.find(
    {},
    { name: 1, timezone: 1, generalStartMin: 1, generalEndMin: 1 }
  ).lean();

  const now = new Date();

  for (const cfg of cfgs) {
    const { serviceDayUTC, cutoffUTC, endUTC } = calcShiftCutoffUTC({
      tz: cfg.timezone,
      startMin: cfg.generalStartMin,
      endMin: cfg.generalEndMin,
      // cutoffMin defaults to 15 inside helper
    });

    // Only act between [cutoff, end)
    if (now >= cutoffUTC && now < endUTC) {
      const cursor = Cart.find({
        availableDate: serviceDayUTC,
        availableShift: cfg.name,
        status: "active",
      }).cursor();

      for await (const cart of cursor) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const fresh = await Cart.findOne({
            _id: cart._id,
            availableDate: serviceDayUTC,
            availableShift: cfg.name,
            status: "active",
          }).session(session);

          if (!fresh) {
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          await returnAllLines(fresh as any, session);

          fresh.status = "expired";
          // IMPORTANT: clear via set() to avoid TS 2740
          fresh.set("items", []);
          fresh.lastActivityAt = new Date();
          await fresh.save({ session });

          await session.commitTransaction();
          session.endSession();

          const del = await Cart.deleteOne({
            _id: fresh._id,
            status: "expired",
          });

          log(
            `[cart-reclaimer] Cutoff reclaim '${cfg.name}' ${serviceDayUTC.toISOString().slice(0, 10)} `
              + `— reclaimed & deleted cart=${fresh._id}, deleted=${del.deletedCount}`
          );
        } catch (e: any) {
          await session.abortTransaction();
          session.endSession();
          log(
            `[cart-reclaimer] cutoffShiftReclaim failed for ${cart._id}: ${e?.message || e}`
          );
        }
      }
    }
  }
}

/**
 * Shift end safety: after the shift end time, nuke any remaining active carts
 * for that (serviceDay, shift). Safety net; inventory should have been returned at cutoff.
 * Here we only clear carts; no AMS adjustment.
 */
export async function endShiftReclaim(log: (m: string) => void = () => {}) {
  const cfgs = await ShiftConfig.find(
    {},
    { name: 1, timezone: 1, generalStartMin: 1, generalEndMin: 1 }
  ).lean();

  const now = new Date();

  for (const cfg of cfgs) {
    const { serviceDayUTC, endUTC } = calcShiftCutoffUTC({
      tz: cfg.timezone,
      startMin: cfg.generalStartMin,
      endMin: cfg.generalEndMin,
    });

    if (now >= endUTC) {
      const u = await Cart.updateMany(
        {
          availableDate: serviceDayUTC,
          availableShift: cfg.name,
          status: "active",
        },
        { $set: { items: [], status: "expired", lastActivityAt: new Date() } }
      );

      const d = await Cart.deleteMany({
        availableDate: serviceDayUTC,
        availableShift: cfg.name,
        status: "expired",
        items: { $size: 0 },
      });

      log(
        `[cart-reclaimer] End-shift reclaim '${cfg.name}' ${serviceDayUTC
          .toISOString()
          .slice(0, 10)} — expired ${u.modifiedCount}, deleted ${d.deletedCount}`
      );
    }
  }
}

/** Start all reclaim loops; returns a stopper for graceful shutdown. */
export function startCartReclaimer(opts?: {
  intervalMs?: number;
  enabled?: boolean;
  log?: (msg: string) => void;
}) {
  const intervalMs =
    opts?.intervalMs ?? Number(process.env.CART_RECLAIMER_INTERVAL_MS ?? 60_000);
  const enabled =
    opts?.enabled ?? (process.env.CART_RECLAIMER_ENABLED ?? "true") !== "false";
  const log = opts?.log ?? console.log;

  const timers: NodeJS.Timeout[] = [];

  if (!enabled) {
    log("[cart-reclaimer] disabled");
    return { stop: () => {} };
  }

  log(`[cart-reclaimer] starting, interval=${intervalMs}ms`);

  const t1 = setInterval(() => {
    reclaimExpiredCarts(undefined, log).catch((e) =>
      log(`[cart-reclaimer] reclaimExpiredCarts error: ${e?.message || e}`)
    );
  }, intervalMs);

  const t2 = setInterval(() => {
    endShiftReclaim(log).catch((e) =>
      log(`[cart-reclaimer] endShiftReclaim error: ${e?.message || e}`)
    );
  }, intervalMs);

  const t3 = setInterval(() => {
    cutoffShiftReclaim(log).catch((e) =>
      log(`[cart-reclaimer] cutoffShiftReclaim error: ${e?.message || e}`)
    );
  }, intervalMs);

  t1.unref?.();
  t2.unref?.();
  t3.unref?.();
  timers.push(t1, t2, t3);

  return {
    stop() {
      timers.forEach(clearInterval);
      log("[cart-reclaimer] stopped");
    },
  };
}
