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
    capacityKg: { type: Schema.Types.Decimal128, required: true, min: 0 },
    currentWeightKg: { type: Schema.Types.Decimal128, default: () => Types.Decimal128.fromString("0"), min: 0 },

    // which containerOps currently occupies this slot (null if free)
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", default: null },
    occupiedAt: { type: Date, default: null },
    emptiedAt: { type: Date, default: null },

    // live activity on *this slot* (e.g., a sorter/picker working here)
    liveActiveTasks: { type: Number, default: 0, min: 0 },
    lastTaskPingAt: { type: Date, default: null },
  },
  { _id: false }
);

const ShelfSchema = new Schema(
  {
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
    shelfId: { type: String, required: true },
    type: { type: String, enum: SHELF_TYPES, required: true },

    // physical layout (optional, in sync with frontend)
    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    level: { type: String, default: null },

    // ✨ new in DB to match frontend DTO
    row: { type: Number, default: null },
    col: { type: Number, default: null },
    canvasX: { type: Number, default: null },
    canvasY: { type: Number, default: null },

    // capacities
    maxSlots: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Schema.Types.Decimal128, required: true, min: 0 },

    // slots
    slots: { type: [ShelfSlotSchema], default: [] },

    // aggregated metrics for quick balancing decisions
    currentWeightKg: { type: Schema.Types.Decimal128, default: () => Types.Decimal128.fromString("0"), min: 0 },
    occupiedSlots: { type: Number, default: 0, min: 0 },

    // congestion awareness
    liveActiveTasks: { type: Number, default: 0, min: 0 },
    lastTaskPingAt: { type: Date, default: null },
    busyScore: { type: Number, default: 0, min: 0, max: 100 },
    isTemporarilyAvoid: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
ShelfSchema.index({ logisticCenterId: 1, shelfId: 1 }, { unique: true });
ShelfSchema.index({ logisticCenterId: 1, type: 1, zone: 1, row: 1, col: 1 });
ShelfSchema.index({ liveActiveTasks: 1, busyScore: 1 });
ShelfSchema.index({ logisticCenterId: 1, type: 1, occupiedSlots: 1, currentWeightKg: 1 });

ShelfSchema.plugin(toJSON as any);

// Guard & aggregate maintenance when slots are edited directly
ShelfSchema.pre("save", function (next) {
  const doc = this as ShelfDoc;

  if (doc.slots && doc.maxSlots && doc.slots.length > doc.maxSlots) {
    return next(new Error(`slots.length (${doc.slots.length}) exceeds maxSlots (${doc.maxSlots}) for shelf ${doc.shelfId}`));
  }

  if (doc.isModified("slots") || doc.isModified("maxSlots") || doc.isModified("maxWeightKg")) {
    let occupied = 0;
    let total = 0;
    for (const s of doc.slots) {
      const val = s.currentWeightKg ? parseFloat(s.currentWeightKg.toString()) : 0;
      total += val;
      if (s.containerOpsId) occupied += 1;
    }
    doc.set("occupiedSlots", occupied);
    doc.set("currentWeightKg", Types.Decimal128.fromString(total.toString()));
  }

  next();
});

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
  // Convert numeric delta to Decimal128 for kg fields
  const deltaDec = Types.Decimal128.fromString(String(deltaWeightKg));
  const update: any = {
    $inc: {
      currentWeightKg: deltaDec,
      ...(setOccupied ? { occupiedSlots: 1 } : { occupiedSlots: -1 }),
      [`slots.$[s].currentWeightKg`]: deltaDec,
    },
    $set: {
      updatedAt: new Date(),
      ...(setOccupied
        ? { "slots.$[s].occupiedAt": new Date(), "slots.$[s].emptiedAt": null }
        : { "slots.$[s].emptiedAt": new Date(), "slots.$[s].occupiedAt": null }),
    },
  };

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
    .sort({ isTemporarilyAvoid: 1, liveActiveTasks: 1, busyScore: 1, occupiedSlots: 1, currentWeightKg: 1 })
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
