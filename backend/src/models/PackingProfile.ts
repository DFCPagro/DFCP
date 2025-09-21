import mongoose, { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

export type Fragility = "very_fragile" | "fragile" | "normal" | "sturdy";

// --- sub-schemas ---
const PackingInfoSchema = new Schema(
  {
    bulkDensityKgPerL: { type: Number, required: true, min: 0.001 },
    litersPerKg: {
      type: Number,
      required: true,
      min: 0.001,
      validate: {
        validator(this: any, v: number) {
          if (!this.bulkDensityKgPerL) return true;
          const expected = 1 / this.bulkDensityKgPerL;
          const relErr = Math.abs(v - expected) / expected;
          return relErr <= 0.08;
        },
        message: "litersPerKg should be close to 1 / bulkDensityKgPerL (±8%).",
      },
    },
    fragility: { type: String, required: true, enum: ["very_fragile", "fragile", "normal", "sturdy"] },
    allowMixing: { type: Boolean, required: true },
    requiresVentedBox: { type: Boolean, required: true },
    minBoxType: { type: Schema.Types.ObjectId, ref: "PackageSize", required: true, index: true },
    maxWeightPerBoxKg: { type: Number, min: 0.001, default: null },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const PackingItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, required: true, ref: "Item", index: true },
    type: { type: String, required: true, trim: true },
    variety: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: ["fruit", "vegetable"], index: true },
    packing: { type: PackingInfoSchema, required: true },
  },
  { _id: false }
);

// --- main schema ---
const PackingProfileSchema = new Schema(
  {
    items: {
      type: [PackingItemSchema],
      required: true,
      validate: {
        validator(v: any[]) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "items must contain at least one entry.",
      },
    },
    units: { notes: { type: String, default: null } },
  },
  { collection: "packing_profiles", timestamps: true, minimize: true }
);

// indexes
PackingProfileSchema.index(
  { "items.type": 1, "items.variety": 1, "items.category": 1 },
  { name: "items_type_variety_category" }
);

// toJSON
PackingProfileSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    // TypeScript doesn't know about 'id' on 'ret', so cast to any
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

// ---------- Types ----------
type PackingProfileAttrs = InferSchemaType<typeof PackingProfileSchema>;
export type PackingProfileDoc = HydratedDocument<PackingProfileAttrs>;

// (No hooks using `this.isModified` here, but if you add any,
// type `this` as `PackingProfileDoc` inside them.)

export const PackingProfile =
  mongoose.models.PackingProfile || model<PackingProfileDoc>("PackingProfile", PackingProfileSchema);
