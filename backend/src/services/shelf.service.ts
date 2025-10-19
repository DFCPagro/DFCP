// src/services/shelf.service.ts
import { Types } from "mongoose";
import Shelf from "../models/Shelf.model";
import ContainerOps from "../models/ContainerOps.model";
import ApiError from "../utils/ApiError";
import { CrowdService } from "./shelfCrowd.service";
import { isObjId } from "@/utils/validations/mongose";

export namespace ShelfService {
  /** Fetch one shelf (lean) with optional guards. */
  export async function getShelfById(shelfId: string) {
    const s = await Shelf.findById(shelfId).lean();
    if (!s) throw new ApiError(404, "Shelf not found");
    return s;
  }

  /** Find a shelf by composite keys (center + shelf code) */
  export async function getByCenterAndCode(
    logisticCenterId: string | Types.ObjectId,
    shelfCode: string
  ) {
    const s = await Shelf.findOne({
      logisticCenterId: new Types.ObjectId(logisticCenterId),
      shelfId: shelfCode,
    }).lean();
    if (!s) throw new ApiError(404, "Shelf not found");
    return s;
  }

  /**
   * Place a container into a specific slot.
   */
  export async function placeContainer(args: {
  shelfMongoId: string;
  slotId: string;
  containerOpsId: string;
  weightKg: number;
  userId: string | Types.ObjectId;
}) {
  const { shelfMongoId, slotId, containerOpsId, weightKg, userId } = args;

  // ---- hard validation up-front ----
  if (!isObjId(shelfMongoId)) throw new ApiError(400, "Invalid shelfMongoId");
  if (typeof slotId !== "string" || !slotId.trim()) throw new ApiError(400, "Invalid slotId");
  if (!isObjId(containerOpsId)) throw new ApiError(400, "Invalid containerOpsId");
  if (typeof weightKg !== "number" || Number.isNaN(weightKg)) {
    throw new ApiError(400, "weightKg must be a number");
  }
  if (weightKg < 0) throw new ApiError(400, "Weight must be >= 0");

  const shelf = await Shelf.findById(shelfMongoId);
  if (!shelf) throw new ApiError(404, "Shelf not found");

  const ops = await ContainerOps.findById(containerOpsId);
  if (!ops) throw new ApiError(404, "ContainerOps not found");

  if (String(ops.logisticCenterId) !== String(shelf.logisticCenterId)) {
    throw new ApiError(400, "Container and shelf belong to different logistics centers");
  }

  const slot = shelf.slots.find((s) => s.slotId === slotId);
  if (!slot) throw new ApiError(404, "Slot not found on shelf");
  if (slot.containerOpsId) throw new ApiError(400, "Slot is occupied");
  if (slot.capacityKg != null && weightKg > slot.capacityKg) {
    throw new ApiError(400, "Exceeds slot capacity");
  }

  // ---- safe assignments ----
  (slot as any).containerOpsId = new Types.ObjectId(containerOpsId);
  slot.currentWeightKg = weightKg;
  slot.occupiedAt = new Date();
  (slot as any).emptiedAt = null;

  shelf.currentWeightKg = (shelf.currentWeightKg || 0) + weightKg;
  shelf.occupiedSlots = (shelf.occupiedSlots || 0) + 1;

  await shelf.save();

  ops.state = "shelved";
  ops.location = {
    area: "shelf",
    zone: shelf.zone ?? null,
    aisle: shelf.aisle ?? null,
    shelfId: shelf._id,
    slotId,
    updatedAt: new Date(),
  } as any;

  ops.auditTrail.push({
    userId: isObjId(userId as any) ? new Types.ObjectId(userId as any) : (userId as any),
    action: "shelved",
    note: `Shelf ${shelf.shelfId} slot ${slotId}`,
    timestamp: new Date(),
    meta: { shelfId: shelf._id, slotId },
  } as any);

  await ops.save();

  return { shelf: shelf.toObject(), containerOps: ops.toObject() };
}

  /**
   * Consume weight from a slot (e.g., picker takes items).
   */
  export async function consumeFromSlot(args: {
    shelfMongoId: string;
    slotId: string;
    amountKg: number;
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, amountKg, userId } = args;
    if (amountKg <= 0) throw new ApiError(400, "amountKg must be > 0");

    const shelf = await Shelf.findById(shelfMongoId);
    if (!shelf) throw new ApiError(404, "Shelf not found");

    const slot = shelf.slots.find((s) => s.slotId === slotId);
    if (!slot) throw new ApiError(404, "Slot not found");
    if (!slot.containerOpsId) throw new ApiError(400, "Slot is empty");

    if ((slot.currentWeightKg || 0) < amountKg) {
      throw new ApiError(400, "Not enough weight in slot");
    }

    slot.currentWeightKg = (slot.currentWeightKg || 0) - amountKg;
    shelf.currentWeightKg = (shelf.currentWeightKg || 0) - amountKg;
    await shelf.save();

    const ops = await ContainerOps.findById((slot as any).containerOpsId);
    if (ops) {
      ops.auditTrail.push({
        userId: new Types.ObjectId(userId),
        action: "pick_consume",
        note: `Consumed ${amountKg}kg from shelf ${shelf.shelfId} slot ${slotId}`,
        timestamp: new Date(),
        meta: { shelfId: shelf._id, slotId, amountKg },
      } as any);
      await ops.save();
    }

    return { shelf: shelf.toObject(), slotId, remainingKg: slot.currentWeightKg ?? 0 };
  }

