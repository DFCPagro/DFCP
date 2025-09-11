

const allStagesOrder = [
  { key: "at-farm", label: "At Farm" },
  { key: "ready-for-pickup", label: "Ready for Pickup" },
  { key: "in-transit", label: "In Transit" },
  { key: "arrived", label: "Arrived" },
  { key: "sorting", label: "Sorting" },
  { key: "warehouse", label: "Warehouse" },
];

const farmerStatus: { [key: string]: string } = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  problem: "Problem",
};

// models/farmerOrder.model.ts
import { Schema, model, Types, Document } from "mongoose";

// --- Enums / constants ---
export const SHIFT = ["morning","afternoon","evening","night"] as const;
export type Shift = typeof SHIFT[number];

export const SIMPLE_STATUS = ["pending","approved","problem"] as const;
export type SimpleStatus = typeof SIMPLE_STATUS[number];

export const QC_STATUS = ["ok","problem","pending"] as const;
export type QCStatus = typeof QC_STATUS[number];

export const STAGE_STATUS = ["ok","problem","current","pending","done"] as const;
export type StageStatus = typeof STAGE_STATUS[number];

export const LOCATION_ENUM = ["warehouse","pickerShelf","inTruck","inTransit","unknown"] as const;
export type LocationEnum = typeof LOCATION_ENUM[number];

