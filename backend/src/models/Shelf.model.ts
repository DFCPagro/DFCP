// models/Shelf.model.ts
//
// Defines the shelving infrastructure within a logistics centre.  A
// shelf groups multiple slots, each of which may hold zero or one
// container at any given time.  Shelves are type‑coded so that
// different operational areas (general warehouse storage, picker
// shelving, delivery handoff) can be managed independently.  The
// schema tracks capacity and occupancy metrics to facilitate
// balancing algorithms.

import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";

/**
 * Shelf type designations.  A `warehouse` shelf is part of the
 * general storage area and may contain overflow stock.  A
 * `picker` shelf is where pickers retrieve items for order
 * assembly.  A `delivery` shelf is reserved for completed
 * packages awaiting industrial delivery.
 */
export const SHELF_TYPES = ["warehouse", "picker", "delivery"] as const;
export type ShelfType = (typeof SHELF_TYPES)[number];

/**
 * Slot subdocument.  Each slot is addressed by a human‑friendly
 * identifier (e.g., "A1", "B3") and may hold at most one
 * container at a time.  When a container occupies a slot the
 * `containerOpsId` references the corresponding ContainerOps
 * document.  Weight is stored to support balancing; use
 * `null` when empty.
 */
const ShelfSlotSchema = new Schema(
  {
    slotId: { type: String, required: true },
    capacityKg: { type: Number, required: true, min: 0 },
    currentWeightKg: { type: Number, default: 0, min: 0 },
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", default: null },
    occupiedAt: { type: Date, default: null },
    emptiedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Shelf schema.  A shelf belongs to a logistics centre and may be
 * assigned to a specific zone within the facility.  It tracks
 * capacity across all slots (`maxSlots`) and total weight limit
 * (`maxWeightKg`).  A summary of current occupancy is stored to
 * accelerate balancing calculations; it should be updated
 * transactionally when slots are filled or emptied.
 */
const ShelfSchema = new Schema(
  {
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
    shelfId: { type: String, required: true },
    type: { type: String, enum: SHELF_TYPES, required: true },
    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    level: { type: String, default: null },
    maxSlots: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Number, required: true, min: 0 },
    slots: { type: [ShelfSlotSchema], default: [] },
    // aggregated metrics for quick balancing decisions
    currentWeightKg: { type: Number, default: 0 },
    occupiedSlots: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique shelf per centre and shelfId
ShelfSchema.index({ logisticCenterId: 1, shelfId: 1 }, { unique: true });
// Index by type and zone for balancing queries
ShelfSchema.index({ logisticCenterId: 1, type: 1, zone: 1 });

// Use toJSON plugin for friendly output
ShelfSchema.plugin(toJSON as any);

export type Shelf = InferSchemaType<typeof ShelfSchema>;
export type ShelfDoc = HydratedDocument<Shelf>;
export type ShelfModel = Model<Shelf>;

export const Shelf = model<Shelf, ShelfModel>("Shelf", ShelfSchema);
export default Shelf;