  /**
   * Empty a slot (remove container, zero weight).
   */
  export async function emptySlot(args: {
    shelfMongoId: string;
    slotId: string;
    toArea?: "warehouse" | "out";
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, toArea = "warehouse", userId } = args;

    const shelf = await Shelf.findById(shelfMongoId);
    if (!shelf) throw new ApiError(404, "Shelf not found");

    const slot = shelf.slots.find((s) => s.slotId === slotId);
    if (!slot) throw new ApiError(404, "Slot not found");
    if (!slot.containerOpsId) throw new ApiError(400, "Slot already empty");

    const opsId = (slot as any).containerOpsId;
    const prevKg = slot.currentWeightKg || 0;

    // clear slot
    slot.currentWeightKg = 0;
    slot.occupiedAt = slot.occupiedAt || new Date(); // ensure valid Date
    slot.emptiedAt = new Date();
    (slot as any).containerOpsId = null;

    // shelf counters
    shelf.currentWeightKg = Math.max(0, (shelf.currentWeightKg || 0) - prevKg);
    shelf.occupiedSlots = Math.max(0, (shelf.occupiedSlots || 0) - 1);

    await shelf.save();

    const ops = await ContainerOps.findById(opsId);
    if (ops) {
      ops.location = {
        area: toArea,
        zone: null,
        aisle: null,
        shelfId: null,
        slotId: null,
        updatedAt: new Date(),
      } as any;
      ops.auditTrail.push({
        userId: new Types.ObjectId(userId),
        action: "shelf_empty",
        note: `Emptied from ${shelf.shelfId}/${slotId}, moved to ${toArea}`,
        timestamp: new Date(),
        meta: { shelfId: shelf._id, slotId, toArea, prevKg },
      } as any);
      await ops.save();
    }

    return { shelf: shelf.toObject(), slotId };
  }

  /**
   * Move container between slots (maybe different shelves).
   */
  export async function moveContainer(args: {
    fromShelfId: string;
    fromSlotId: string;
    toShelfId: string;
    toSlotId: string;
    userId: string | Types.ObjectId;
  }) {
    const { fromShelfId, fromSlotId, toShelfId, toSlotId, userId } = args;

    const from = await Shelf.findById(fromShelfId);
    if (!from) throw new ApiError(404, "Source shelf not found");
    const src = from.slots.find((s) => s.slotId === fromSlotId);
    if (!src || !src.containerOpsId) throw new ApiError(400, "Source slot is empty");

    const to = await Shelf.findById(toShelfId);
    if (!to) throw new ApiError(404, "Target shelf not found");
    const dst = to.slots.find((s) => s.slotId === toSlotId);
    if (!dst) throw new ApiError(404, "Target slot not found");
    if (dst.containerOpsId) throw new ApiError(400, "Target slot occupied");

    const moveKg = src.currentWeightKg || 0;

    // fill dst
    (dst as any).containerOpsId = (src as any).containerOpsId;
    dst.currentWeightKg = moveKg;
    dst.occupiedAt = new Date();
    (dst as any).emptiedAt = null;

    to.currentWeightKg = (to.currentWeightKg || 0) + moveKg;
    to.occupiedSlots = (to.occupiedSlots || 0) + 1;

    // vacate src
    (src as any).containerOpsId = null;
    src.currentWeightKg = 0;
    src.emptiedAt = new Date();

    from.currentWeightKg = Math.max(0, (from.currentWeightKg || 0) - moveKg);
    from.occupiedSlots = Math.max(0, (from.occupiedSlots || 0) - 1);

    await Promise.all([from.save(), to.save()]);

    const ops = await ContainerOps.findById((dst as any).containerOpsId);
    if (ops) {
      ops.location = {
        area: "shelf",
        zone: to.zone ?? null,
        aisle: to.aisle ?? null,
        shelfId: to._id,
        slotId: toSlotId,
        updatedAt: new Date(),
      } as any;
      ops.auditTrail.push({
        userId: new Types.ObjectId(userId),
        action: "shelf_move",
        note: `Move: ${from.shelfId}/${fromSlotId} → ${to.shelfId}/${toSlotId}`,
        timestamp: new Date(),
        meta: { fromShelfId, fromSlotId, toShelfId, toSlotId, moveKg },
      } as any);
      await ops.save();
    }

    return { from: from.toObject(), to: to.toObject(), movedKg: moveKg };
  }

