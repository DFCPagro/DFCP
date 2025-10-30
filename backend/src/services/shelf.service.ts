// FILE: src/services/shelf.service.ts
import { Types, startSession } from "mongoose";
import Shelf from "../models/Shelf.model";
import ContainerOps from "../models/ContainerOps.model";
import ApiError from "../utils/ApiError";
import { PersistedCrowdService } from "./crowdPersistence.service";
import { isObjId } from "@/utils/validations/mongose";
import { resolveDemandToKgForItem, type DemandInput } from "./items.service";

export namespace ShelfService {
  /**
   * List shelves by logistic center with optional filters.
   * Used by controller: GET /shelves?centerId=...&zone=A&type=picker
   */
export async function list(args: {
  logisticCenterId: string;
  zone?: string;
  type?: "picker" | "warehouse" | "staging" | "sorting" | "out" | string;
}) {
  const { logisticCenterId, zone, type } = args;
  if (!Types.ObjectId.isValid(logisticCenterId)) {
    throw new ApiError(400, "Invalid logisticCenterId");
  }

  const query: any = { logisticCenterId: new Types.ObjectId(logisticCenterId) };
  if (zone && typeof zone === "string") query.zone = zone.toUpperCase();
  if (type && typeof type === "string") query.type = type.toLowerCase();

  const rows = await Shelf.find(query).lean();
  return rows;
}


  // Backward-compat wrapper (older code may call this)
  export async function listByCenter(centerId: string) {
    return list({ logisticCenterId: centerId });
  }

