// src/models/StorageBin.model.ts
import mongoose, { Schema, model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";

/**
 * One grid cell’s inventory for a center+map.
 * - `code` uses your renderer notation, e.g., "1A1", "3B2".
 * - `itemId` links to Items catalog (string _id like "FRT-001").
 */
export interface IStorageBin extends Document {
  /** Which Logistics Center this bin belongs to */
  center: Types.ObjectId;
  /** Map name inside the center (e.g., "main") */
  mapName: string;
  /** Cell code (row + zone letter + col), e.g., "1A1" */
  code: string;
  /** Linked Item._id (catalog string id like "FRT-001") */
  itemId?: string;
  /** Current amount in the container */
  current: number;
  /** Starting amount (baseline = 100%) */
  start: number;
createdAt?: Date;
    updatedAt?: Date;

}

const StorageBinSchema = new Schema<IStorageBin>({
  center:  { type: Schema.Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
  mapName: { type: String, required: true },
  code:    { type: String, required: true },
  itemId:  { type: String, ref: "Item" }, // your Items use string _id
  current: { type: Number, default: 0 },
  start:   { type: Number, default: 100 },
}, { timestamps: true, versionKey: false });

/** One unique record per (center, mapName, code) */
StorageBinSchema.index({ center: 1, mapName: 1, code: 1 }, { unique: true });

/** Speed lookups by item within a center (e.g., where is FRT-001 stored?) */
StorageBinSchema.index({ center: 1, itemId: 1 });

StorageBinSchema.plugin(toJSON as any);

export default model<IStorageBin>("StorageBin", StorageBinSchema);
