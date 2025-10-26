// FILE: src/models/WorldLayout.model.ts
import { Schema, model, Types, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

const WorldGridSpecSchema = new Schema(
  {
    rows: { type: Number, required: true, min: 1 },
    cols: { type: Number, required: true, min: 1 },
    showRowIndex: { type: Boolean, default: false },
    showColIndex: { type: Boolean, default: false },
    colLabels: { type: String, enum: ["letters", "numbers"], default: "numbers" },
    titleSize: { type: Number, default: 26 },
  },
  { _id: false }
);

const WorldZoneSchema = new Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    grid: { type: WorldGridSpecSchema, required: true },
  },
  { _id: false }
);

const WorldLayoutSchema = new Schema(
  {
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true, unique: true },
    pixelsPerMeter: { type: Number, required: true, min: 1 },
    zones: { type: [WorldZoneSchema], default: [] },
  },
  { timestamps: true }
);

WorldLayoutSchema.plugin(toJSON as any);

export type WorldLayout = InferSchemaType<typeof WorldLayoutSchema>;
export type WorldLayoutDoc = HydratedDocument<WorldLayout>;
export type WorldLayoutModel = Model<WorldLayout>;

export const WorldLayoutModel = model<WorldLayout, WorldLayoutModel>("WorldLayout", WorldLayoutSchema);
export default WorldLayoutModel;
