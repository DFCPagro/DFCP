import { Schema } from "mongoose";
import { STAGE_STATUSES } from "./stage.types";

export const StageSchema = new Schema(
  {
    key:   { type: String, required: true, trim: true },   // stage key
    label: { type: String, required: true, trim: true },   // display label
    status:{ type: String, enum: STAGE_STATUSES, default: "pending", index: true },

    // timestamps (all optional)
    expectedAt:  { type: Date, default: null },  // planned ETA for stage
    startedAt:   { type: Date, default: null },  // when it actually started
    completedAt: { type: Date, default: null },  // when it actually finished

    // last modification metadata
    timestamp: { type: Date, default: Date.now }, // last update to this stage entry
    note:      { type: String, default: "" },
  },
  { _id: false }
);
