// services/deliveryShelving.service.ts
import { Types } from "mongoose";
import Shelf from "../models/Shelf.model";
import Order from "../models/order.model";
import OrderPackage from "../models/OrderPackage.model";
import ApiError from "../utils/ApiError";
import {
  toObjectIdOrThrow,
  isObjIdLike,
} from "@/utils/validations/mongose";

/**
 * Strategy:
 * - If you use "one slot per deliverer", set slotId = delivererId string.
 * - Otherwise, use the first slot on the chosen shelf (or any policy you like).
 */
function pickSlotIdForDeliverer(opts: {
  shelf: any;
  delivererId: Types.ObjectId | string;
}): string {
  const delivererIdStr = String(opts.delivererId);
  const delivererSlot = (opts.shelf.slots || []).find(
    (s: any) => String(s.delivererId || "") === delivererIdStr
  );
  if (delivererSlot) return String(delivererSlot.slotId);

  // fallback: a slot with allowedOccupant=package and free capacity (by count or weight)
  const available = (opts.shelf.slots || []).find((s: any) => {
    const canHoldPackages =
      s.allowedOccupant === "any" || s.allowedOccupant === "package";
    if (!canHoldPackages) return false;

    if (typeof s.maxPackages === "number" && s.maxPackages > 0) {
      if ((s.currentPackages || 0) >= s.maxPackages) return false;
    }
    return true;
  });

  if (!available)
    throw new ApiError(409, "No suitable delivery slot available on shelf");
  return String(available.slotId);
}

/**
 * Normalize possible legacy field `LogisticsCenterId` to `logisticCenterId`
 */
function getOrderCenterId(order: any): Types.ObjectId {
  // prefer lowercase if present
  if (order?.logisticCenterId && isObjIdLike(order.logisticCenterId)) {
    return toObjectIdOrThrow(order.logisticCenterId, "logisticCenterId");
  }
  // support legacy capitalized field (your older code path)
  if (order?.LogisticsCenterId && isObjIdLike(order.LogisticsCenterId)) {
    return toObjectIdOrThrow(order.LogisticsCenterId, "LogisticsCenterId");
  }
  throw new ApiError(400, "Order missing logisticCenterId");
}

/**
 * Stage a single order’s package to the delivery shelf assigned to its deliverer.
 * Returns the OrderPackage doc (staged) and where it was put.
 */
export async function stageOrderToDelivererLane(args: {
  orderId: string;
  packageWeightKg?: number; // optional estimate
}) {
  const { orderId, packageWeightKg = 0 } = args;

  const order = await Order.findById(orderId).lean();
  if (!order) throw new ApiError(404, "Order not found");

  const centerId = getOrderCenterId(order);

  if (!order.assignedDelivererId) {
    throw new ApiError(400, "Order not assigned to a deliverer");
  }
  const delivererId = toObjectIdOrThrow(
    order.assignedDelivererId,
    "assignedDelivererId"
  );

  // Find a delivery shelf assigned to this deliverer in this center.
  const shelf = await Shelf.findOne({
    logisticCenterId: centerId,
    isDeliveryShelf: true,
    assignedDelivererId: delivererId,
  }).lean();

  if (!shelf) {
    throw new ApiError(
      404,
      "No delivery shelf assigned to this deliverer in this center"
    );
  }

  // Choose a slot
  const slotId = pickSlotIdForDeliverer({ shelf, delivererId });

  // Idempotency: reuse existing package if present and in created/staged state.
  let pkg = await OrderPackage.findOne({
    orderId: order._id,
    logisticCenterId: centerId,
    state: { $in: ["created", "staged"] },
  });

  if (!pkg) {
    pkg = await OrderPackage.create({
      orderId: order._id,
      logisticCenterId: centerId,
      delivererId,
      estWeightKg: packageWeightKg,
      state: "created",
    });
  }

  // Update package to staged + location (instance method must exist on the model)
  if (typeof (pkg as any).markStaged === "function") {
    (pkg as any).markStaged(shelf.shelfId, slotId);
  } else {
    // fallback if method missing
    pkg.state = "staged";
    (pkg as any).shelfId = shelf.shelfId;
    (pkg as any).slotId = slotId;
  }
  await pkg.save();

  // Update shelf aggregations
  await (Shelf as any).stagePackage({
    shelfId: shelf.shelfId,
    logisticCenterId: centerId,
    slotId,
    packageId: pkg._id,
    packageWeightKg,
    delivererId,
  });

  return {
    ok: true,
    package: pkg.toObject(),
    stagedAt: { shelfId: shelf.shelfId, slotId },
  };
}

