// models/OrderPackage.model.ts
import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
  models,
} from "mongoose";
import toJSON from "../utils/toJSON";

const STATES = ["created", "staged", "picked_up", "dispatched", "canceled"] as const;
export type OrderPackageState = (typeof STATES)[number];

const OrderPackageSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true, index: true },
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },

    delivererId: { type: Types.ObjectId, ref: "Deliverer", default: null, index: true },

    shelfId: { type: String, default: null, index: true }, // human shelf code, not _id
    slotId: { type: String, default: null },

    estWeightKg: { type: Number, default: 0, min: 0 },
    finalWeightKg: { type: Number, default: 0, min: 0 },

    state: { type: String, enum: STATES, default: "created", index: true },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

OrderPackageSchema.plugin(toJSON as any);

/** ----- Types for methods & model ----- */
export type OrderPackage = InferSchemaType<typeof OrderPackageSchema>;
export type OrderPackageDoc = HydratedDocument<OrderPackage> & {
  markStaged: (shelfId: string, slotId: string) => void;
  markPickedUp: () => void;
  markDispatched: () => void;
};

export interface OrderPackageModel extends Model<OrderPackage> {}

/** ----- Instance methods (typed above) ----- */
OrderPackageSchema.methods.markStaged = function (this: OrderPackageDoc, shelfId: string, slotId: string) {
  this.shelfId = shelfId;
  this.slotId = slotId;
  this.state = "staged";
};

OrderPackageSchema.methods.markPickedUp = function (this: OrderPackageDoc) {
  this.state = "picked_up";
};

OrderPackageSchema.methods.markDispatched = function (this: OrderPackageDoc) {
  this.state = "dispatched";
};

/** ----- Export model with correct generics ----- */
export const OrderPackage =
  (models.OrderPackage as unknown as OrderPackageModel) ||
  model<OrderPackage, OrderPackageModel>("OrderPackage", OrderPackageSchema);

export default OrderPackage;
