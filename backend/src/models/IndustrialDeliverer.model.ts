// models/industrialDeliverer.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

// ===== schema (no generics; infer later) =====
const IndustrialDelivererSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    createdFromApplication: { type: Schema.Types.ObjectId, ref: "JobApplication", default: null, index: true },

    logisticCenterIds: { type: [Schema.Types.ObjectId], ref: "LogisticCenter", default: [], index: true },

    // driver & vehicle
    licenseType: { type: String, required: true, trim: true },
    driverLicenseNumber: { type: String, required: true, trim: true },
    vehicleMake: { type: String, default: null, trim: true },
    vehicleModel: { type: String, default: null, trim: true },
    vehicleType: { type: String, default: null, trim: true },
    vehicleYear: { type: Number, default: null, min: 1900, max: 3000 },
    vehicleRegistrationNumber: { type: String, default: null, trim: true },
    vehicleInsurance: { type: Boolean, default: false },

    vehicleCapacityKg: { type: Number, default: null, min: 0 },
    vehicleCapacityLiters: { type: Number, default: null, min: 0 },
    vehicleCargoCM: {
      type: new Schema({
        height: { type: Number, min: 0, required: true },
        length: { type: Number, min: 0, required: true },
        width: { type: Number, min: 0, required: true },
      }),
      required: true,
    },

    speedKmH: { type: Number, default: null, min: 0 },

    // pay defaults
    payFixedPerShift: { type: Number, default: 25, min: 0 },
    payPerKm: { type: Number, default: 1, min: 0 },
    payPerStop: { type: Number, default: 1, min: 0 },

    // industrial-only
    refrigerated: { type: Boolean, default: false },

  },
  { timestamps: true }
);

// plugins & indexes
IndustrialDelivererSchema.plugin(toJSON as any);
IndustrialDelivererSchema.index({ logisticCenterIds: 1 });

// ===== inferred types =====
export type IndustrialDeliverer = InferSchemaType<typeof IndustrialDelivererSchema>;
export type IndustrialDelivererDoc = HydratedDocument<IndustrialDeliverer>;
export type IndustrialDelivererModel = Model<IndustrialDeliverer>;

// ===== model =====
export const IndustrialDeliverer = model<IndustrialDeliverer, IndustrialDelivererModel>(
  "IndustrialDeliverer",
  IndustrialDelivererSchema
);
export default IndustrialDeliverer;
