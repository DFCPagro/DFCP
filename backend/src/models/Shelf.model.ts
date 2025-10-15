// models/Shelf.model.ts
import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";

export const SHELF_TYPES = ["warehouse", "picker", "delivery"] as const;
export type ShelfType = (typeof SHELF_TYPES)[number];

const ShelfSlotSchema = new Schema(
  {
    slotId: { type: String, required: true },
    capacityKg: { type: Number, required: true, min: 0 },
    currentWeightKg: { type: Number, default: 0, min: 0 },

    // which containerOps currently occupies this slot (null if free)
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", default: null },
    occupiedAt: { type: Date, default: null },
    emptiedAt: { type: Date, default: null },

    // live activity on *this slot* (e.g., a sorter/picker working here)
    liveActiveTasks: { type: Number, default: 0, min: 0 }, // in-flight tasks at the slot
    lastTaskPingAt: { type: Date, default: null },         // last “I’m working here” ping
  },
  { _id: false }
);

const ShelfSchema = new Schema(
  {
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
    shelfId: { type: String, required: true },
    type: { type: String, enum: SHELF_TYPES, required: true },

    // physical layout (optional)
    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    level: { type: String, default: null },

    // capacities
    maxSlots: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Number, required: true, min: 0 },

    // slots
    slots: { type: [ShelfSlotSchema], default: [] },

    // aggregated metrics for quick balancing decisions
    currentWeightKg: { type: Number, default: 0 },
    occupiedSlots: { type: Number, default: 0 },

    // --- NEW: congestion awareness ---
    liveActiveTasks: { type: Number, default: 0, min: 0 }, // total in-flight tasks on this shelf
    lastTaskPingAt: { type: Date, default: null },

    // a rolling, cheap-to-compute crowding indicator (0–100), updated by your services
    busyScore: { type: Number, default: 0, min: 0, max: 100 },

    // optional soft flags for assignment logic
    isTemporarilyAvoid: { type: Boolean, default: false },  // e.g. traffic jam or maintenance
  },
  { timestamps: true }
);

// Uniques & lookups
ShelfSchema.index({ logisticCenterId: 1, shelfId: 1 }, { unique: true });
ShelfSchema.index({ logisticCenterId: 1, type: 1, zone: 1 });
ShelfSchema.index({ liveActiveTasks: 1, busyScore: 1 }); // fast “find less crowded”
// for quick free-slot search:
ShelfSchema.index({ logisticCenterId: 1, type: 1, occupiedSlots: 1, currentWeightKg: 1 });

ShelfSchema.plugin(toJSON as any);

// ---------- helpers you can call from services ----------

// Call whenever you place/remove a container:
ShelfSchema.statics.applySlotChange = async function ({
  shelfId,
  logisticCenterId,
  slotId,
  deltaWeightKg,
  setOccupied,
}: {
  shelfId: string;
  logisticCenterId: Types.ObjectId | string;
  slotId: string;
  deltaWeightKg: number;      // + when placing, - when removing
  setOccupied: boolean;       // true when placing, false when freeing
}) {
  const filter = { shelfId, logisticCenterId };
  const update: any = {
    $inc: {
      currentWeightKg: deltaWeightKg,
      ...(setOccupied ? { occupiedSlots: 1 } : { occupiedSlots: -1 }),
    },
    $set: { updatedAt: new Date() },
  };
  // update slot subdoc too
  update.$inc[`slots.$[s].currentWeightKg`] = deltaWeightKg;
  if (setOccupied) {
    update.$set[`slots.$[s].occupiedAt`] = new Date();
    update.$set[`slots.$[s].emptiedAt`] = null;
  } else {
    update.$set[`slots.$[s].emptiedAt`] = new Date();
    update.$set[`slots.$[s].occupiedAt`] = null;
  }

  return this.updateOne(filter, update, {
    arrayFilters: [{ "s.slotId": slotId }],
    upsert: false,
  });
};

// Ping when a worker is actively operating on a shelf (or slot):
ShelfSchema.statics.pingTaskActivity = async function ({
  shelfId,
  logisticCenterId,
  slotId,
  delta,
}: {
  shelfId: string;
  logisticCenterId: Types.ObjectId | string;
  slotId?: string;         // optional; when provided, slot counters move too
  delta: number;           // +1 task started, -1 task ended
}) {
  const filter = { shelfId, logisticCenterId };
  const update: any = { $inc: { liveActiveTasks: delta }, $set: { lastTaskPingAt: new Date() } };

  if (slotId) {
    update.$inc = update.$inc || {};
    update.$set = update.$set || {};
    update.$inc[`slots.$[s].liveActiveTasks`] = delta;
    update.$set[`slots.$[s].lastTaskPingAt`] = new Date();
    return this.updateOne(filter, update, { arrayFilters: [{ "s.slotId": slotId }] });
  }

  return this.updateOne(filter, update);
};

// Optional: quick query to fetch “least crowded shelves” for assignment
ShelfSchema.statics.findLeastCrowded = function ({
  logisticCenterId,
  type,
  limit = 10,
}: {
  logisticCenterId: Types.ObjectId | string;
  type?: ShelfType;
  limit?: number;
}) {
  const q: any = { logisticCenterId };
  if (type) q.type = type;
  return this.find(q)
    .sort({ isTemporarilyAvoid: 1, liveActiveTasks: 1, busyScore: 1, occupiedSlots: 1 })
    .limit(limit)
    .lean();
};

export type Shelf = InferSchemaType<typeof ShelfSchema>;
export type ShelfDoc = HydratedDocument<Shelf>;
export type ShelfModel = Model<Shelf> & {
  applySlotChange: (args: {
    shelfId: string;
    logisticCenterId: Types.ObjectId | string;
    slotId: string;
    deltaWeightKg: number;
    setOccupied: boolean;
  }) => Promise<any>;
  pingTaskActivity: (args: {
    shelfId: string;
    logisticCenterId: Types.ObjectId | string;
    slotId?: string;
    delta: number;
  }) => Promise<any>;
  findLeastCrowded: (args: {
    logisticCenterId: Types.ObjectId | string;
    type?: ShelfType;
    limit?: number;
  }) => Promise<any>;
};

export const Shelf = model<Shelf, ShelfModel>("Shelf", ShelfSchema);
export default Shelf;
