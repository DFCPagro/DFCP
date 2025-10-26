// FILE: src/models/CrowdState.model.ts
//
// Persistent crowd counters per shelf.  This model replaces the
// in-memory Map in shelfCrowd.service.ts and ensures that crowd
// scores survive process restarts.  Each document tracks the counts
// of pick, sort and audit tasks on a given shelf and stores the
// computed busyScore.

import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";

const CrowdStateSchema = new Schema(
  {
    shelfId: { type: Types.ObjectId, ref: "Shelf", required: true, unique: true },
    pickCount: { type: Number, default: 0, min: 0 },
    sortCount: { type: Number, default: 0, min: 0 },
    auditCount: { type: Number, default: 0, min: 0 },
    busyScore: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type CrowdState = InferSchemaType<typeof CrowdStateSchema>;
export type CrowdStateDoc = HydratedDocument<CrowdState>;
export type CrowdStateModel = Model<CrowdState>;

export const CrowdState = model<CrowdState, CrowdStateModel>("CrowdState", CrowdStateSchema);
export default CrowdState;
