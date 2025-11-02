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

    capacityKg: { type: Schema.Types.Decimal128, required: true, min: 0 },
    maxPackages: { type: Number, default: 0, min: 0 },

    currentWeightKg: {
      type: Schema.Types.Decimal128,
      default: () => Types.Decimal128.fromString("0"),
      min: 0,
    },
    currentPackages: { type: Number, default: 0, min: 0 },

    // occupants
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", default: null },
    packages: { type: [Schema.Types.ObjectId], ref: "OrderPackage", default: [] },

    // per-deliverer ownership (slot-level)
    delivererId: { type: Types.ObjectId, ref: "Deliverer", default: null, index: true },
    allowedOccupant: { type: String, enum: ["any", "container", "package"], default: "any" },

    occupiedAt: { type: Date, default: null },
    emptiedAt: { type: Date, default: null },

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

    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    level: { type: String, default: null },

    row: { type: Number, default: null },
    col: { type: Number, default: null },
    canvasX: { type: Number, default: null },
    canvasY: { type: Number, default: null },

    maxSlots: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Schema.Types.Decimal128, required: true, min: 0 },

    slots: { type: [ShelfSlotSchema], default: [] },

    currentWeightKg: {
      type: Schema.Types.Decimal128,
      default: () => Types.Decimal128.fromString("0"),
      min: 0,
    },
    occupiedSlots: { type: Number, default: 0, min: 0 },

    liveActiveTasks: { type: Number, default: 0, min: 0 },
    lastTaskPingAt: { type: Date, default: null },
    busyScore: { type: Number, default: 0, min: 0, max: 100 },
    isTemporarilyAvoid: { type: Boolean, default: false },

    // delivery mapping (whole-shelf convenience)
    isDeliveryShelf: { type: Boolean, default: false, index: true },
    assignedDelivererId: { type: Types.ObjectId, ref: "Deliverer", default: null, index: true },
  },
  { timestamps: true }
);

// Indexes
ShelfSchema.index({ logisticCenterId: 1, shelfId: 1 }, { unique: true });
ShelfSchema.index({ logisticCenterId: 1, type: 1, zone: 1, row: 1, col: 1 });
ShelfSchema.index({ liveActiveTasks: 1, busyScore: 1 });
ShelfSchema.index({ logisticCenterId: 1, type: 1, occupiedSlots: 1, currentWeightKg: 1 });
ShelfSchema.index({ logisticCenterId: 1, isDeliveryShelf: 1, assignedDelivererId: 1 });

ShelfSchema.plugin(toJSON as any);

// Aggregate guard when slots change
ShelfSchema.pre("save", function (next) {
  const doc = this as ShelfDoc;

  if (doc.slots && doc.maxSlots && doc.slots.length > doc.maxSlots) {
    return next(
      new Error(
        `slots.length (${doc.slots.length}) exceeds maxSlots (${doc.maxSlots}) for shelf ${doc.shelfId}`
      )
    );
  }

  if (doc.isModified("slots") || doc.isModified("maxSlots") || doc.isModified("maxWeightKg")) {
    let occupied = 0;
    let totalWeight = 0;
    for (const s of doc.slots) {
      const w = s.currentWeightKg ? parseFloat(s.currentWeightKg.toString()) : 0;
      totalWeight += w;
      const pkgCount = Array.isArray((s as any).packages) ? (s as any).packages.length : 0;
      if (s.currentPackages !== pkgCount) (s as any).currentPackages = pkgCount;

      if (s.containerOpsId || pkgCount > 0) occupied += 1;
    }
    doc.set("occupiedSlots", occupied);
    doc.set("currentWeightKg", Types.Decimal128.fromString(totalWeight.toString()));
  }

  next();
});

// ---------- statics ----------
export type StageArgs = {
  shelfId: string;
  logisticCenterId: string | Types.ObjectId;
  slotId: string;
  packageId: string | Types.ObjectId;
  packageWeightKg?: number;
  delivererId?: string | Types.ObjectId;
};

export type UnstageArgs = {
  shelfId: string;
  logisticCenterId: string | Types.ObjectId;
  slotId: string;
  packageId: string | Types.ObjectId;
  packageWeightKg?: number;
};

export type MoveArgs = {
  shelfId: string;
  logisticCenterId: string | Types.ObjectId;
  fromSlotId: string;
  toSlotId: string;
  packageId: string | Types.ObjectId;
  packageWeightKg?: number;
  toDelivererId?: string | Types.ObjectId;
};

function toOid(v: string | Types.ObjectId): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
}

// applySlotChange (weight & occupancy)
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
  deltaWeightKg: number;
  setOccupied: boolean;
}) {
  const filter = { shelfId, logisticCenterId: logisticCenterId };
  const deltaStr = String(deltaWeightKg);
  const deltaDec = Types.Decimal128.fromString(deltaStr);

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

  const res = await this.updateOne(filter, update, {
    arrayFilters: [{ "s.slotId": slotId }],
    upsert: false,
  });

  // clamp negatives if any
  if (res.matchedCount > 0) {
    await this.updateOne(
      { shelfId, logisticCenterId, "slots.slotId": slotId },
      {
        $set: {
          "slots.$[s].currentWeightKg": Types.Decimal128.fromString("0"),
        },
      },
      {
        arrayFilters: [
          { "s.slotId": slotId, "s.currentWeightKg": { $lt: Types.Decimal128.fromString("0") } },
        ],
      }
    );
  }
  return res;
};

