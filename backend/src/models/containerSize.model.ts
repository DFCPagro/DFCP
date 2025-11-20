// src/models/containerSize.model.ts
import mongoose, {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
} from "mongoose";

// ----------------- helper -----------------
/**
 * Compute usable liters for an open-top container.
 * innerDims in cm, headroomPct is fraction of volume left unused (e.g. 0.1 => 90% full).
 */
export function calcUsableLiters(
  d: { l: number; w: number; h: number },
  headroomPct: number
) {
  // cm³ -> liters, then apply headroom
  return (d.l * d.w * d.h * (1 - headroomPct)) / 1000;
}

// Same style as PackageSize
const InnerDimsSchema = new Schema(
  {
    l: { type: Number, required: true, min: 1 }, // inner length (cm)
    w: { type: Number, required: true, min: 1 }, // inner width  (cm)
    h: { type: Number, required: true, min: 1 }, // inner height (cm)
  },
  { _id: false }
);

const ContainerSizeSchema = new Schema(
  {
    // e.g. "Standard crate 40×30×25"
    name: { type: String, required: true, trim: true },

    // e.g. "CRATE_40x30x25"
    key: {
      type: String,
      required: true,
      index: true,
      // you can add enum here if you later standardize keys
    },

    // Inner (usable) dimensions in cm for an OPEN container
    innerDimsCm: { type: InnerDimsSchema, required: true },

    /**
     * Headroom percentage (0–0.9).
     * Represents the fraction of volume NOT used.
     * For open containers, this is just "we don't fill to the brim".
     *
     * Default: 0.1 => 90% full.
     */
    headroomPct: {
      type: Number,
      required: true,
      min: 0,
      max: 0.9,
      default: 0.1,
    },

    // Max allowed *product* weight for this container
    maxWeightKg: { type: Number, required: true, min: 0.001 },

    // Tare (empty) weight of the container itself
    tareWeightKg: { type: Number, required: true, min: 0 },

    // Derived effective volume in liters (after headroom)
    usableLiters: { type: Number, required: true, min: 0 },

    // Open vented crates by default; can be false for closed bins/boxes
    vented: { type: Boolean, required: true, default: true },

    /**
     * Generic numeric values map – same idea as PackageSize.values.
     * You can use it for scores, penalties, cost factors, etc.
     */
    values: { type: Map, of: Number, default: undefined },

    // If you want to remember if mixing is allowed (even though you currently don't):
    // mixingAllowed: { type: Boolean, required: true, default: false },
  },
  { collection: "container_sizes", timestamps: true }
);

// Key should be unique per container type
ContainerSizeSchema.index({ key: 1 }, { unique: true });

// ---------- Types ----------
type ContainerSizeAttrs = InferSchemaType<typeof ContainerSizeSchema>;
export type ContainerSizeDoc = HydratedDocument<ContainerSizeAttrs>;

/**
 * Compute rounded usable liters from given dims/headroom.
 */
function computeRoundedUsableLiters(
  dims?: { l: number; w: number; h: number } | null,
  head?: number | null
): number | undefined {
  if (!dims || typeof head !== "number") return undefined;
  return Number(calcUsableLiters(dims, head).toFixed(1)); // e.g. 25.48 -> 25.5
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
ContainerSizeSchema.pre("validate", function (this: ContainerSizeDoc, next) {
  const dims = this.innerDimsCm;
  // if headroom not set by user, default 0.1 will be used
  const head = this.headroomPct;
  const val = computeRoundedUsableLiters(dims, head);

  if (typeof val === "number") {
    // Always overwrite to keep it canonical
    this.usableLiters = val;
  }
  next();
});

// On updates with query context
ContainerSizeSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
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
          if (typeof effectiveHead !== "number")
            effectiveHead = current.headroomPct;
        }
      }

      const computed = computeRoundedUsableLiters(
        effectiveDims,
        effectiveHead as any
      );
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
  }
);

// ---------- toJSON ----------
ContainerSizeSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    return ret;
  },
});

export const ContainerSize =
  mongoose.models.ContainerSize ||
  model<ContainerSizeDoc>("ContainerSize", ContainerSizeSchema);

export default ContainerSize;
