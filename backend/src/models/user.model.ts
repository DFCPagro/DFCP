// models/user.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import bcrypt from "bcryptjs";
import toJSON from "../utils/toJSON";
import { Role, roles } from "../utils/constants";

// ========== Address subdocument ==========
const AddressSchema = new Schema(
  {
    lnt: { type: Number, required: true },               // longitude (kept as 'lnt' per your shape)
    alt: { type: Number, required: true },               // latitude  (kept as 'alt')
    address: { type: String, required: true, trim: true },
    logisticCenterId: { type: String, default: null },   // set later in controller
  },
  { _id: false }
);

// ========== User schema (no generics; we infer later) ==========
const UserSchema = new Schema(
  {
    uid: { type: String, index: true },

    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    birthday: { type: Date },

    phone: { type: String, trim: true },

    role: { type: String, enum: roles, default: "customer", index: true },

    // active after verification later; default true for now
    activeStatus: { type: Boolean, default: true },

    // addresses array (subdocuments)
    addresses: {
      type: [AddressSchema],
      default: [],
      validate: {
        validator: (arr: unknown) => Array.isArray(arr),
        message: "addresses must be an array",
      },
    },

    // store but don't return by default
    password: { type: String, required: true, minlength: 6, select: false },
  },
  { discriminatorKey: "kind", timestamps: true }
);

// plugins & indexes
UserSchema.plugin(toJSON as any);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ uid: 1 });

// ========== Infer types from schemas ==========
export type Address = InferSchemaType<typeof AddressSchema>;
export type User = InferSchemaType<typeof UserSchema>;

// password is select:false ⇒ it might be missing on queried docs
export type UserSafe = Omit<User, "password"> & { password?: string };

// instance methods
export interface UserMethods {
  isPasswordMatch(plain: string): Promise<boolean>;
}

// hydrated doc & model types
export type UserDoc = HydratedDocument<UserSafe> & UserMethods;
export type UserModel = Model<User, {}, UserMethods>;

// ========== Hooks ==========

// normalize email casing/spacing even if someone bypassed validators
UserSchema.pre("validate", function (this: UserDoc, next) {
  if (typeof this.email === "string") {
    this.email = this.email.trim().toLowerCase();
  }
  next();
});

// hash on save if modified
UserSchema.pre("save", async function (this: UserDoc, next) {
  // mongoose provides isModified on docs
  if (!this.isModified("password")) return next();
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// hash on findOneAndUpdate if password is being changed
UserSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as Record<string, any> | undefined;
  if (!update) return next();

  // support both direct and $set updates
  const pwd =
    (update.password as string | undefined) ??
    (update.$set && (update.$set.password as string | undefined));

  if (pwd) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(pwd, salt);

    if (update.$set && "password" in (update.$set as object)) {
      update.$set.password = hashed;
    } else {
      update.password = hashed;
    }
  }

  // always keep email normalized if it’s included in the update
  const email =
    (update.email as string | undefined) ??
    (update.$set && (update.$set.email as string | undefined));
  if (email) {
    const normalized = email.trim().toLowerCase();
    if (update.$set && "email" in (update.$set as object)) {
      update.$set.email = normalized;
    } else {
      update.email = normalized;
    }
  }

  next();
});

// ========== Methods ==========

UserSchema.methods.isPasswordMatch = async function (this: UserDoc, plain: string) {
  if (!this.password) {
    // You likely queried without +password; surface a clear error
    throw new Error("Password not selected on document. Use .select('+password') in your query before calling isPasswordMatch.");
  }
  return bcrypt.compare(plain, this.password);
};

// ========== Model ==========
export const User = model<User, UserModel>("User", UserSchema);
export default User;
