// src/services/farmerOrderStages.service.ts
import mongoose, { Types } from "mongoose";
import FarmerOrder from "../models/farmerOrder.model";
import {
  FARMER_ORDER_STAGE_LABELS,
  FARMER_ORDER_STAGE_KEYS,
  FarmerOrderStageKey,
} from "../models/shared/stage.types";

export interface AuthUser {
  id: string;
  role: string; // "farmer" | "fManager" | "admin" | ...
  logisticCenterId?: string;
  name?: string;
}

const toOID = (v: string | Types.ObjectId) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));

/* -----------------------------------------------------------------------------
 * helpers
 * -------------------------------------------------------------------------- */

/** true if the *current* stage is marked "problem" */
export function isFarmerOrderProblem(doc: {
  stageKey?: string;
  stages?: Array<{ key?: string; status?: string }>;
}): boolean {
  if (!doc?.stageKey || !Array.isArray(doc.stages)) return false;
  const cur = doc.stages.find((s) => s?.key === doc.stageKey);
  return cur?.status === "problem";
}

/**
 * Prevent forward progress when pipeline is halted.
 * forward progress = setCurrent / ok / done
 * "problem" is allowed even if halted.
 */
export function ensurePipelineOpen(doc: any) {
  if (isFarmerOrderProblem(doc)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Pipeline is halted because current stage is 'problem'."];
    throw e;
  }
}

/** make sure a stage entry exists, return mutable ref */
export function ensureFOStageEntry(doc: any, key: FarmerOrderStageKey) {
  if (!Array.isArray(doc.stages)) doc.stages = [];
  let st = doc.stages.find((s: any) => s?.key === key);
  if (!st) {
    st = {
      key,
      label: FARMER_ORDER_STAGE_LABELS[key] || key,
      status: "pending", // default until we touch it
      expectedAt: null,
      startedAt: null,
      completedAt: null,
      timestamp: new Date(),
      note: "",
    };
    doc.stages.push(st);
  }
  return st;
}

/**
 * Call this when you FIRST CREATE a FarmerOrder (in your existing create service).
 * - kick off pipeline at "farmerAck"
 * - set farmerStatus="pending" (legacy)
 * - add audit
 */
export function initFarmerOrderStagesAndAudit(
  foDoc: any,
  createdBy: Types.ObjectId
) {
  const now = new Date();
  const firstKey: FarmerOrderStageKey = "farmerAck";

  foDoc.stageKey = firstKey;

  const st = ensureFOStageEntry(foDoc, firstKey);
  st.status = "current";
  st.timestamp = now;
  if (!st.startedAt) st.startedAt = now;

  foDoc.farmerStatus = "pending"; // legacy snapshot

  foDoc.addAudit(
    createdBy,
    "FARMER_ORDER_CREATED",
    "Farmer order created",
    {}
  );
}

/* -----------------------------------------------------------------------------
 * Manager/admin manual stage control
 *
 * PATCH /farmer-orders/:id/stage
 * body: { key, action: "setCurrent"|"ok"|"done"|"problem", note? }
 * roles allowed: fManager, admin
 *
 * NO AMS CREATION HERE.
 * -------------------------------------------------------------------------- */

export type StageAction = "setCurrent" | "ok" | "done" | "problem";

export interface UpdateFarmerOrderStageArgs {
  farmerOrderId: string;
  key: string; // FarmerOrderStageKey (string from client)
  action: StageAction;
  note?: string;
  user: AuthUser;
}

export async function updateFarmerOrderStageService(
  args: UpdateFarmerOrderStageArgs
) {
  const { farmerOrderId, key, action, note, user } = args;

  // --- basic validation
  if (!mongoose.isValidObjectId(farmerOrderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid farmer order id"];
    throw e;
  }
  if (!FARMER_ORDER_STAGE_KEYS.includes(key as any)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = [`Unknown/invalid stage key '${key}'`];
    throw e;
  }

  // --- ACL: only ops roles move pipeline
  if (!["fManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only fManager or admin can update farmer order stages"];
    throw e;
  }
  


  // --- load FarmerOrder
  const fo = await FarmerOrder.findById(farmerOrderId);
  if (!fo) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Farmer order not found"];
    throw e;
  }
  if (["fManager", "admin"].includes(user.role)) {
  if (
    !user.logisticCenterId ||
    String(fo.logisticCenterId) !== String(user.logisticCenterId)
  ) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["You cannot update orders from another LC"];
    throw e;
  }
}

  // If we're doing a forward action (not "problem"), ensure pipeline not halted
  if (action !== "problem") {
    ensurePipelineOpen(fo);
  }

  fo.updatedBy = toOID(user.id);
  fo.updatedAt = new Date();

  const stageKey = key as FarmerOrderStageKey;

  // We only allow ok/done on an existing stage; setCurrent and problem may create it.
  const existingStage = (fo.stages as any[])?.find(
    (s: any) => s?.key === stageKey
  );
  if (!existingStage && action !== "setCurrent" && action !== "problem") {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = [`Stage '${stageKey}' not found on this order`];
    throw e;
  }

  switch (action) {
    case "setCurrent": {
      // Your FarmerOrder model already has instance method setStageCurrent(key, userId, {note})
      fo.setStageCurrent(stageKey, fo.updatedBy as any, { note });
      fo.stageKey = stageKey;

      fo.addAudit(
        fo.updatedBy as any,
        "STAGE_SET_CURRENT",
        note ?? "",
        { key: stageKey, byRole: user.role }
      );
      break;
    }

    case "ok": {
      // markStageOk(key, userId, {note})
      fo.markStageOk(stageKey, fo.updatedBy as any, { note });

      fo.addAudit(
        fo.updatedBy as any,
        "STAGE_SET_OK",
        note ?? "",
        { key: stageKey, byRole: user.role }
      );
      break;
    }

    case "done": {
      // markStageDone(key, userId, {note})
      fo.markStageDone(stageKey, fo.updatedBy as any, { note });

      fo.addAudit(
        fo.updatedBy as any,
        "STAGE_MARK_DONE",
        note ?? "",
        { key: stageKey, byRole: user.role }
      );
      break;
    }

    case "problem": {
      // ensure stage exists, then flag it problem + make it stageKey
      const st = ensureFOStageEntry(fo, stageKey);
      const now = new Date();
      st.status = "problem";
      st.timestamp = now;
      if (!st.startedAt) st.startedAt = now;
      if (note) st.note = note;

      fo.stageKey = stageKey;

      fo.addAudit(
        fo.updatedBy as any,
        "STAGE_SET_PROBLEM",
        note ?? "",
        { key: stageKey, byRole: user.role }
      );
      break;
    }

    default: {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Unknown stage action"];
      throw e;
    }
  }

  await fo.save();
  return fo.toJSON();
}
