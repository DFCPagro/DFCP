// src/models/MapLayout.model.ts
import mongoose, { Schema, model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON"; // same plugin you use on LogisticsCenter

export type ColLabels = "numbers" | "letters";

export interface IZone {
  /** One-letter block label shown on the canvas (e.g., "A", "B", "C") */
  zone: string;
  /** Grid height (rows) inside this block */
  rows: number;
  /** Grid width (columns) inside this block */
  cols: number;
  /** Absolute top-left canvas position (px) */
  position: { x: number; y: number };
  /** Optional UI helpers */
  showRowIndex?: boolean;
  showColIndex?: boolean;
  /** Column labeling style for this block */
  colLabels?: ColLabels;
  /** Optional aisle labels (visual only) */
  aisles?: number[];
  /** Aisle label layout tweaks */
  aisleRotate?: boolean;
  aisleLeft?: number;
  /** Big “A/B/C” title font size */
  titleSize?: number;
}

/** A complete named layout for a specific Logistics Center */
export interface IMapLayout extends Document {
  /** Which Logistics Center owns this layout */
  center: Types.ObjectId;
  /** Human-friendly key (e.g., "main") — unique *within* a center */
  name: string;
  /** All blocks that compose the layout */
  zones: IZone[];
createdAt?: Date;
    updatedAt?: Date;
}

const ZoneSchema = new Schema<IZone>({
  zone:        { type: String, required: true }, // keep flexible; enforce /^[A-Z]$/ if you like
  rows:        { type: Number, required: true, min: 1 },
  cols:        { type: Number, required: true, min: 1 },
  position:    {
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
  },
  showRowIndex: Boolean,
  showColIndex: Boolean,
  colLabels:   { type: String, enum: ["numbers", "letters"], default: "numbers" },
  aisles:      [Number],
  aisleRotate: Boolean,
  aisleLeft:   Number,
  titleSize:   Number,
}, { _id: false });

const MapLayoutSchema = new Schema<IMapLayout>({
  center: { type: Schema.Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
  name:   { type: String, required: true }, // no global unique — unique per center
  zones:  { type: [ZoneSchema], default: [] },
}, { timestamps: true, versionKey: false });

/** Ensure a layout name is unique within its center */
MapLayoutSchema.index({ center: 1, name: 1 }, { unique: true });

MapLayoutSchema.plugin(toJSON as any);

export default model<IMapLayout>("MapLayout", MapLayoutSchema);