// ping activity
ShelfSchema.statics.pingTaskActivity = async function ({
  shelfId,
  logisticCenterId,
  slotId,
  delta,
}: {
  shelfId: string;
  logisticCenterId: Types.ObjectId | string;
  slotId?: string;
  delta: number;
}) {
  const filter = { shelfId, logisticCenterId };
  const update: any = { $inc: { liveActiveTasks: delta }, $set: { lastTaskPingAt: new Date() } };
  if (slotId) {
    update.$inc[`slots.$[s].liveActiveTasks`] = delta;
    update.$set[`slots.$[s].lastTaskPingAt`] = new Date();
    return this.updateOne(filter, update, { arrayFilters: [{ "s.slotId": slotId }] });
  }
  return this.updateOne(filter, update);
};

// stage package into a slot
ShelfSchema.statics.stagePackage = async function ({
  shelfId,
  logisticCenterId,
  slotId,
  packageId,
  packageWeightKg = 0,
  delivererId,
}: StageArgs) {
  const deltaDec = Types.Decimal128.fromString(String(packageWeightKg));
  return this.updateOne(
    { shelfId, logisticCenterId },
    {
      $inc: {
        currentWeightKg: deltaDec,
        "slots.$[s].currentWeightKg": deltaDec,
        "slots.$[s].currentPackages": 1,
      },
      $addToSet: { "slots.$[s].packages": toOid(packageId) },
      $set: {
        updatedAt: new Date(),
        "slots.$[s].delivererId": delivererId ? toOid(delivererId) : undefined,
        "slots.$[s].allowedOccupant": "package",
        "slots.$[s].occupiedAt": new Date(),
        "slots.$[s].emptiedAt": null,
      },
    },
    { arrayFilters: [{ "s.slotId": slotId }], upsert: false }
  );
};

// unstage package from a slot
ShelfSchema.statics.unstagePackage = async function ({
  shelfId,
  logisticCenterId,
  slotId,
  packageId,
  packageWeightKg = 0,
}: UnstageArgs) {
  const neg = Types.Decimal128.fromString(`-${String(packageWeightKg)}`);
  return this.updateOne(
    { shelfId, logisticCenterId },
    {
      $inc: {
        currentWeightKg: neg,
        "slots.$[s].currentWeightKg": neg,
        "slots.$[s].currentPackages": -1,
      },
      $pull: { "slots.$[s].packages": toOid(packageId) },
      $set: { updatedAt: new Date() },
    },
    { arrayFilters: [{ "s.slotId": slotId }], upsert: false }
  );
};

// move staged package (same shelf)
ShelfSchema.statics.moveStagedPackage = async function ({
  shelfId,
  logisticCenterId,
  fromSlotId,
  toSlotId,
  packageId,
  packageWeightKg = 0,
  toDelivererId,
}: MoveArgs) {
  const dec = Types.Decimal128.fromString(String(packageWeightKg));

  await this.updateOne(
    { shelfId, logisticCenterId },
    {
      $inc: {
        "slots.$[s].currentWeightKg": Types.Decimal128.fromString(`-${String(packageWeightKg)}`),
        "slots.$[s].currentPackages": -1,
      },
      $pull: { "slots.$[s].packages": toOid(packageId) },
      $set: { updatedAt: new Date() },
    },
    { arrayFilters: [{ "s.slotId": fromSlotId }] }
  );

  return this.updateOne(
    { shelfId, logisticCenterId },
    {
      $inc: { "slots.$[s].currentWeightKg": dec, "slots.$[s].currentPackages": 1 },
      $addToSet: { "slots.$[s].packages": toOid(packageId) },
      $set: {
        updatedAt: new Date(),
        "slots.$[s].delivererId": toDelivererId ? toOid(toDelivererId) : undefined,
        "slots.$[s].allowedOccupant": "package",
        "slots.$[s].occupiedAt": new Date(),
        "slots.$[s].emptiedAt": null,
      },
    },
    { arrayFilters: [{ "s.slotId": toSlotId }] }
  );
};

// find least crowded
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
    .sort({
      isTemporarilyAvoid: 1,
      liveActiveTasks: 1,
      busyScore: 1,
      occupiedSlots: 1,
      currentWeightKg: 1,
    })
    .limit(limit)
    .lean();
};

// delivery shelves by deliverer
ShelfSchema.statics.findDeliveryShelvesForDeliverer = function ({
  logisticCenterId,
  delivererId,
}: {
  logisticCenterId: Types.ObjectId | string;
  delivererId: Types.ObjectId | string;
}) {
  return this.find({
    logisticCenterId,
    isDeliveryShelf: true,
    assignedDelivererId: delivererId,
  }).lean();
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
  stagePackage: (args: StageArgs) => Promise<any>;
  unstagePackage: (args: UnstageArgs) => Promise<any>;
  moveStagedPackage: (args: MoveArgs) => Promise<any>;
  findLeastCrowded: (args: {
    logisticCenterId: Types.ObjectId | string;
    type?: ShelfType;
    limit?: number;
  }) => Promise<any>;
  findDeliveryShelvesForDeliverer: (args: {
    logisticCenterId: Types.ObjectId | string;
    delivererId: Types.ObjectId | string;
  }) => Promise<any>;
};

export const Shelf = model<Shelf, ShelfModel>("Shelf", ShelfSchema);
export default Shelf;