/**
 * Unstage (remove) a package from its slot.
 */
export async function unstageOrderPackage(args: {
  orderPackageId: string;
  packageWeightKg?: number;
}) {
  const { orderPackageId, packageWeightKg = 0 } = args;
  const pkg = await OrderPackage.findById(orderPackageId);
  if (!pkg) throw new ApiError(404, "OrderPackage not found");
  if (pkg.state !== "staged")
    throw new ApiError(409, `Package not staged (state=${pkg.state})`);

  const centerId = toObjectIdOrThrow(
    (pkg as any).logisticCenterId,
    "logisticCenterId"
  );
  const shelfId = (pkg as any).shelfId as string | undefined;
  const slotId = (pkg as any).slotId as string | undefined;

  if (!shelfId || !slotId) {
    throw new ApiError(400, "Package missing shelf/slot info");
  }

  await (Shelf as any).unstagePackage({
    shelfId,
    logisticCenterId: centerId,
    slotId,
    packageId: pkg._id,
    packageWeightKg,
  });

  pkg.state = "created";
  (pkg as any).shelfId = null;
  (pkg as any).slotId = null;
  await pkg.save();

  return { ok: true };
}

/**
 * Move a staged package to another deliverer’s lane (same or different shelf).
 */
export async function moveStagedOrderPackage(args: {
  orderPackageId: string;
  toDelivererId: string;
  toShelfId?: string; // optional explicit shelfId; if omitted we look up via (center + deliverer)
  toSlotId?: string; // optional; if omitted we pick per strategy
  packageWeightKg?: number;
}) {
  const {
    orderPackageId,
    toDelivererId,
    toShelfId,
    toSlotId,
    packageWeightKg = 0,
  } = args;

  const pkg = await OrderPackage.findById(orderPackageId);
  if (!pkg) throw new ApiError(404, "OrderPackage not found");
  if (pkg.state !== "staged")
    throw new ApiError(409, `Package not staged (state=${pkg.state})`);

  const centerId = toObjectIdOrThrow(
    (pkg as any).logisticCenterId,
    "logisticCenterId"
  );

  // Resolve current shelf
  const fromShelfId = (pkg as any).shelfId as string | undefined;
  const fromSlotId = (pkg as any).slotId as string | undefined;
  if (!fromShelfId || !fromSlotId)
    throw new ApiError(400, "Package missing current shelf/slot");

  // Resolve destination shelf
  const toDelivererObjId = toObjectIdOrThrow(toDelivererId, "toDelivererId");

  let destShelf = toShelfId
    ? await Shelf.findOne({
        logisticCenterId: centerId,
        shelfId: toShelfId,
        isDeliveryShelf: true,
      }).lean()
    : await Shelf.findOne({
        logisticCenterId: centerId,
        isDeliveryShelf: true,
        assignedDelivererId: toDelivererObjId,
      }).lean();

  if (!destShelf) throw new ApiError(404, "Destination delivery shelf not found");

  const destSlotId =
    toSlotId || pickSlotIdForDeliverer({ shelf: destShelf, delivererId: toDelivererObjId });

  if (destShelf.shelfId === fromShelfId && destSlotId === fromSlotId) {
    return { ok: true, note: "Already in target slot" };
  }

  // Same shelf => atomic helper
  if (destShelf.shelfId === fromShelfId) {
    await (Shelf as any).moveStagedPackage({
      shelfId: fromShelfId,
      logisticCenterId: centerId,
      fromSlotId: fromSlotId!,
      toSlotId: destSlotId,
      packageId: pkg._id,
      packageWeightKg,
      toDelivererId: toDelivererObjId,
    });
  } else {
    // Different shelf: unstage then stage
    await (Shelf as any).unstagePackage({
      shelfId: fromShelfId!,
      logisticCenterId: centerId,
      slotId: fromSlotId!,
      packageId: pkg._id,
      packageWeightKg,
    });

    await (Shelf as any).stagePackage({
      shelfId: destShelf.shelfId,
      logisticCenterId: centerId,
      slotId: destSlotId,
      packageId: pkg._id,
      packageWeightKg,
      delivererId: toDelivererObjId,
    });
  }

  // Update package doc
  (pkg as any).shelfId = destShelf.shelfId;
  (pkg as any).slotId = destSlotId;
  (pkg as any).delivererId = toDelivererObjId;
  await pkg.save();

  return {
    ok: true,
    from: { shelfId: fromShelfId, slotId: fromSlotId },
    to: { shelfId: destShelf.shelfId, slotId: destSlotId },
  };
}
