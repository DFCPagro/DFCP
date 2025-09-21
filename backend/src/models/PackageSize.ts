import mongoose, { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// helper
export function calcUsableLiters(d: { l: number; w: number; h: number }, headroomPct: number) {
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
      unique: true,
    },
    innerDimsCm: { type: InnerDimsSchema, required: true },
    headroomPct: { type: Number, required: true, min: 0, max: 0.9 },
    maxSkusPerBox: { type: Number, required: true, min: 1 },
    maxWeightKg: { type: Number, required: true, min: 0.001 },
    mixingAllowed: { type: Boolean, required: true },
    tareWeightKg: { type: Number, required: true, min: 0 },
    usableLiters: {
      type: Number,
      required: true,
      min: 0.001,
      validate: {
        // use `this: any` here so TS doesn't complain inside validator
        validator(this: any, v: number) {
          const expected = calcUsableLiters(this.innerDimsCm, this.headroomPct);
          const relErr = Math.abs(v - expected) / (expected || 1);
          return relErr <= 0.1;
        },
        message: "usableLiters must be close to l*w*h*(1 - headroomPct)/1000 (±10%).",
      },
    },
    vented: { type: Boolean, required: true },
    values: { type: Map, of: Number, default: undefined },
  },
  { collection: "package_sizes", timestamps: true }
);

// ---------- Types ----------
type PackageSizeAttrs = InferSchemaType<typeof PackageSizeSchema>;
export type PackageSizeDoc = HydratedDocument<PackageSizeAttrs>;

// ---------- Hooks ----------
PackageSizeSchema.pre("validate", function (this: PackageSizeDoc, next) {
  const expected = calcUsableLiters(this.innerDimsCm, this.headroomPct);

  if (
    this.isModified("innerDimsCm") ||
    this.isModified("headroomPct") ||
    this.isModified("usableLiters")
  ) {
    if (this.usableLiters == null) {
      this.usableLiters = expected;
    } else {
      const relErr = Math.abs(this.usableLiters - expected) / (expected || 1);
      if (relErr > 0.1) this.usableLiters = expected;
    }
  }
  next();
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
