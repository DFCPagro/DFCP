import { Schema, model, Types, InferSchemaType, HydratedDocument, Model } from "mongoose";

const ShelfCrowdSchema = new Schema(
  {
    shelfId: { type: Types.ObjectId, ref: "Shelf", required: true, unique: true, index: true },
    pick: { type: Number, default: 0, min: 0 },
    sort: { type: Number, default: 0, min: 0 },
    audit: { type: Number, default: 0, min: 0 },
    liveContainers: { type: Number, default: 0, min: 0 }, // mirror from Shelf.occupiedSlots
    busyScore: { type: Number, default: 0, min: 0 },      // cached score, updated on bump/compute
    threshold: { type: Number, default: 2.0 },
    lastPingAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type ShelfCrowd = InferSchemaType<typeof ShelfCrowdSchema>;
export type ShelfCrowdDoc = HydratedDocument<ShelfCrowd>;
export type ShelfCrowdModel = Model<ShelfCrowd>;

export const ShelfCrowd = model<ShelfCrowd, ShelfCrowdModel>("ShelfCrowd", ShelfCrowdSchema);
export default ShelfCrowd;