// --- Sub-schemas ---
const StageSchema = new Schema(
  {
    key:   { type: String, required: true, trim: true }, // e.g. "planned","farmer_ack","harvest","qc","loaded","received_warehouse","allocated","closed"
    label: { type: String, required: true, trim: true },
    status:{ type: String, enum: STAGE_STATUS, default: "pending", index: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const QSReportSchema = new Schema(
  {
    values:   { type: Schema.Types.Mixed, default: {} }, // your metrics (brix, temp, defects…)
    note:     { type: String, default: "" },
    byUserId: { type: Schema.Types.ObjectId, ref: "User" },
    timestamp:{ type: Date, default: Date.now },
  },
  { _id: false }
);

const VisualInspectionSchema = new Schema(
  {
    status:   { type: String, enum: QC_STATUS, default: "pending" },
    note:     { type: String, default: "" },
    timestamp:{ type: Date, default: Date.now },
  },
  { _id: false }
);

const ContainerSchema = new Schema(
  {
    containerId: { type: String, required: true }, // e.g., "FO_<farmerOrderId>_<seq>"
    farmerOrder: { type: Schema.Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
    itemId:      { type: Schema.Types.ObjectId, ref: "Item", required: true },
    qrUrl:       { type: String, required: true },
    weightKg:    { type: Number, min: 0, default: 0 },
    stages:      { type: [StageSchema], default: [] },
    warehouseSlot: {
      shelfLocation: { type: String, default: "" },
      zone:          { type: String, default: "" },
      location:      { type: String, enum: LOCATION_ENUM, default: "unknown" },
      timestamp:     { type: Date, default: Date.now },
    },
  },
  { _id: false }
);

const AuditEntrySchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    action:    { type: String, required: true }, // "CREATE","UPDATE_STAGE","SCAN_QR","ASSIGN_DRIVER"
    note:      { type: String, default: "" },
    meta:      { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// --- Interface ---
export interface FarmerOrderDoc extends Document {
  // identity
  itemId: Types.ObjectId;
  farmerId: Types.ObjectId;
  farmerName: string;
  farmName: string;
  landId?: Types.ObjectId | null;
  sectionId?: string;

  type?: string;
  variety?: string;
  pictureUrl?: string;

  shift: Shift;
  pickUpDate: string; // "YYYY-MM-DD"
  logisticCenterId: string;

  // demand aggregation
  sumOrderedQuantityKg: number;

  // creation / ownership
  createdBy: Types.ObjectId;
  createdAt: Date;

  // lifecycle
  stages: Array<{
    key: string; label: string; status: StageStatus; timestamp: Date; note?: string;
  }>;

  farmerStatus: SimpleStatus;
  farmersQSreport?: any;

  containersNum: number;
  containers: Array<{
    containerId: string;
    farmerOrder: Types.ObjectId;
    itemId: Types.ObjectId;
    qrUrl: string;
    weightKg: number;
    stages: any[];
    warehouseSlot: { shelfLocation?: string; zone?: string; location: LocationEnum; timestamp: Date };
  }>;

  visualInspection?: { status: QCStatus; note?: string; timestamp: Date };
  inspectionQSreport?: any;
  inspectionStatusHistory: Array<{ status: QCStatus; note?: string; timestamp: Date; byUserId?: Types.ObjectId }>;

  warehouseContainersList: Array<{
    qrUrl: string; containerId: string; farmerOrderId: Types.ObjectId;
    shelfLocation?: string; weightKg?: number; location: LocationEnum; timestamp: Date;
  }>;

  linkedOrders: Array<{ orderId: Types.ObjectId; allocatedKg: number }>;

  historyAuditTrail: Array<{ timestamp: Date; userId: Types.ObjectId; action: string; note?: string; meta?: any }>;

  // business key (for idempotent upserts)
  bk: { farmerId: Types.ObjectId; itemId: Types.ObjectId; pickUpDate: string; shift: Shift; logisticCenterId: string };

  // virtuals
  totalScannedWeightKg?: number;

  // methods
  addAudit(userId: Types.ObjectId, action: string, note?: string, meta?: any): void;
  setStageCurrent(key: string, label?: string, note?: string): void;
  markStageDone(key: string, note?: string): void;
}

// --- Schema ---
const FarmerOrderSchema = new Schema<FarmerOrderDoc>(
  {
    itemId:   { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    farmerId: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    farmerName: { type: String, required: true },
    farmName:   { type: String, required: true },
    landId:     { type: Schema.Types.ObjectId, ref: "FarmerLand", default: null },
    sectionId:  { type: String, default: "" },

    type:       { type: String, default: "" },
    variety:    { type: String, default: "" },
    pictureUrl: { type: String, default: "" },

    shift: { type: String, enum: SHIFT, required: true, index: true },
    pickUpDate: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    logisticCenterId: { type: String, default: "LC-1", index: true },

    sumOrderedQuantityKg: { type: Number, required: true, min: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now },

    stages: { type: [StageSchema], default: [] },

    farmerStatus: { type: String, enum: SIMPLE_STATUS, default: "pending", index: true },
    farmersQSreport: { type: QSReportSchema, default: undefined },

    containersNum: { type: Number, min: 0, default: 0 },
    containers: { type: [ContainerSchema], default: [] },

    visualInspection: { type: VisualInspectionSchema, default: undefined },
    inspectionQSreport: { type: QSReportSchema, default: undefined },
    inspectionStatusHistory: {
      type: [
        new Schema(
          {
            status:   { type: String, enum: QC_STATUS, default: "pending" },
            note:     { type: String, default: "" },
            timestamp:{ type: Date, default: Date.now },
            byUserId: { type: Schema.Types.ObjectId, ref: "User" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    warehouseContainersList: {
      type: [
        new Schema(
          {
            qrUrl:        { type: String, required: true },
            containerId:  { type: String, required: true },
            farmerOrderId:{ type: Schema.Types.ObjectId, ref: "FarmerOrder", required: true },
            shelfLocation:{ type: String, default: "" },
            weightKg:     { type: Number, min: 0, default: 0 },
            location:     { type: String, enum: LOCATION_ENUM, default: "warehouse" },
            timestamp:    { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    linkedOrders: {
      type: [
        new Schema(
          {
            orderId:    { type: Schema.Types.ObjectId, ref: "Order", required: true },
            allocatedKg:{ type: Number, min: 0, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    historyAuditTrail: { type: [AuditEntrySchema], default: [] },

    // Business key for idempotent upsert & easy dedupe
    bk: {
      farmerId:         { type: Schema.Types.ObjectId, ref: "Farmer", required: true },
      itemId:           { type: Schema.Types.ObjectId, ref: "Item", required: true },
      pickUpDate:       { type: String, required: true },
      shift:            { type: String, enum: SHIFT, required: true },
      logisticCenterId: { type: String, default: "LC-1" },
    },
  },
  { timestamps: true }
);

// --- Indexes ---
FarmerOrderSchema.index({ "bk.farmerId": 1, "bk.itemId": 1, "bk.pickUpDate": 1, "bk.shift": 1, "bk.logisticCenterId": 1 }, { unique: true });
FarmerOrderSchema.index({ farmerId: 1, itemId: 1, pickUpDate: 1, shift: 1 });
FarmerOrderSchema.index({ logisticCenterId: 1, pickUpDate: 1, shift: 1 });
FarmerOrderSchema.index({ farmerStatus: 1, updatedAt: -1 });

// --- Virtuals ---
FarmerOrderSchema.virtual("totalScannedWeightKg").get(function (this: FarmerOrderDoc) {
  return (this.containers || []).reduce((sum, c) => sum + (c.weightKg || 0), 0);
});

// --- Methods ---
FarmerOrderSchema.methods.addAudit = function (userId: Types.ObjectId, action: string, note = "", meta = {}) {
  this.historyAuditTrail.push({ userId, action, note, meta, timestamp: new Date() });
};

FarmerOrderSchema.methods.setStageCurrent = function (key: string, label = "", note = "") {
  for (const s of this.stages) if (s.status === "current") s.status = "done";
  const now = new Date();
  const existing = this.stages.find(s => s.key === key);
  if (existing) {
    existing.status = "current";
    existing.timestamp = now;
    if (label) existing.label = label;
    if (note) existing.note = note;
  } else {
    this.stages.push({ key, label: label || key, status: "current", timestamp: now, note });
  }
};

FarmerOrderSchema.methods.markStageDone = function (key: string, note = "") {
  const s = this.stages.find(s => s.key === key);
  if (s) {
    s.status = "done";
    if (note) s.note = note;
    s.timestamp = new Date();
  }
};

// --- Statics ---
FarmerOrderSchema.statics.findOrCreateByBK = async function (bk: FarmerOrderDoc["bk"], payload: Partial<FarmerOrderDoc>) {
  return this.findOneAndUpdate(
    { bk },
    { $setOnInsert: { ...payload, bk } },
    { new: true, upsert: true }
  );
};

export const FarmerOrder = model<FarmerOrderDoc>("FarmerOrder", FarmerOrderSchema);
