import { startSession, Types } from "mongoose";
import ContainerOps from "../models/ContainerOps.model";
import Shelf from "../models/Shelf.model";
import ApiError from "../utils/ApiError";

/**
 * LogisticsService encapsulates the minimal state machine for container
 * operations inside the logistics centre.  It provides higher-level
 * placement and consumption helpers that work across multiple shelves
 * and slots while preserving capacity and weight invariants.  All
 * operations in this service use MongoDB transactions and Decimal128
 * arithmetic to ensure atomicity and precision.
 */
export namespace LogisticsService {
  /**
   * Attempt to place the remaining weight of a container across any
   * available slots within the given logistics centre.  This function
   * automatically splits the placement across multiple shelves/slots
   * where necessary.  The container will remain in the `sorted` state
   * until its total placed weight equals the intended weight; at that
   * point it transitions to `shelved`.  A result object describing
   * how much weight was placed and how much remains is returned.
   */
  export async function splitPlaceContainer(args: {
    containerOpsId: string;
    logisticCenterId?: string;
    shelfType?: "warehouse" | "picker" | "delivery" | string;
  }) {
    const { containerOpsId, logisticCenterId, shelfType = "picker" } = args;
    const session = await startSession();
    let result: any = { placedKg: 0, leftoverKg: 0, placements: [] as any[] };
    await session.withTransaction(async () => {
      // 1) Fetch container operations doc within the transaction
      const ops = await ContainerOps.findById(containerOpsId).session(session);
      if (!ops) throw new ApiError(404, "ContainerOps not found");
      // Determine logistic centre from args or document
      const lcId = logisticCenterId || (ops as any).logisticCenterId;
      if (!lcId) throw new ApiError(400, "logisticCenterId must be provided or present on container");
      // Only allow placement from sorted or shelved state
      if (!["sorted", "shelved"].includes(String(ops.state))) {
        throw new ApiError(400, `Cannot place container in state ${ops.state}`);
      }
      // Compute remaining weight to place: intendedWeightKg - totalWeightKg
      const intended = parseFloat((ops as any).intendedWeightKg?.toString() || "0");
      const placed = parseFloat((ops as any).totalWeightKg?.toString() || "0");
      let remaining = intended - placed;
      if (remaining <= 0) {
        result.leftoverKg = 0;
        result.placedKg = 0;
        return;
      }
      // 2) Fetch candidate shelves of the desired type within the centre.
      // Sort by busy/occupied metrics to balance load.
      const shelves = await Shelf.find({ logisticCenterId: lcId, type: shelfType }).session(session).lean();
      // Sort shelves by avoid flag and crowd metrics
      shelves.sort((a: any, b: any) => {
        // avoid temporarily avoided shelves
        if (a.isTemporarilyAvoid && !b.isTemporarilyAvoid) return 1;
        if (!a.isTemporarilyAvoid && b.isTemporarilyAvoid) return -1;
        // fewer liveActiveTasks is better
        if ((a.liveActiveTasks || 0) !== (b.liveActiveTasks || 0)) {
          return (a.liveActiveTasks || 0) - (b.liveActiveTasks || 0);
        }
        // lower busyScore is better
        if ((a.busyScore || 0) !== (b.busyScore || 0)) {
          return (a.busyScore || 0) - (b.busyScore || 0);
        }
        // fewer occupiedSlots is better
        if ((a.occupiedSlots || 0) !== (b.occupiedSlots || 0)) {
          return (a.occupiedSlots || 0) - (b.occupiedSlots || 0);
        }
        return 0;
      });
      // 3) Iterate over shelves and slots, allocating weight until none remains
      for (const shelf of shelves) {
        if (remaining <= 0) break;
        // compute shelf available capacity
        const shelfCap = parseFloat((shelf.maxWeightKg as any)?.toString() || "0");
        const shelfCurrent = parseFloat((shelf.currentWeightKg as any)?.toString() || "0");
        let shelfAvail = shelfCap - shelfCurrent;
        if (shelfAvail <= 0) continue;
        // iterate over slots
        for (const slot of shelf.slots as any[]) {
          if (remaining <= 0) break;
          // compute slot availability
          const slotCap = parseFloat((slot.capacityKg as any)?.toString() || "0");
          const slotCurrent = parseFloat((slot.currentWeightKg as any)?.toString() || "0");
          let slotAvail = slotCap - slotCurrent;
          // skip if no capacity
          if (slotAvail <= 0) continue;
          // additional guard: cannot exceed shelf availability either
          const canAdd = Math.min(slotAvail, shelfAvail, remaining);
          if (canAdd <= 0) continue;
          // Perform placement: update shelf slot weights atomically
          const delta = canAdd;
          // 3a) Update shelf slot weights atomically
          const deltaDecimal = Types.Decimal128.fromString(delta.toString());
          const update: any = {
            $inc: {
              currentWeightKg: deltaDecimal,
              ["slots.$[s].currentWeightKg"]: deltaDecimal,
            },
            $set: { updatedAt: new Date() },
          };
          // set container assignment and occupied timestamps if slot is empty
          if (!slot.containerOpsId) {
            update.$set["slots.$[s].containerOpsId"] = ops._id;
            update.$set["slots.$[s].occupiedAt"] = new Date();
            update.$set["slots.$[s].emptiedAt"] = null;
            // increment occupiedSlots on first occupancy
            update.$inc.occupiedSlots = 1;
          }
          await Shelf.updateOne(
            { _id: shelf._id },
            update,
            { arrayFilters: [{ "s.slotId": slot.slotId }], session }
          );
          // 3b) Update container distributed weights and total weight
          // find existing entry
          let found = false;
          for (const dw of (ops as any).distributedWeights || []) {
            if (String(dw.shelfId) === String(shelf._id) && String(dw.slotId) === String(slot.slotId)) {
              // increment existing decimal
              const prev = parseFloat((dw.weightKg as any)?.toString() || "0");
              const next = prev + delta;
              dw.weightKg = Types.Decimal128.fromString(next.toString());
              found = true;
              break;
            }
          }
          if (!found) {
            (ops as any).distributedWeights.push({
              shelfId: shelf._id,
              slotId: slot.slotId,
              weightKg: Types.Decimal128.fromString(delta.toString()),
            });
          }
          // update totals
          const newTotal = placed + result.placedKg + delta;
          (ops as any).totalWeightKg = Types.Decimal128.fromString(newTotal.toString());
          result.placedKg += delta;
          // decrement remaining and shelfAvail
          remaining -= delta;
          shelfAvail -= delta;
          // Add to placements list
          result.placements.push({ shelfId: shelf._id, slotId: slot.slotId, placedKg: delta });
        }
      }
      // leftover is whatever remains unplaced
      result.leftoverKg = remaining;
      // update container state based on whether fully placed
      if (remaining <= 0) {
        ops.state = "shelved" as any;
      } else {
        ops.state = "sorted" as any;
      }
      await ops.save({ session });
    });
    session.endSession();
    return result;
  }