  /** Crowd tracking: start */
  export async function markShelfTaskStart(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await CrowdService.bump(args.shelfId, +1, args.kind, String(args.userId));
    return { ok: true };
  }

  /** Crowd tracking: end */
  export async function markShelfTaskEnd(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await CrowdService.bump(args.shelfId, -1, args.kind, String(args.userId));
    return { ok: true };
  }

  /** Read a shelf with live crowd score */
  export async function getShelfWithCrowdScore(shelfId: string) {
    const s = await getShelfById(shelfId);
    const crowd = await CrowdService.computeShelfCrowd(shelfId);
    return { shelf: s, crowd };
  }

    /**
   * Refill a picker slot from a warehouse slot up to targetFillKg.
   * - does NOT change containerOpsId bindings
   * - decrements warehouse slot weight
   * - increments picker slot weight
   * - updates both shelves' currentWeightKg
   * - appends audits to involved ContainerOps (if present)
   */
  export async function refillFromWarehouse(args: {
    pickerShelfId: string;     // Shelf _id (picker)
    pickerSlotId: string;
    warehouseShelfId: string;  // Shelf _id (warehouse)
    warehouseSlotId: string;
    targetFillKg: number;      // target level for picker slot
    userId: string | Types.ObjectId;
  }) {
    const { pickerShelfId, pickerSlotId, warehouseShelfId, warehouseSlotId, targetFillKg, userId } = args;

    if (targetFillKg <= 0) throw new ApiError(400, "targetFillKg must be > 0");

    const picker = await Shelf.findById(pickerShelfId);
    if (!picker) throw new ApiError(404, "Picker shelf not found");
    const pSlot = picker.slots.find(s => s.slotId === pickerSlotId);
    if (!pSlot) throw new ApiError(404, "Picker slot not found");

    const ware = await Shelf.findById(warehouseShelfId);
    if (!ware) throw new ApiError(404, "Warehouse shelf not found");
    const wSlot = ware.slots.find(s => s.slotId === warehouseSlotId);
    if (!wSlot) throw new ApiError(404, "Warehouse slot not found");

    // sanity: same LC
    if (String(picker.logisticCenterId) !== String(ware.logisticCenterId)) {
      throw new ApiError(400, "Shelves belong to different logistics centers");
    }

    const P = pSlot.currentWeightKg || 0;
    const W = wSlot.currentWeightKg || 0;

    const need = Math.max(0, targetFillKg - P);
    const moved = Math.min(need, W);

    if (moved <= 0) {
      return {
        movedKg: 0,
        pickerSlotWeightAfter: P,
        warehouseSlotWeightAfter: W,
        note: "Nothing to move",
      };
    }

    // capacity guard for picker slot
    if (pSlot.capacityKg != null && P + moved > pSlot.capacityKg) {
      throw new ApiError(400, `Picker slot capacity exceeded: capacity=${pSlot.capacityKg}, requested=${P + moved}`);
    }

    // decrement warehouse slot
    wSlot.currentWeightKg = W - moved;
    ware.currentWeightKg = Math.max(0, (ware.currentWeightKg || 0) - moved);

    // increment picker slot
    pSlot.currentWeightKg = P + moved;
    picker.currentWeightKg = (picker.currentWeightKg || 0) + moved;

    await Promise.all([picker.save(), ware.save()]);

    // Optional audits on underlying containers
    const now = new Date();
    if ((wSlot as any).containerOpsId) {
      const srcOps = await ContainerOps.findById((wSlot as any).containerOpsId);
      if (srcOps) {
        srcOps.auditTrail.push({
          userId: new Types.ObjectId(userId),
          action: "refill_out",
          note: `Refill ${moved}kg from ${ware.shelfId}/${warehouseSlotId} to ${picker.shelfId}/${pickerSlotId}`,
          timestamp: now,
          meta: { movedKg: moved, fromShelfId: ware._id, fromSlotId: warehouseSlotId, toShelfId: picker._id, toSlotId: pickerSlotId },
        } as any);
        await srcOps.save();
      }
    }
    if ((pSlot as any).containerOpsId) {
      const dstOps = await ContainerOps.findById((pSlot as any).containerOpsId);
      if (dstOps) {
        dstOps.auditTrail.push({
          userId: new Types.ObjectId(userId),
          action: "refill_in",
          note: `Refill ${moved}kg into ${picker.shelfId}/${pickerSlotId} from ${ware.shelfId}/${warehouseSlotId}`,
          timestamp: now,
          meta: { movedKg: moved, fromShelfId: ware._id, fromSlotId: warehouseSlotId, toShelfId: picker._id, toSlotId: pickerSlotId },
        } as any);
        await dstOps.save();
      }
    }

    return {
      movedKg: moved,
      pickerShelfId,
      pickerSlotId,
      warehouseShelfId,
      warehouseSlotId,
      pickerSlotWeightAfter: pSlot.currentWeightKg,
      warehouseSlotWeightAfter: wSlot.currentWeightKg,
    };
  }

}

