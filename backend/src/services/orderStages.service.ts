// src/services/orderStages.service.ts
import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import {
  ORDER_STAGE_KEYS,
  ORDER_STAGE_LABELS,
  type OrderStageKey,
} from "../models/shared/stage.types";
import { buildStageEntry } from "../models/shared/stage.utils";

// 🔸 Shared audit helper
import { pushHistoryAuditTrail } from "./auditTrail.service";

export type StageAction = "setCurrent" | "ok" | "done" | "problem" | "cancel";

export interface UpdateStageArgs {
  orderId: string;
  stageKey: OrderStageKey;
  action: StageAction;
  note?: string;
  user: {
    _id: Types.ObjectId | string;
    role: string; // "admin" | "csManager" | "tManager"
    logisticCenterId?: string;
    name?: string;
  };
}

/* -------------------------------------------------------------------------- */
/*                        Internal helpers / primitives                        */
/* -------------------------------------------------------------------------- */

/** Make sure orderDoc.stages[] has an entry for this key and return it. */
function ensureStageEntry(orderDoc: any, key: OrderStageKey) {
  if (!Array.isArray(orderDoc.stages)) {
    orderDoc.stages = [];
  }
  let st = orderDoc.stages.find((s: any) => s?.key === key);
  if (!st) {
    st = buildStageEntry(key, "pending");
    orderDoc.stages.push(st);
  }
  return st;
}

/** Given a stageKey, what's the next one in the happy path? */
function nextStageKey(current: OrderStageKey | undefined): OrderStageKey | null {
  if (!current) return null;

  const idx = ORDER_STAGE_KEYS.indexOf(current);
  if (idx < 0) return null;

  const nxt = ORDER_STAGE_KEYS[idx + 1];
  if (!nxt) return null;

  // We never "auto-advance" into canceled
  if (nxt === "canceled") return null;

  return nxt as OrderStageKey;
}

/** Mark some stage as current (and close the previous one if it was current). */
function setAsCurrent(orderDoc: any, key: OrderStageKey, note?: string) {
  const now2 = new Date();

  // Close whatever is currently "current"
  if (orderDoc.stageKey && orderDoc.stageKey !== key) {
    const prev = ensureStageEntry(orderDoc, orderDoc.stageKey as OrderStageKey);
    if (prev.status === "current") {
      prev.status = "done";
      if (!prev.startedAt) prev.startedAt = now2;
      if (!prev.completedAt) prev.completedAt = now2;
    }
  }

  // Activate the new stage
  const st2 = ensureStageEntry(orderDoc, key);
  st2.status = "current";
  st2.timestamp = now2;
  if (!st2.startedAt) st2.startedAt = now2;
  // completedAt stays null because it's "in progress"
  if (note) st2.note = note;

  // Update pointer
  orderDoc.stageKey = key;
}

/**
 * Core state machine. Mutates orderDoc in-memory.
 * Caller will save() and audit.
 */
function applyStageTransition(
  orderDoc: any,
  {
    stageKey,
    action,
    note,
  }: {
    stageKey: OrderStageKey;
    action: StageAction;
    note?: string;
  }
) {
  const now = new Date();
  const stage = ensureStageEntry(orderDoc, stageKey);

  if (action === "setCurrent") {
    // manual override
    setAsCurrent(orderDoc, stageKey, note);
    return;
  }

  if (action === "problem") {
    stage.status = "problem";
    stage.timestamp = now;
    if (!stage.startedAt) stage.startedAt = now;
    if (note) stage.note = note;

    // no dedicated status field on Order, we use stageKey+stage.status
    orderDoc.stageKey = stageKey;
    return;
  }

  if (action === "cancel") {
    // Jump to terminal canceled
    const canceledStage = ensureStageEntry(orderDoc, "canceled");
    canceledStage.status = "current";
    canceledStage.timestamp = now;
    if (!canceledStage.startedAt) canceledStage.startedAt = now;
    if (!canceledStage.completedAt) canceledStage.completedAt = now;
    canceledStage.note = note || canceledStage.note;

    orderDoc.stageKey = "canceled";
    return;
  }

  if (action === "ok" || action === "done") {
    // Finish this stage
    stage.status = "done";
    stage.timestamp = now;
    if (!stage.startedAt) stage.startedAt = now;
    if (!stage.completedAt) stage.completedAt = now;
    if (note) stage.note = note;

    // Advance to next stage (except canceled)
    const nxt = nextStageKey(stageKey);

    if (nxt) {
      setAsCurrent(orderDoc, nxt);
    } else {
      // No next means this was the end of the normal journey:
      // usually stageKey === "received"
      orderDoc.stageKey = stageKey;
    }
    return;
  }

  throw new Error(`Unsupported stage action '${action}'`);
}

/* -------------------------------------------------------------------------- */
/*                                Public API                                   */
/* -------------------------------------------------------------------------- */

export async function updateOrderStageStatusService(args: UpdateStageArgs) {
  const { orderId, stageKey, action, note, user } = args;

  // 1. validate
  if (!mongoose.isValidObjectId(orderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid order id"];
    throw e;
  }

  // 2. role guard
  if (!["admin", "csManager", "tManager"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only admin/csManager/tManager can update order stages"];
    throw e;
  }

  // 3. load order
  const orderDoc = await Order.findById(orderId);
  if (!orderDoc) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Order not found"];
    throw e;
  }

  // 4. LC guard (csManager scope restriction)
  if (
    user.logisticCenterId &&
    orderDoc.LogisticsCenterId &&
    String(user.logisticCenterId) !== String(orderDoc.LogisticsCenterId)
  ) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = [
      "You cannot update an order from a different logistics center",
    ];
    throw e;
  }

  // 5. mutate timeline
  applyStageTransition(orderDoc, { stageKey, action, note });

  // 6. audit (shared helper)
  const actorId = new Types.ObjectId(user._id);
  const meta: Record<string, any> = { stageKey, action };
  if (note) meta.note = note;

  pushHistoryAuditTrail(orderDoc, {
    userId: actorId,
    action: "ORDER_STAGE_UPDATED",
    note: `Stage '${stageKey}' ${action}`,
    meta,
    timestamp: new Date(),
  });

  // 7. save
  orderDoc.updatedAt = new Date();
  await orderDoc.save();

  // 8. return safe json
  return orderDoc.toJSON();
}

// for system / automation calls (no user, scanner, cron, etc.)
export async function updateOrderStageStatusSystem(args: {
  orderId: string;
  stageKey: OrderStageKey;
  action: StageAction;
  note?: string;
}) {
  const { orderId, stageKey, action, note } = args;

  if (!mongoose.isValidObjectId(orderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid order id"];
    throw e;
  }

  const orderDoc = await Order.findById(orderId);
  if (!orderDoc) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Order not found"];
    throw e;
  }

  applyStageTransition(orderDoc, { stageKey, action, note });

  const sysUserId = new Types.ObjectId("000000000000000000000000");

  pushHistoryAuditTrail(orderDoc, {
    userId: sysUserId,
    action: "ORDER_STAGE_UPDATED_SYSTEM",
    note: `System stage '${stageKey}' ${action}`,
    meta: { stageKey, action, note },
    timestamp: new Date(),
  });

  orderDoc.updatedAt = new Date();
  await orderDoc.save();
  return orderDoc.toJSON();
}