  /**
   * Consume (pick) a given weight from a container on a specific shelf/slot.
   * This helper enforces kg-only consumption and ensures that slot and
   * shelf weights never drop below zero.  It also updates the container
   * state to `picked` on first consumption and to `depleted` when all
   * weight has been consumed.
   */
  export async function consumeWeight(args: {
    containerOpsId: string;
    shelfId: string;
    slotId: string;
    amountKg: number;
  }) {
    const { containerOpsId, shelfId, slotId, amountKg } = args;
    if (amountKg <= 0) throw new ApiError(400, "amountKg must be > 0");
    const session = await startSession();
    let result: any;
    await session.withTransaction(async () => {
      // fetch container
      const ops = await ContainerOps.findById(containerOpsId).session(session);
      if (!ops) throw new ApiError(404, "ContainerOps not found");
      // Only allow consumption from shelved or picked states
      if (!["shelved", "picked"].includes(String(ops.state))) {
        throw new ApiError(400, `Cannot consume from container in state ${ops.state}`);
      }
      // find distributed entry
      const dwList = (ops as any).distributedWeights || [];
      const idx = dwList.findIndex((dw: any) => String(dw.shelfId) === String(shelfId) && String(dw.slotId) === String(slotId));
      if (idx < 0) throw new ApiError(400, "Specified shelf/slot does not contain this container");
      const dw = dwList[idx];
      const currentKg = parseFloat((dw.weightKg as any)?.toString() || "0");
      if (currentKg < amountKg) throw new ApiError(400, "Not enough weight at the specified slot");
      // compute new weights
      const delta = amountKg;
      const newSlotKg = currentKg - delta;
      const totalCurrent = parseFloat((ops as any).totalWeightKg?.toString() || "0");
      const newTotal = totalCurrent - delta;
      // 1) update shelf slot and aggregate
      const deltaDec = Types.Decimal128.fromString((-delta).toString());
      const update: any = {
        $inc: {
          currentWeightKg: deltaDec,
          ["slots.$[s].currentWeightKg"]: deltaDec,
        },
        $set: { updatedAt: new Date() },
      };
      // if slot becomes empty, free the slot
      let freeSlot = false;
      if (newSlotKg <= 0) {
        update.$set["slots.$[s].containerOpsId"] = null;
        update.$set["slots.$[s].emptiedAt"] = new Date();
        update.$set["slots.$[s].occupiedAt"] = null;
        update.$inc.occupiedSlots = -1;
        freeSlot = true;
      }
      await Shelf.updateOne(
        { _id: shelfId },
        update,
        { arrayFilters: [{ "s.slotId": slotId }], session }
      );
      // 2) update container distributedWeights and total weight
      if (freeSlot) {
        dwList.splice(idx, 1);
      } else {
        dw.weightKg = Types.Decimal128.fromString(newSlotKg.toString());
      }
      (ops as any).totalWeightKg = Types.Decimal128.fromString(newTotal.toString());
      // set state transitions
      if (newTotal <= 0) {
        ops.state = "depleted" as any;
      } else if (ops.state === "shelved") {
        ops.state = "picked" as any;
      }
      await ops.save({ session });
      result = { newTotalKg: newTotal, newSlotKg, state: ops.state };
    });
    session.endSession();
    return result;
  }
}
