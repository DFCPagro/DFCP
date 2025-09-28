import mongoose from "mongoose";
import Cart from "@/models/cart.model";
import ShiftConfig from "@/models/shiftConfig.model";
import { calcShiftCutoffUTC } from "@/helpers/time/shiftCutoff";
import {
  expireCartAndDelete,
  reclaimCartWithoutDelete,
} from "@/services/cart.service";

/**
 * Mid-shift: carts whose expiresAt passed — return stock then delete.
 */
export async function reclaimExpiredCarts(
  batch = 200,
  log: (m: string) => void = () => {}
) {
  const now = new Date();
  const cursor = Cart.find({ status: "active", expiresAt: { $lte: now } })
    .limit(batch)
    .cursor();

  for await (const stale of cursor) {
    try {
      const fresh = await Cart.findOne({
        _id: stale._id,
        status: "active",
        expiresAt: { $lte: new Date() },
      });

      if (!fresh) continue;

      log(
        `[cart-reclaimer] expiring cart=${fresh._id} now=${new Date().toISOString()} ` +
          `expiresAt=${fresh.expiresAt?.toISOString()} Δms=${
            Date.now() - (fresh.expiresAt?.getTime() ?? Date.now())
          }`
      );

      await expireCartAndDelete({ cartId: fresh._id, reason: "expired" });
    } catch (e: any) {
      log(
        `[cart-reclaimer] reclaimExpiredCarts failed for ${stale._id}: ${
          e?.message || e
        }`
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
        try {
          const fresh = await Cart.findOne({
            _id: cart._id,
            availableDate: serviceDayUTC,
            availableShift: cfg.name,
            status: "active",
          });

          if (!fresh) continue;

          await expireCartAndDelete({
            cartId: fresh._id,
            reason: "cutoff",
          });

          log(
            `[cart-reclaimer] Cutoff reclaim '${cfg.name}' ${serviceDayUTC
              .toISOString()
              .slice(0, 10)} — reclaimed & deleted cart=${fresh._id}`
          );
        } catch (e: any) {
          log(
            `[cart-reclaimer] cutoffShiftReclaim failed for ${cart._id}: ${
              e?.message || e
            }`
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
      const cursor = Cart.find({
        availableDate: serviceDayUTC,
        availableShift: cfg.name,
        status: "active",
      }).cursor();

      for await (const cart of cursor) {
        try {
          const fresh = await Cart.findOne({
            _id: cart._id,
            availableDate: serviceDayUTC,
            availableShift: cfg.name,
            status: "active",
          });

          if (!fresh) continue;

          await reclaimCartWithoutDelete(fresh._id);

          log(
            `[cart-reclaimer] End-shift reclaim '${cfg.name}' ${serviceDayUTC
              .toISOString()
              .slice(0, 10)} — expired cart=${fresh._id}`
          );
        } catch (e: any) {
          log(
            `[cart-reclaimer] endShiftReclaim failed for ${cart._id}: ${
              e?.message || e
            }`
          );
        }
      }
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
