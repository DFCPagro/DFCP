import mongoose, { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// helper
export function calcUsableLiters(
  d: { l: number; w: number; h: number },
  headroomPct: number
) {
  return (d.l * d.w * d.h * (1 - headroomPct)) / 1000;
}

const InnerDimsSchema = new Schema(
  {
    l: { type: Number, required: true, min: 1 },
    w: { type: Number, required: true, min: 1 },
    h: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const PackageSizeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: {
      type: String,
      required: true,
      enum: ["Small", "Medium", "Large"],
      index: true,
    },
    innerDimsCm: { type: InnerDimsSchema, required: true },
    headroomPct: { type: Number, required: true, min: 0, max: 0.9 },
    maxSkusPerBox: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Number, required: true, min: 0.001 },
    mixingAllowed: { type: Boolean, required: true },
    tareWeightKg: { type: Number, required: true, min: 0 },
    usableLiters: { type: Number, required: true, min: 0 },
    vented: { type: Boolean, required: true },
    values: { type: Map, of: Number, default: undefined },
  },
  { collection: "package_sizes", timestamps: true }
);

PackageSizeSchema.index({ key: 1, vented: 1 }, { unique: true });

// ---------- Types ----------
type PackageSizeAttrs = InferSchemaType<typeof PackageSizeSchema>;
export type PackageSizeDoc = HydratedDocument<PackageSizeAttrs>;

/**
 * Compute rounded usable liters from given dims/headroom.
 */
function computeRoundedUsableLiters(
  dims?: { l: number; w: number; h: number } | null,
  head?: number | null
): number | undefined {
  if (!dims || typeof head !== "number") return undefined;
  return Number(calcUsableLiters(dims, head).toFixed(1));
}

/**
 * Apply computed usableLiters into a Mongoose update object (handles $set/no-$set).
 */
function ensureUsableLitersInUpdate(update: any, val: number) {
  if (!update) return;
  if (update.$set) {
    update.$set.usableLiters = val;
  } else {
    update.usableLiters = val;
  }
}

/**
 * Extract candidate dims/headroom from either doc (save) or update (query).
 */
function pickDimsAndHeadroomFromUpdate(thisAny: any) {
  const update = thisAny.getUpdate?.();
  const $set = update?.$set ?? update ?? {};
  const dims = $set.innerDimsCm;
  const head = $set.headroomPct;
  return { update, dims, head };
}

// ---------- Hooks ----------

// On document saves (create/save)
PackageSizeSchema.pre("validate", function (this: PackageSizeDoc, next) {
  const dims = this.innerDimsCm;
  const head = this.headroomPct;
  const val = computeRoundedUsableLiters(dims, head);

  if (typeof val === "number") {
    // Always overwrite to keep it canonical
    this.usableLiters = val;
  }
  next();
});

// On updates with query context
PackageSizeSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function (next) {
  // `this` is a Query
  const { update, dims, head } = pickDimsAndHeadroomFromUpdate(this);

  // If the update doesn't modify dims/headroom, do nothing (leave usableLiters unchanged).
  if (dims == null && head == null) return next();

  // We need both dims & headroom to compute correctly.
  const applyWithDocIfNeeded = async () => {
    let effectiveDims = dims;
    let effectiveHead = head;

    if (effectiveDims == null || typeof effectiveHead !== "number") {
      // Load current doc to fill missing pieces
      const current = await (this as any).model.findOne(this.getQuery()).lean();
      if (current) {
        if (effectiveDims == null) effectiveDims = current.innerDimsCm;
        if (typeof effectiveHead !== "number") effectiveHead = current.headroomPct;
      }
    }

    const computed = computeRoundedUsableLiters(effectiveDims, effectiveHead as any);
    if (typeof computed === "number") {
      ensureUsableLitersInUpdate(update, computed);
    }
  };

  // If both provided, compute immediately; else fetch doc to complete context.
  if (dims != null && typeof head === "number") {
    const computed = computeRoundedUsableLiters(dims, head);
    if (typeof computed === "number") {
      ensureUsableLitersInUpdate(update, computed);
    }
    return next();
  }

  // async branch when we must read the current doc
  applyWithDocIfNeeded()
    .then(() => next())
    .catch(next);
});

// ---------- toJSON ----------
PackageSizeSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const PackageSize =
  mongoose.models.PackageSize || model<PackageSizeDoc>("PackageSize", PackageSizeSchema);



export default PackageSize;
