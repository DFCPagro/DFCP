// FILE: src/services/shelf.service.ts
//
// Shelf & container placement utilities with:
// - Safe Decimal128 math/conversions
// - In-memory crowding integration (drop-in replacement for persisted version)
// - Clear, defensive guards for capacity, logistics-center consistency, and slot occupancy
//
// The only behavior change is the Decimal128 safety and switching the crowd
// integration to the in-memory CrowdService. All endpoints and side effects
// are preserved (audits, distributedWeights, state transitions, etc.).

import { Types, startSession } from "mongoose";
import Shelf from "../models/Shelf.model";
import ContainerOps from "../models/ContainerOps.model";
import ApiError from "../utils/ApiError";

// ⬇️ Replaces the old persisted crowd service with your in-memory service.
//    The API surface (bump/computeShelfCrowd) is the same, so behavior is preserved.
//    Ensure the file exists at src/services/crowd.service.ts (your pasted code).
import { CrowdService } from "./shelfCrowd.service";

import { isObjId } from "@/utils/validations/mongose";
import { resolveDemandToKgForItem, type DemandInput } from "./items.service";

/** ---------- Decimal128 helpers (to keep math/compare safe) ---------- */
function decToNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (v && typeof v.toString === "function") {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function numToDec128(n: number) {
  return Types.Decimal128.fromString(String(n));
}

export namespace ShelfService {
  /**
   * List shelves by logistic center with optional filters.
   * Used by controller: GET /shelves?centerId=...&zone=A&type=picker
   * Notes:
   * - `zone` normalized to UPPERCASE (UI often uses letters).
   * - `type` normalized to lowercase to match enum.
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

  // Backward-compat wrapper (older code may call this).
  export async function listByCenter(centerId: string) {
    return list({ logisticCenterId: centerId });
  }

  /**
   * Find the best shelf/slot for a given FO id (container's FO).
   *
   * Score (max is better):
   *   score =
   *     1.25*log1p(weightKg)
   *     + typeBoost(type)                        // preferTypes order
   *     + proximityBoost(origin→row/col)         // if origin provided
   *     + demandFitBoost(weightKg, requiredKg)   // NEW: prefer “just enough”
   *     + (isTemporarilyAvoid ? -5 : 0)          // if soft-allow
   *     - 0.04 * busyScore
   *     - 0.5  * liveActiveTasks
   *
   * Tie-break: score↓, kg↓, busyScore↑, tasks↑, shelfId asc, slotId asc
   */
  export async function findBestLocationForFO(args: {
    foId: string;
    minKg?: number; // kept: lower bound even when demand is present
    zone?: string;
    centerId?: string;
    excludeTemporarilyAvoid?: boolean; // default true: hard exclude
    maxBusyScore?: number;
    preferTypes?: Array<"warehouse" | "picker" | "delivery">;
    originRow?: number;
    originCol?: number;
    type: "warehouse" | "picker" | "delivery" | string;
    demand?: DemandInput; // { qtyKg } or { qtyUnits }
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

    /** 1) Resolve the FO's container ops (by _id or legacy fields). */
    const byObjId = Types.ObjectId.isValid(foId) ? { _id: new Types.ObjectId(foId) } : null;
    const ops =
      (await ContainerOps.findOne(byObjId || { foId }).lean()) ||
      (await ContainerOps.findOne({ fulfillmentOrderId: foId }).lean()) ||
      (await ContainerOps.findOne({ "order.foId": foId }).lean());

    if (!ops) throw new ApiError(404, "No ContainerOps found for provided FO id");

    /** 1a) Convert demand → requiredKg using the FO’s item (if demand provided). */
    let requiredKg: number | null = null;
    let demandMeta: any = null;
    if (demand && ops.itemId) {
      try {
        const r = await resolveDemandToKgForItem(String(ops.itemId), demand);
        requiredKg = r.requiredKg;
        demandMeta = r; // echo for debugging/telemetry
      } catch (e: any) {
        throw new ApiError(400, `DemandError: ${e?.message || "invalid demand"}`);
      }
    }

    /** 2) Build candidate list from ContainerOps.distributedWeights or current location. */
    type Candidate = { shelfId: Types.ObjectId; slotId: string; weightKg: number };
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
        weightKg: 0, // resolved from shelf.slots later
      });
    }

    if (candidates.length === 0) {
      throw new ApiError(404, "FO is not currently on any shelf/slot");
    }

    /** 3) Fetch all candidate shelves in one go. */
    const uniqShelfIds = Array.from(new Set(candidates.map((c) => String(c.shelfId)))).map(
      (id) => new Types.ObjectId(id)
    );
    const shelves = await Shelf.find(
      { _id: { $in: uniqShelfIds } },
      {
        shelfId: 1,
        type: 1,
        zone: 1,
        row: 1,
        col: 1,
        liveActiveTasks: 1,
        busyScore: 1,
        isTemporarilyAvoid: 1,
        logisticCenterId: 1,
        slots: 1,
      }
    ).lean();

    if (!shelves || shelves.length === 0) {
      throw new ApiError(404, "Candidate shelves not found");
    }

    const shelfById = new Map<string, any>(shelves.map((s) => [String(s._id), s]));

    /** 4) Filter & enrich candidates (capacity/demand/zone/type/busy/avoid) */
    const zoneNorm = zone ? String(zone).toUpperCase() : undefined;
    const typeNorm = type ? String(type).toLowerCase() : undefined;
    const preferOrder = new Map(preferTypes.map((t, i) => [t, preferTypes.length - i])); // higher wins

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

      // Guards: LC match, zone filter, type enum, temporary-avoid, busy cap
      if (centerId && String(s.logisticCenterId) !== String(centerId)) continue;
      if (zoneNorm && s.zone && String(s.zone).toUpperCase() !== zoneNorm) continue;
      if (typeNorm && String(s.type).toLowerCase() !== typeNorm) continue;
      if (excludeTemporarilyAvoid && s.isTemporarilyAvoid) continue;
      if (typeof maxBusyScore === "number" && s.busyScore > maxBusyScore) continue;

      // Slot kg (prefer shelf doc; handle Decimal128)
      const slot = Array.isArray(s.slots) ? s.slots.find((x: any) => x.slotId === c.slotId) : null;
      const slotKgFromDoc = slot ? decToNum(slot.currentWeightKg) : 0;
      const slotKg = Math.max(0, typeof c.weightKg === "number" && c.weightKg > 0 ? c.weightKg : slotKgFromDoc);

      // Respect both minKg and demand.requiredKg
      const needKg = Math.max(minKg || 0, requiredKg ?? 0);
      if (slotKg < needKg) continue;

      // Manhattan distance from origin if provided
      let dist: number | null = null;
      if (
        typeof originRow === "number" &&
        typeof originCol === "number" &&
        typeof s.row === "number" &&
        typeof s.col === "number"
      ) {
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

    /** 5) Scoring */
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
    // Reward good demand fit; lightly penalize large surplus to reduce shuttling
    function demandFitBoost(slotKg: number, demandKg: number | null): number {
      if (!demandKg || demandKg <= 0) return 0;
      const fit = Math.min(slotKg / demandKg, 1); // 0..1
      const surplus = Math.max(0, (slotKg - demandKg) / demandKg); // 0..∞
      return 2.2 * Math.sqrt(fit) - 0.3 * Math.min(surplus, 1);
    }

    const scored = enriched.map((e) => {
      const w = 1.25 * Math.log1p(e.weightKg);
      const t = typeBoost(e.type);
      const p = proximityBoost(e.dist);
      const d = demandFitBoost(e.weightKg, requiredKg);
      const avoidPenalty = e.isTemporarilyAvoid ? -5 : 0;
      const crowdPenalty = -0.04 * e.busyScore - 0.5 * e.liveActiveTasks;
      const score = w + t + p + d + avoidPenalty + crowdPenalty;
      return { ...e, score };
    });

    // Deterministic order
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
      candidates: scored.map((c) => ({
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
          origin:
            typeof originRow === "number" && typeof originCol === "number"
              ? { row: originRow, col: originCol }
              : null,
        },
        demand: demandMeta,
        requiredKg: requiredKg ?? null,
        scoring: {
          weight: "1.25*log1p(kg)",
          typeBoost: `preferTypes order → ${JSON.stringify(preferTypes)}`,
          proximity: "2.5/(1 + dist/4) if origin provided",
          demandFit: "2.2*sqrt(min(slotKg/requiredKg,1)) - 0.3*min(surplusRatio,1)",
          penalties:
            "-0.04*busyScore - 0.5*liveActiveTasks" +
            (excludeTemporarilyAvoid ? " (hard exclude when true)" : " (soft -5 when true)"),
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

  /** Find a shelf by composite keys (center + shelf code). */
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
   * Place a container into a specific slot (transactional).
   * Idempotency guidance:
   * - Caller should supply an external idempotency key if repeating request may occur.
   * Guards:
   * - Same logistics center, slot exists, not occupied, capacity ok.
   * Side effects:
   * - Shelf slot occupancy/weight, shelf aggregates, ContainerOps.state/location,
   *   ContainerOps.distributedWeights/totalWeightKg, audit entry, crowd bump ("sort").
   */
  export async function placeContainer(args: {
    shelfMongoId: string;
    slotId: string;
    containerOpsId: string;
    weightKg: number;
    userId: string | Types.ObjectId;
  }) {
    const { shelfMongoId, slotId, containerOpsId, weightKg, userId } = args;
    if (!isObjId(shelfMongoId)) throw new ApiError(400, "Invalid shelfMongoId");
    if (typeof slotId !== "string" || !slotId.trim()) throw new ApiError(400, "Invalid slotId");
    if (!isObjId(containerOpsId)) throw new ApiError(400, "Invalid containerOpsId");
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
        throw new ApiError(400, "Container and shelf belong to different logistics centers");
      }

      const slot = shelf.slots.find((s) => s.slotId === slotId);
      if (!slot) throw new ApiError(404, "Slot not found on shelf");
      if ((slot as any).containerOpsId) throw new ApiError(400, "Slot is occupied");

      const capKg = decToNum(slot.capacityKg);
      if (capKg > 0 && weightKg > capKg) {
        throw new ApiError(400, `Exceeds slot capacity (${capKg} kg)`);
      }

      // Slot occupancy & weights (Decimal128-safe)
      (slot as any).containerOpsId = new Types.ObjectId(containerOpsId);
      (slot as any).currentWeightKg = numToDec128(weightKg);
      (slot as any).occupiedAt = new Date();
      (slot as any).emptiedAt = null;

      // Shelf aggregates
      const shelfCur = decToNum(shelf.currentWeightKg);
      (shelf as any).currentWeightKg = numToDec128(shelfCur + weightKg);
      (shelf as any).occupiedSlots = (shelf.occupiedSlots || 0) + 1;
      await shelf.save({ session });

      // Container state/location
      (ops as any).state = "shelved";
      (ops as any).location = {
        area: "shelf",
        zone: shelf.zone ?? null,
        aisle: shelf.aisle ?? null,
        shelfId: shelf._id,
        slotId,
        updatedAt: new Date(),
      };

      // Container distributed weights
      ops.distributedWeights = ops.distributedWeights || [];
      ops.distributedWeights.push({ shelfId: shelf._id, slotId, weightKg });
      (ops as any).totalWeightKg = (ops as any).totalWeightKg
        ? (ops as any).totalWeightKg + weightKg
        : weightKg;

      // Audit
      ops.auditTrail.push({
        userId: isObjId(userId as any) ? new Types.ObjectId(userId as any) : (userId as any),
        action: "shelved",
        note: `Shelf ${shelf.shelfId} slot ${slotId}`,
        timestamp: new Date(),
        meta: { shelfId: shelf._id, slotId },
      } as any);

      await ops.save({ session });

      result = { shelf: shelf.toObject(), containerOps: ops.toObject() };
    });

    await session.endSession();

    // Crowd bump: placing behaves like a "sort" activity (kept behavior).
    await CrowdService.bump(String(shelfMongoId), +1, "sort");
    return result;
  }

  /**
   * Consume weight from a slot (picker takes items).
   * Guards:
   * - Slot exists/occupied, enough weight.
   * Side effects:
   * - Slot/shelf weights, ContainerOps.distributedWeights & totalWeightKg,
   *   ContainerOps.state="depleted" when total→0, audit entry.
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
      if (!(slot as any).containerOpsId) throw new ApiError(400, "Slot is empty");

      const slotKg = decToNum((slot as any).currentWeightKg);
      if (slotKg < amountKg) {
        throw new ApiError(400, "Not enough weight in slot");
      }

      // Update shelf/slot weights
      (slot as any).currentWeightKg = numToDec128(slotKg - amountKg);
      const shelfCur = decToNum((shelf as any).currentWeightKg);
      (shelf as any).currentWeightKg = numToDec128(Math.max(0, shelfCur - amountKg));
      await shelf.save({ session });

      // Update container distributed weights
      const ops = await ContainerOps.findById((slot as any).containerOpsId).session(session);
      if (ops) {
        const dw = ops.distributedWeights || [];
        const entryIndex = dw.findIndex(
          (e: any) => String(e.shelfId) === String(shelf._id) && e.slotId === slotId
        );
        if (entryIndex >= 0) {
          dw[entryIndex].weightKg = Math.max(0, (dw[entryIndex].weightKg || 0) - amountKg);
          if (dw[entryIndex].weightKg <= 0) {
            dw.splice(entryIndex, 1);
          }
        }
        ops.distributedWeights = dw;

        (ops as any).totalWeightKg = Math.max(0, ((ops as any).totalWeightKg || 0) - amountKg);
        if ((ops as any).totalWeightKg <= 0) {
          (ops as any).state = "depleted";
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
        remainingKg: decToNum((slot as any).currentWeightKg),
      };
    });

    await session.endSession();
    return response;
  }

  /**
   * Empty a slot (remove container, zero weight).
   * Guards:
   * - Slot exists/occupied.
   * Side effects:
   * - Shelf weights/occupiedSlots, ContainerOps.distributedWeights/totalWeightKg,
   *   ContainerOps.location area → "warehouse" or "out", audit entry.
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
      if (!(slot as any).containerOpsId) throw new ApiError(400, "Slot already empty");

      const opsId = (slot as any).containerOpsId;
      const prevKg = decToNum((slot as any).currentWeightKg);

      // Clear slot
      (slot as any).currentWeightKg = numToDec128(0);
      (slot as any).occupiedAt = (slot as any).occupiedAt || new Date();
      (slot as any).emptiedAt = new Date();
      (slot as any).containerOpsId = null;

      // Shelf aggregates
      const shelfCur = decToNum((shelf as any).currentWeightKg);
      (shelf as any).currentWeightKg = numToDec128(Math.max(0, shelfCur - prevKg));
      (shelf as any).occupiedSlots = Math.max(0, (shelf as any).occupiedSlots || 0) - 1;

      await shelf.save({ session });

      // Container updates
      const ops = await ContainerOps.findById(opsId).session(session);
      if (ops) {
        const dw = ops.distributedWeights || [];
        const idx = dw.findIndex(
          (e: any) => String(e.shelfId) === String(shelf._id) && e.slotId === slotId
        );
        if (idx >= 0) {
          (ops as any).totalWeightKg = Math.max(
            0,
            ((ops as any).totalWeightKg || 0) - (dw[idx].weightKg || 0)
          );
          dw.splice(idx, 1);
          ops.distributedWeights = dw;
        }

        (ops as any).location = {
          area: toArea,
          zone: null,
          aisle: null,
          shelfId: null,
          slotId: null,
          updatedAt: new Date(),
        };

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
   * Move container between slots (possibly different shelves).
   * Guards:
   * - Source occupied, target free, same LC, target capacity ok.
   * Side effects:
   * - Source/target slot & shelf aggregates, ContainerOps.distributedWeights,
   *   ContainerOps.location, audit entry.
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
      if (!src || !(src as any).containerOpsId) throw new ApiError(400, "Source slot is empty");

      const to = await Shelf.findById(toShelfId).session(session);
      if (!to) throw new ApiError(404, "Target shelf not found");

      const dst = to.slots.find((s) => s.slotId === toSlotId);
      if (!dst) throw new ApiError(404, "Target slot not found");
      if ((dst as any).containerOpsId) throw new ApiError(400, "Target slot occupied");

      const moveKg = decToNum((src as any).currentWeightKg);

      // Capacity guard
      const dstCap = decToNum((dst as any).capacityKg);
      if (dstCap > 0 && moveKg > dstCap) {
        throw new ApiError(400, `Target slot capacity exceeded (cap=${dstCap}, move=${moveKg})`);
      }

      // LC consistency
      if (String(from.logisticCenterId) !== String(to.logisticCenterId)) {
        throw new ApiError(400, "Source and target shelves belong to different logistics centers");
      }

      // Fill destination
      const toCur = decToNum((to as any).currentWeightKg);
      (dst as any).containerOpsId = (src as any).containerOpsId;
      (dst as any).currentWeightKg = numToDec128(moveKg);
      (dst as any).occupiedAt = new Date();
      (dst as any).emptiedAt = null;
      (to as any).currentWeightKg = numToDec128(toCur + moveKg);
      (to as any).occupiedSlots = (to as any).occupiedSlots ? (to as any).occupiedSlots + 1 : 1;

      // Vacate source
      const opsId = (src as any).containerOpsId;
      const fromCur = decToNum((from as any).currentWeightKg);
      (src as any).containerOpsId = null;
      (src as any).currentWeightKg = numToDec128(0);
      (src as any).emptiedAt = new Date();
      (from as any).currentWeightKg = numToDec128(Math.max(0, fromCur - moveKg));
      (from as any).occupiedSlots = Math.max(0, (from as any).occupiedSlots || 0) - 1;

      await Promise.all([from.save({ session }), to.save({ session })]);

      // Update ContainerOps: distributed weights & location
      const ops = await ContainerOps.findById(opsId).session(session);
      if (ops) {
        const dw = ops.distributedWeights || [];
        // remove old
        const idx = dw.findIndex(
          (e: any) => String(e.shelfId) === String(from._id) && e.slotId === fromSlotId
        );
        if (idx >= 0) dw.splice(idx, 1);
        // add new
        dw.push({ shelfId: to._id, slotId: toSlotId, weightKg: moveKg });
        ops.distributedWeights = dw;

        (ops as any).location = {
          area: "shelf",
          zone: to.zone ?? null,
          aisle: to.aisle ?? null,
          shelfId: to._id,
          slotId: toSlotId,
          updatedAt: new Date(),
        };

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

  /** Crowd tracking: start — increments in-memory counters (pick/sort/audit). */
  export async function markShelfTaskStart(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await CrowdService.bump(args.shelfId, +1, args.kind, String(args.userId ?? ""));
    return { ok: true };
  }

  /** Crowd tracking: end — decrements in-memory counters (clamped at 0). */
  export async function markShelfTaskEnd(args: {
    shelfId: string;
    userId: string | Types.ObjectId;
    kind: "pick" | "sort" | "audit";
  }) {
    await CrowdService.bump(args.shelfId, -1, args.kind, String(args.userId ?? ""));
    return { ok: true };
  }

  /** Read a shelf with live crowd score (uses occupiedSlots + in-memory counters). */
  export async function getShelfWithCrowdScore(shelfId: string) {
    const s = await getShelfById(shelfId);
    const crowd = await CrowdService.computeShelfCrowd(shelfId);
    return { shelf: s, crowd };
  }

  /**
   * Refill a picker slot from a warehouse slot up to targetFillKg.
   * Notes:
   * - Does NOT change containerOpsId bindings.
   * - Decrements warehouse slot weight, increments picker slot weight.
   * - Updates both shelves' currentWeightKg.
   * - Adds audits on underlying ContainerOps (if present on either side).
   */
  export async function refillFromWarehouse(args: {
    pickerShelfId: string; // Shelf _id (picker)
    pickerSlotId: string;
    warehouseShelfId: string; // Shelf _id (warehouse)
    warehouseSlotId: string;
    targetFillKg: number; // desired final level of picker slot
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

    // LC consistency
    if (String(picker.logisticCenterId) !== String(ware.logisticCenterId)) {
      throw new ApiError(400, "Shelves belong to different logistics centers");
    }

    const P = decToNum((pSlot as any).currentWeightKg);
    const W = decToNum((wSlot as any).currentWeightKg);

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

    // Picker capacity guard
    const pCap = decToNum((pSlot as any).capacityKg);
    if (pCap > 0 && P + moved > pCap) {
      throw new ApiError(400, `Picker slot capacity exceeded: capacity=${pCap}, requested=${P + moved}`);
    }

    // Decrement warehouse
    (wSlot as any).currentWeightKg = numToDec128(W - moved);
    const wareCur = decToNum((ware as any).currentWeightKg);
    (ware as any).currentWeightKg = numToDec128(Math.max(0, wareCur - moved));

    // Increment picker
    (pSlot as any).currentWeightKg = numToDec128(P + moved);
    const pickCur = decToNum((picker as any).currentWeightKg);
    (picker as any).currentWeightKg = numToDec128(pickCur + moved);

    await Promise.all([picker.save(), ware.save()]);

    // Optional audits on underlying containers (if slot bound to a container)
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
      pickerSlotWeightAfter: decToNum((pSlot as any).currentWeightKg),
      warehouseSlotWeightAfter: decToNum((wSlot as any).currentWeightKg),
    };
  }
}
