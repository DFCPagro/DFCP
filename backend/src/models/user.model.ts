import {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import bcrypt from "bcryptjs";
import toJSON from "../utils/toJSON";
import { roles } from "../utils/constants";

// ========== Address subdocument ==========
const AddressSchema = new Schema(
  {
    lnt: { type: Number, required: true }, // longitude (kept as 'lnt' per your shape)
    alt: { type: Number, required: true }, // latitude  (kept as 'alt')
    address: { type: String, required: true, trim: true },
    logisticCenterId: { type: String, default: null }, // set later in controller
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

// ========== Types inferred from schemas ==========
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

// ========== Helpers (hashing + normalization) ==========

function needsHash(pwd: unknown): pwd is string {
  // bcrypt hashes start with $2a/$2b/$2y — avoid double-hashing
  return typeof pwd === "string" && !pwd.startsWith("$2");
}

async function hashPassword(pwd: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pwd, salt);
}

/** Mutates the update object to hash password if present in either direct or $set form. */
async function maybeHashInUpdate(update: Record<string, any> | undefined) {
  if (!update) return;

  if (needsHash(update.password)) {
    update.password = await hashPassword(update.password);
  }

  if (update.$set && needsHash(update.$set.password)) {
    update.$set.password = await hashPassword(update.$set.password);
  }
}

/** Normalizes email to lowercased/trimmed inside typical update shapes. */
function normalizeEmailInUpdate(update: Record<string, any> | undefined) {
  if (!update) return;

  const raw =
    (update.email as string | undefined) ??
    (update.$set && (update.$set.email as string | undefined));

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (update.$set && "email" in (update.$set as object)) {
      update.$set.email = normalized;
    } else {
      update.email = normalized;
    }
  }
}

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
  if (!this.isModified("password")) return next();
  if (this.password && needsHash(this.password)) {
    this.password = await hashPassword(this.password);
  }
  next();
});

// hash + normalize on findOneAndUpdate (covers findByIdAndUpdate internally)
UserSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as Record<string, any> | undefined;
  await maybeHashInUpdate(update);
  normalizeEmailInUpdate(update);
  next();
});

// also cover updateOne and updateMany
UserSchema.pre("updateOne", async function (next) {
  // @ts-ignore Mongoose query `this` typing is permissive
  const update = this.getUpdate() as Record<string, any> | undefined;
  await maybeHashInUpdate(update);
  normalizeEmailInUpdate(update);
  next();
});

UserSchema.pre("updateMany", async function (next) {
  // @ts-ignore
  const update = this.getUpdate() as Record<string, any> | undefined;
  await maybeHashInUpdate(update);
  normalizeEmailInUpdate(update);
  next();
});

// ========== Methods ==========

UserSchema.methods.isPasswordMatch = async function (
  this: UserDoc,
  plain: string
) {
  if (!this.password) {
    // You likely queried without +password; surface a clear error
    throw new Error(
      "Password not selected on document. Use .select('+password') in your query before calling isPasswordMatch."
    );
  }
  return bcrypt.compare(plain, this.password);
};

// ========== Model ==========
export const User = model<User, UserModel>("User", UserSchema);
export default User;
