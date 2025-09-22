// src/models/ItemPacking.ts
import mongoose, { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";
import { PackageSize } from "./PackageSize";

export type Fragility = "very_fragile" | "fragile" | "normal" | "sturdy";

const PackingInfoSchema = new Schema(
  {
    bulkDensityKgPerL: { type: Number, required: true, min: 0.001 },
    litersPerKg: {
      type: Number,
      required: true,
      min: 0.001,
      validate: {
        // In subdoc validators, `this` is the subdocument (packing).
        validator(this: any, v: number) {
          const rho = this?.bulkDensityKgPerL;
          if (typeof rho !== "number" || !isFinite(rho) || rho <= 0) return true; // skip if missing
          const expected = 1 / rho;
          const relErr = Math.abs(v - expected) / expected;
          return relErr <= 0.08; // ±8%
        },
        message: "litersPerKg should be close to 1 / bulkDensityKgPerL (±8%).",
      },
    },
    fragility: { type: String, required: true, enum: ["very_fragile", "fragile", "normal", "sturdy"] },
    allowMixing: { type: Boolean, required: true },
    requiresVentedBox: { type: Boolean, required: true },

    // Matches your JSON values like "Small" | "Medium" | "Large"
    minBoxType: { type: String, required: true, enum: ["Small", "Medium", "Large"], index: true },

    // Optional, omitted when not present in JSON
    maxWeightPerBoxKg: { type: Number, min: 0.001, default: undefined },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const PackingItemSchema = new Schema(
  {
    // Your 24-hex strings cast cleanly to ObjectId
    itemId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true, trim: true },
    variety: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: ["fruit", "vegetable"], index: true },
    packing: { type: PackingInfoSchema, required: true },
  },
  { _id: false }
);

const UnitsSchema = new Schema(
  {
    notes: { type: String, default: null },
  },
  { _id: false }
);

const ItemPackingSchema = new Schema(
  {
    items: {
      type: [PackingItemSchema],
      required: true,
      validate: [
        {
          // must contain at least one entry
          validator(v: any[]) {
            return Array.isArray(v) && v.length > 0;
          },
          message: "items must contain at least one entry.",
        },
        {
          // no duplicate itemId within the same document
          validator(v: any[]) {
            const seen = new Set<string>();
            for (const it of v ?? []) {
              const id = it?.itemId?.toString?.();
              if (!id) continue;
              if (seen.has(id)) return false;
              seen.add(id);
            }
            return true;
          },
          message: "items contains duplicate itemId values.",
        },
      ],
    },
    units: { type: UnitsSchema, default: undefined },
  },
  { collection: "item_packings", timestamps: true, minimize: true }
);

// Helpful multikey index for queries by produce metadata
ItemPackingSchema.index(
  { "items.type": 1, "items.variety": 1, "items.category": 1 },
  { name: "items_type_variety_category" }
);

// toJSON
ItemPackingSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});


PackingInfoSchema.path("minBoxType").validate({
  validator: async function (v: string) {
    // Skip if unset (schema already requires it)
    if (!v) return true;
    const exists = await PackageSize.exists({ key: v });
    return !!exists;
  },
  message: (props: any) => `No PackageSize found with key "${props.value}".`,
});


PackingInfoSchema.pre("validate", async function (next) {
  try {
    // `this` is the packing subdocument
    const { requiresVentedBox, minBoxType } = this as any;

    if (requiresVentedBox && minBoxType) {
      const ventedExists = await PackageSize.exists({ key: minBoxType, vented: true });
      if (!ventedExists) {
        return next(
          new mongoose.Error.ValidatorError({
            path: "requiresVentedBox",
            message: `Item requires a vented "${minBoxType}" box, but none exists.`,
            value: true,
          })
        );
      }
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

ItemPackingSchema.virtual("minBoxTypeDocs", {
  ref: "PackageSize",
  localField: "items.packing.minBoxType", // multikey from array of subdocs
  foreignField: "key",
  justOne: false,
});



// ---------- Types ----------
type ItemPackingAttrs = InferSchemaType<typeof ItemPackingSchema>;
export type ItemPackingDoc = HydratedDocument<ItemPackingAttrs>;

export const ItemPacking =
  mongoose.models.ItemPacking || model<ItemPackingDoc>("ItemPacking", ItemPackingSchema);
export default ItemPacking;
