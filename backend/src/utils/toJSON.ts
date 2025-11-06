// utils/toJSON.ts
import { Schema } from "mongoose";

/**
 * Mongoose plugin to make document->JSON nicer:
 * - include virtuals
 * - run getters (so Decimal128 getters fire when not using lean())
 * - expose `id` and remove internals
 *
 * NOTE: Decimal/ObjectId/Date normalization for API responses
 * is handled globally by jsonSafe middleware; this plugin is
 * only for non-lean docs or places you call doc.toJSON() manually.
 */
export default function toJSON(schema: Schema) {
  schema.set("toJSON", {
    virtuals: true,
    getters: true,
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  });

  schema.method("toJSON", function () {
    const obj: any = this.toObject({ virtuals: true, getters: true });
    obj.id = obj._id;
    delete obj._id;
    delete obj.__v;
    delete obj.password;
    return obj;
  });
}