 /**
 * Find the best shelf/slot to pick for a given FO id.
 *
 * Scoring (bigger is better):
 *   score =
 *     1.25*log1p(weightKg)
 *     + typeBoost(type)
 *     + proximityBoost(row,col)
 *     + demandFitBoost(weightKg, requiredKg)   // NEW
 *     + (isTemporarilyAvoid ? -5 : 0)
 *     - 0.04 * busyScore
 *     - 0.5 * liveActiveTasks
 *
 * Deterministic tie-breakers: higher weight, lower busyScore, fewer liveActiveTasks, shelfId asc, slotId asc.
 */
export async function findBestLocationForFO(args: {
  foId: string;
  // minimum kg at slot (kept; will be applied in addition to requiredKg when demand provided)
  minKg?: number;
  zone?: string;
  centerId?: string;
  excludeTemporarilyAvoid?: boolean; // default true
  maxBusyScore?: number;
  preferTypes?: Array<"warehouse" | "picker" | "delivery">;
  originRow?: number;
  originCol?: number;
  type: "warehouse" | "picker" | "delivery" | string;
  // send one of { qtyKg } or { qtyUnits } matching the item’s sell mode
  demand?: DemandInput;
}) {
  const {
    foId,
    minKg = 0,
    zone,
    type,
    centerId,
    excludeTemporarilyAvoid = true,
    maxBusyScore,
    preferTypes = ["picker", "delivery", "warehouse"],
    originRow,
    originCol,
    demand,
  } = args;

  // ---------- 1) Resolve the FO's container ops ----------
  const byObjId = Types.ObjectId.isValid(foId) ? { _id: new Types.ObjectId(foId) } : null;
  const ops =
    (await ContainerOps.findOne(byObjId || { foId }).lean()) ||
    (await ContainerOps.findOne({ fulfillmentOrderId: foId }).lean()) ||
    (await ContainerOps.findOne({ "order.foId": foId }).lean());

  if (!ops) throw new ApiError(404, "No ContainerOps found for provided FO id");

  // ---------- 1a) Resolve demand → requiredKg using the item on this FO ----------
  let requiredKg: number | null = null;
  let demandMeta: any = null;
  if (demand && ops.itemId) {
    try {
      const r = await resolveDemandToKgForItem(String(ops.itemId), demand);
      requiredKg = r.requiredKg; // kg needed to fulfill
      demandMeta = r;            // keep to echo in meta
    } catch (e: any) {
      // If demand conversion fails, surface a clear 400 with the original error
      throw new ApiError(400, `DemandError: ${e?.message || "invalid demand"}`);
    }
  }

  // ---------- 2) Build initial candidate list from distributed weights / location ----------
  type Candidate = {
    shelfId: Types.ObjectId;
    slotId: string;
    weightKg: number; // may be 0 if unknown (resolved from shelf.slots later)
  };

  const candidates: Candidate[] = [];
  const dw = (ops as any).distributedWeights || [];

  if (Array.isArray(dw) && dw.length > 0) {
    for (const e of dw) {
      if (!e?.shelfId || !e?.slotId) continue;
      const w = typeof e.weightKg === "number" ? Math.max(0, e.weightKg) : 0;
      candidates.push({ shelfId: new Types.ObjectId(e.shelfId), slotId: e.slotId, weightKg: w });
    }
  } else if ((ops as any).location?.area === "shelf" && (ops as any).location.shelfId && (ops as any).location.slotId) {
    const l = (ops as any).location;
    candidates.push({
      shelfId: new Types.ObjectId(l.shelfId),
      slotId: String(l.slotId),
      weightKg: 0, // resolve from shelf document
    });
  }

  if (candidates.length === 0) {
    throw new ApiError(404, "FO is not currently on any shelf/slot");
  }

  // ---------- 3) Fetch all involved shelves in a single query ----------
  const uniqShelfIds = Array.from(new Set(candidates.map(c => String(c.shelfId)))).map(id => new Types.ObjectId(id));
  const shelves = await Shelf.find(
    { _id: { $in: uniqShelfIds } },
    {
      shelfId: 1, type: 1, zone: 1, row: 1, col: 1,
      liveActiveTasks: 1, busyScore: 1, isTemporarilyAvoid: 1,
      logisticCenterId: 1, slots: 1,
    }
  ).lean();

  if (!shelves || shelves.length === 0) {
    throw new ApiError(404, "Candidate shelves not found");
  }

  const shelfById = new Map<string, any>(shelves.map(s => [String(s._id), s]));

  // ---------- 4) Normalize filters + compute enriched candidates ----------
  const zoneNorm = zone ? String(zone).toUpperCase() : undefined;
  const typeNorm = type ? String(type).toLowerCase() : undefined;
  const preferOrder = new Map(preferTypes.map((t, i) => [t, preferTypes.length - i])); // higher = better

  const enriched: Array<{
    shelfObjId: string;
    shelfCode: string | null;
    zone: string | null;
    type: string | null;
    slotId: string;
    weightKg: number;
    busyScore: number;
    liveActiveTasks: number;
    isTemporarilyAvoid: boolean;
    row: number | null;
    col: number | null;
    dist: number | null;
  }> = [];

  for (const c of candidates) {
    const s = shelfById.get(String(c.shelfId));
    if (!s) continue;

    // filter: LC
    if (centerId && String(s.logisticCenterId) !== String(centerId)) continue;
    // filter: zone
    if (zoneNorm && s.zone && String(s.zone).toUpperCase() !== zoneNorm) continue;
    // filter: type enum
    if (typeNorm && String(s.type).toLowerCase() !== typeNorm) continue;
    // filter: temporary avoid
    if (excludeTemporarilyAvoid && s.isTemporarilyAvoid) continue;
    // filter: busy cap
    if (typeof maxBusyScore === "number" && s.busyScore > maxBusyScore) continue;

    // actual slot kg (prefer shelf doc)
    const slot = Array.isArray(s.slots) ? s.slots.find((x: any) => x.slotId === c.slotId) : null;
    const slotKg = Math.max(0, typeof c.weightKg === "number" && c.weightKg > 0 ? c.weightKg : (slot?.currentWeightKg ?? 0));

    // respect both minKg and demand.requiredKg (NEW)
    const needKg = Math.max(minKg || 0, requiredKg ?? 0);
    if (slotKg < needKg) continue;

    // proximity
    let dist: number | null = null;
    if (typeof originRow === "number" && typeof originCol === "number" && typeof s.row === "number" && typeof s.col === "number") {
      dist = Math.abs(s.row - originRow) + Math.abs(s.col - originCol);
    }

    enriched.push({
      shelfObjId: String(c.shelfId),
      shelfCode: s.shelfId ?? null,
      zone: s.zone ?? null,
      type: s.type ?? null,
      slotId: c.slotId,
      weightKg: slotKg,
      busyScore: Number(s.busyScore || 0),
      liveActiveTasks: Number(s.liveActiveTasks || 0),
      isTemporarilyAvoid: !!s.isTemporarilyAvoid,
      row: typeof s.row === "number" ? s.row : null,
      col: typeof s.col === "number" ? s.col : null,
      dist,
    });
  }

  if (enriched.length === 0) {
    return {
      foId,
      best: null,
      candidates: [],
      note: "No shelf/slot meets the provided filters or demand quantity",
      meta: {
        demand: demandMeta,
        requiredKg: requiredKg ?? null,
      },
    };
  }

  // ---------- 5) Scoring ----------
  function typeBoost(t: string | null): number {
    if (!t) return 0;
    const key = String(t).toLowerCase();
    const rank = preferOrder.get(key as any) || 0;
    return rank; // picker(3) > delivery(2) > warehouse(1)
  }

  function proximityBoost(dist: number | null): number {
    if (dist == null) return 0;
    return 2.5 / (1 + dist / 4);
  }

  // NEW: reward good demand fit, lightly penalize huge surplus to avoid waste/extra shuttling
  function demandFitBoost(slotKg: number, demandKg: number | null): number {
    if (!demandKg || demandKg <= 0) return 0;
    const fit = Math.min(slotKg / demandKg, 1);          // 0..1
    const surplus = Math.max(0, (slotKg - demandKg) / demandKg); // 0..∞
    return 2.2 * Math.sqrt(fit) - 0.3 * Math.min(surplus, 1);
  }

  const scored = enriched.map((e) => {
    const w = 1.25 * Math.log1p(e.weightKg);
    const t = typeBoost(e.type);
    const p = proximityBoost(e.dist);
    const d = demandFitBoost(e.weightKg, requiredKg); // NEW
    const avoidPenalty = e.isTemporarilyAvoid ? -5 : 0;
    const crowdPenalty = -0.04 * e.busyScore - 0.5 * e.liveActiveTasks;
    const score = w + t + p + d + avoidPenalty + crowdPenalty;

    return { ...e, score };
  });

  // sort: main score desc, then heavy→light, then calmer→busier, then deterministic ids
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
    if (a.busyScore !== b.busyScore) return a.busyScore - b.busyScore;
    if (a.liveActiveTasks !== b.liveActiveTasks) return a.liveActiveTasks - b.liveActiveTasks;
    if (a.shelfObjId !== b.shelfObjId) return a.shelfObjId.localeCompare(b.shelfObjId);
    return String(a.slotId).localeCompare(String(b.slotId));
  });

  const best = scored[0];

  return {
    foId,
    best: {
      shelfId: best.shelfObjId,
      shelfCode: best.shelfCode,
      zone: best.zone,
      type: best.type,
      slotId: best.slotId,
      weightKg: best.weightKg,
      busyScore: best.busyScore,
      liveActiveTasks: best.liveActiveTasks,
      row: best.row,
      col: best.col,
      distance: best.dist,
      score: Number(best.score.toFixed(4)),
    },
    candidates: scored.map(c => ({
      shelfId: c.shelfObjId,
      shelfCode: c.shelfCode,
      zone: c.zone,
      type: c.type,
      slotId: c.slotId,
      weightKg: c.weightKg,
      busyScore: c.busyScore,
      liveActiveTasks: c.liveActiveTasks,
      row: c.row,
      col: c.col,
      distance: c.dist,
      score: Number(c.score.toFixed(4)),
    })),
    meta: {
      filters: {
        minKg,
        zone: zoneNorm ?? null,
        type: typeNorm ?? null,
        centerId: centerId ?? null,
        excludeTemporarilyAvoid,
        maxBusyScore: typeof maxBusyScore === "number" ? maxBusyScore : null,
        preferTypes,
        origin: (typeof originRow === "number" && typeof originCol === "number") ? { row: originRow, col: originCol } : null,
      },
      demand: demandMeta,             // full echo (mode, roundedUnits, notes, etc.)
      requiredKg: requiredKg ?? null, // resolved required kg (if any)
      scoring: {
        weight: "1.25*log1p(kg)",
        typeBoost: `preferTypes order → ${JSON.stringify(preferTypes)}`,
        proximity: "2.5/(1 + dist/4) if origin provided",
        demandFit: "2.2*sqrt(min(slotKg/requiredKg,1)) - 0.3*min(surplusRatio,1)", // NEW
        penalties: "-0.04*busyScore - 0.5*liveActiveTasks" + (excludeTemporarilyAvoid ? " (hard exclude when true)" : " (soft -5 when true)"),
      },
    },
  };
}

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
   * Place a container into a specific slot.  Uses a MongoDB transaction and
   * idempotency key to guarantee that repeated requests do not double-place
   * containers.  Also updates ContainerOps.distributedWeights and totalWeightKg.
   */
  export async function placeContainer(args: {
    shelfMongoId: string;
    slotId: string;
    containerOpsId: string;
    weightKg: number;
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, containerOpsId, weightKg, userId } = args;
    // validation ...
    if (!isObjId(shelfMongoId)) throw new ApiError(400, "Invalid shelfMongoId");
    if (typeof slotId !== "string" || !slotId.trim())
      throw new ApiError(400, "Invalid slotId");
    if (!isObjId(containerOpsId))
      throw new ApiError(400, "Invalid containerOpsId");
    if (typeof weightKg !== "number" || Number.isNaN(weightKg)) {
      throw new ApiError(400, "weightKg must be a number");
    }
    if (weightKg < 0) throw new ApiError(400, "Weight must be >= 0");

    const session = await startSession();
    let result: any;

    await session.withTransaction(async () => {
      const shelf = await Shelf.findById(shelfMongoId).session(session);
      if (!shelf) throw new ApiError(404, "Shelf not found");

      const ops = await ContainerOps.findById(containerOpsId).session(session);
      if (!ops) throw new ApiError(404, "ContainerOps not found");

      if (String(ops.logisticCenterId) !== String(shelf.logisticCenterId)) {
        throw new ApiError(
          400,
          "Container and shelf belong to different logistics centers"
        );
      }

      const slot = shelf.slots.find((s) => s.slotId === slotId);
      if (!slot) throw new ApiError(404, "Slot not found on shelf");
      if (slot.containerOpsId) throw new ApiError(400, "Slot is occupied");
      if (slot.capacityKg != null && weightKg > slot.capacityKg) {
        throw new ApiError(400, "Exceeds slot capacity");
      }

      // update shelf slot
      (slot as any).containerOpsId = new Types.ObjectId(containerOpsId);
      slot.currentWeightKg = weightKg;
      slot.occupiedAt = new Date();
      (slot as any).emptiedAt = null;

      // aggregate convenience (pre-save hook also ensures consistency)
      shelf.currentWeightKg = (shelf.currentWeightKg || 0) + weightKg;
      shelf.occupiedSlots = (shelf.occupiedSlots || 0) + 1;
      await shelf.save({ session });

      // update container
      ops.state = "shelved";
      ops.location = {
        area: "shelf",
        zone: shelf.zone ?? null,
        aisle: shelf.aisle ?? null,
        shelfId: shelf._id,
        slotId,
        updatedAt: new Date(),
      } as any;

      // distributed weights
      ops.distributedWeights = ops.distributedWeights || [];
      ops.distributedWeights.push({ shelfId: shelf._id, slotId, weightKg });
      ops.totalWeightKg = (ops.totalWeightKg || 0) + weightKg;

      ops.auditTrail.push({
        userId: isObjId(userId as any)
          ? new Types.ObjectId(userId as any)
          : (userId as any),
        action: "shelved",
        note: `Shelf ${shelf.shelfId} slot ${slotId}`,
        timestamp: new Date(),
        meta: { shelfId: shelf._id, slotId },
      } as any);

      await ops.save({ session });

      result = { shelf: shelf.toObject(), containerOps: ops.toObject() };
    });

    await session.endSession();

    // bump crowd counters for sort operation (placing counts as sorting)
    await PersistedCrowdService.bump(String(shelfMongoId), +1, "sort");
    return result;
  }

  /**
   * Consume weight from a slot (e.g., picker takes items).  Uses a
   * transaction and optional idempotency key.  Also updates the
   * container’s distributedWeights and totalWeightKg.
   */
  export async function consumeFromSlot(args: {
    shelfMongoId: string;
    slotId: string;
    amountKg: number;
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, amountKg, userId } = args;
    if (amountKg <= 0) throw new ApiError(400, "amountKg must be > 0");

    const session = await startSession();
    let response: any;

    await session.withTransaction(async () => {
      const shelf = await Shelf.findById(shelfMongoId).session(session);
      if (!shelf) throw new ApiError(404, "Shelf not found");

      const slot = shelf.slots.find((s) => s.slotId === slotId);
      if (!slot) throw new ApiError(404, "Slot not found");
      if (!slot.containerOpsId) throw new ApiError(400, "Slot is empty");
      if ((slot.currentWeightKg || 0) < amountKg) {
        throw new ApiError(400, "Not enough weight in slot");
      }

      // update shelf weight (pre-save hook will keep aggregates consistent)
      slot.currentWeightKg = (slot.currentWeightKg || 0) - amountKg;
      shelf.currentWeightKg = (shelf.currentWeightKg || 0) - amountKg;
      await shelf.save({ session });

      const ops = await ContainerOps.findById(
        (slot as any).containerOpsId
      ).session(session);

      if (ops) {
        // update distributedWeights and total
        const dw = ops.distributedWeights || [];
        const entryIndex = dw.findIndex(
          (e: any) =>
            String(e.shelfId) === String(shelf._id) && e.slotId === slotId
        );
        if (entryIndex >= 0) {
          dw[entryIndex].weightKg -= amountKg;
          if (dw[entryIndex].weightKg <= 0) {
            dw.splice(entryIndex, 1);
          }
        }
        ops.distributedWeights = dw;
        ops.totalWeightKg = Math.max(0, (ops.totalWeightKg || 0) - amountKg);
        if (ops.totalWeightKg <= 0) {
          // explicit depleted state from updated model
          ops.state = "depleted";
        }

        ops.auditTrail.push({
          userId: new Types.ObjectId(userId),
          action: "pick_consume",
          note: `Consumed ${amountKg}kg from shelf ${shelf.shelfId} slot ${slotId}`,
          timestamp: new Date(),
          meta: { shelfId: shelf._id, slotId, amountKg },
        } as any);

        await ops.save({ session });
      }

      response = {
        shelf: shelf.toObject(),
        slotId,
        remainingKg: slot.currentWeightKg ?? 0,
      };
    });

    await session.endSession();
    return response;
  }

  /**
   * Empty a slot (remove container, zero weight).  Uses a transaction and
   * optional idempotency key, updates distributedWeights and totalWeightKg.
   */
  export async function emptySlot(args: {
    shelfMongoId: string;
    slotId: string;
    toArea?: "warehouse" | "out";
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, toArea = "warehouse", userId } = args;

    const session = await startSession();
    let res: any;

    await session.withTransaction(async () => {
      const shelf = await Shelf.findById(shelfMongoId).session(session);
      if (!shelf) throw new ApiError(404, "Shelf not found");

      const slot = shelf.slots.find((s) => s.slotId === slotId);
      if (!slot) throw new ApiError(404, "Slot not found");
      if (!slot.containerOpsId) throw new ApiError(400, "Slot already empty");

      const opsId = (slot as any).containerOpsId;
      const prevKg = slot.currentWeightKg || 0;

      // clear slot
      slot.currentWeightKg = 0;
      slot.occupiedAt = slot.occupiedAt || new Date();
      slot.emptiedAt = new Date();
      (slot as any).containerOpsId = null;

      // shelf counters
      shelf.currentWeightKg = Math.max(
        0,
        (shelf.currentWeightKg || 0) - prevKg
      );
      shelf.occupiedSlots = Math.max(0, (shelf.occupiedSlots || 0) - 1);

      await shelf.save({ session });

      const ops = await ContainerOps.findById(opsId).session(session);
      if (ops) {
        // remove distributedWeights for this slot
        const dw = ops.distributedWeights || [];
        const idx = dw.findIndex(
          (e: any) =>
            String(e.shelfId) === String(shelf._id) && e.slotId === slotId
        );
        if (idx >= 0) {
          ops.totalWeightKg = Math.max(
            0,
            (ops.totalWeightKg || 0) - dw[idx].weightKg
          );
          dw.splice(idx, 1);
          ops.distributedWeights = dw;
        }

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

        await ops.save({ session });
      }

      res = { shelf: shelf.toObject(), slotId };
    });

    await session.endSession();
    return res;
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

    const session = await startSession();
    let output: any;

    await session.withTransaction(async () => {
      const from = await Shelf.findById(fromShelfId).session(session);
      if (!from) throw new ApiError(404, "Source shelf not found");

      const src = from.slots.find((s) => s.slotId === fromSlotId);
      if (!src || !src.containerOpsId)
        throw new ApiError(400, "Source slot is empty");

      const to = await Shelf.findById(toShelfId).session(session);
      if (!to) throw new ApiError(404, "Target shelf not found");

      const dst = to.slots.find((s) => s.slotId === toSlotId);
      if (!dst) throw new ApiError(404, "Target slot not found");
      if (dst.containerOpsId) throw new ApiError(400, "Target slot occupied");

      const moveKg = src.currentWeightKg || 0;

      // capacity guard on destination
      if (dst.capacityKg != null && moveKg > dst.capacityKg) {
        throw new ApiError(
          400,
          `Target slot capacity exceeded (cap=${dst.capacityKg}, move=${moveKg})`
        );
      }

      // same LC guard
      if (String(from.logisticCenterId) !== String(to.logisticCenterId)) {
        throw new ApiError(
          400,
          "Source and target shelves belong to different logistics centers"
        );
      }

      // fill destination
      (dst as any).containerOpsId = (src as any).containerOpsId;
      dst.currentWeightKg = moveKg;
      dst.occupiedAt = new Date();
      (dst as any).emptiedAt = null;
      to.currentWeightKg = (to.currentWeightKg || 0) + moveKg;
      to.occupiedSlots = (to.occupiedSlots || 0) + 1;

      // vacate source
      const opsId = (src as any).containerOpsId;
      (src as any).containerOpsId = null;
      src.currentWeightKg = 0;
      src.emptiedAt = new Date();
      from.currentWeightKg = Math.max(0, (from.currentWeightKg || 0) - moveKg);
      from.occupiedSlots = Math.max(0, (from.occupiedSlots || 0) - 1);

      await Promise.all([from.save({ session }), to.save({ session })]);

      const ops = await ContainerOps.findById(opsId).session(session);
      if (ops) {
        // update distributedWeights
        const dw = ops.distributedWeights || [];
        // remove old entry
        const idx = dw.findIndex(
          (e: any) =>
            String(e.shelfId) === String(from._id) && e.slotId === fromSlotId
        );
        if (idx >= 0) {
          dw.splice(idx, 1);
        }
        // add new entry
        dw.push({ shelfId: to._id, slotId: toSlotId, weightKg: moveKg });
        ops.distributedWeights = dw;

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

        await ops.save({ session });
      }

      output = { from: from.toObject(), to: to.toObject(), movedKg: moveKg };
    });

    await session.endSession();
    return output;
  }

  /** Crowd tracking: start */
  export async function markShelfTaskStart(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await PersistedCrowdService.bump(args.shelfId, +1, args.kind);
    return { ok: true };
  }

  /** Crowd tracking: end */
  export async function markShelfTaskEnd(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await PersistedCrowdService.bump(args.shelfId, -1, args.kind);
    return { ok: true };
  }

  /** Read a shelf with live crowd score */
  export async function getShelfWithCrowdScore(shelfId: string) {
    const s = await getShelfById(shelfId);
    const crowd = await PersistedCrowdService.computeShelfCrowd(shelfId);
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
    pickerShelfId: string; // Shelf _id (picker)
    pickerSlotId: string;
    warehouseShelfId: string; // Shelf _id (warehouse)
    warehouseSlotId: string;
    targetFillKg: number; // target level for picker slot
    userId: string | Types.ObjectId;
  }) {
    const {
      pickerShelfId,
      pickerSlotId,
      warehouseShelfId,
      warehouseSlotId,
      targetFillKg,
      userId,
    } = args;

    if (targetFillKg <= 0) throw new ApiError(400, "targetFillKg must be > 0");

    const picker = await Shelf.findById(pickerShelfId);
    if (!picker) throw new ApiError(404, "Picker shelf not found");
    const pSlot = picker.slots.find((s) => s.slotId === pickerSlotId);
    if (!pSlot) throw new ApiError(404, "Picker slot not found");

    const ware = await Shelf.findById(warehouseShelfId);
    if (!ware) throw new ApiError(404, "Warehouse shelf not found");
    const wSlot = ware.slots.find((s) => s.slotId === warehouseSlotId);
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
      throw new ApiError(
        400,
        `Picker slot capacity exceeded: capacity=${
          pSlot.capacityKg
        }, requested=${P + moved}`
      );
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
          meta: {
            movedKg: moved,
            fromShelfId: ware._id,
            fromSlotId: warehouseSlotId,
            toShelfId: picker._id,
            toSlotId: pickerSlotId,
          },
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
          meta: {
            movedKg: moved,
            fromShelfId: ware._id,
            fromSlotId: warehouseSlotId,
            toShelfId: picker._id,
            toSlotId: pickerSlotId,
          },
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



